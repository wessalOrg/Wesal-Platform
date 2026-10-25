using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public sealed class ExternalBookingServiceShould
{
    [Fact]
    public async Task Create_PersistsConfirmedBookedSlotsWithoutRequesterOrDeposit()
    {
        await using var h = await ExternalBookingHarness.CreateAsync();
        var result = await h.CreateAsync();
        await using var db = h.Context();
        var booking = await db.Bookings.Include(x => x.Slots).Include(x => x.ExternalDetails).SingleAsync();
        Assert.Equal("Confirmed", result.Status);
        Assert.Equal(BookingSource.ExternalManual, booking.Source);
        Assert.Null(booking.RequesterUserId);
        Assert.Null(booking.DepositAmount);
        Assert.Null(booking.DepositPaymentConfirmedAt);
        Assert.All(await db.HallSlotAvailabilities.ToArrayAsync(), x => Assert.Equal(HallSlotStatus.Booked, x.Status));
        Assert.Equal(2, booking.Slots.Count);
        Assert.Single(await db.Set<BookingAuditEvent>().ToListAsync());
        Assert.Single(await db.Set<BookingMutationReceipt>().ToListAsync());
    }

    [Fact]
    public async Task DuplicateCreate_ReturnsSamePersistentId_AndDifferentPayloadIsRejected()
    {
        await using var h = await ExternalBookingHarness.CreateAsync();
        var key = Guid.NewGuid().ToString();
        var first = await h.CreateAsync(key: key);
        var replay = await h.CreateAsync(key: key);
        Assert.Equivalent(first, replay);
        var e = await Assert.ThrowsAsync<ExternalBookingException>(() => h.CreateAsync(h.Request with { CustomerName = "Other" }, key));
        Assert.Equal("IdempotencyKeyReused", e.Code);
        await using var db = h.Context();
        Assert.Equal(1, await db.Bookings.CountAsync());
        Assert.Equal(1, await db.Set<BookingAuditEvent>().CountAsync());
    }

    [Theory]
    [InlineData(false, ApplicationRoles.HallOwner)]
    [InlineData(true, ApplicationRoles.RegisteredUser)]
    public async Task AuthenticationAndRoleAreRequired(bool authenticated, string role)
    {
        await using var h = await ExternalBookingHarness.CreateAsync();
        h.Current.Authenticated = authenticated; h.Current.Role = role;
        await Assert.ThrowsAnyAsync<DomainException>(() => h.CreateAsync());
        await using var db = h.Context(); Assert.Empty(await db.Bookings.ToListAsync());
    }

    [Fact]
    public async Task Transfer_RevokesOldOwnerIncludingReceiptReplay_AndPreservesActor()
    {
        await using var h = await ExternalBookingHarness.CreateAsync();
        var key = Guid.NewGuid().ToString(); var first = await h.CreateAsync(key: key);
        await h.ChangeHallAsync(x => x.OwnerId = "new-owner");
        await using (var op = h.Operation())
            await Assert.ThrowsAsync<NotFoundException>(() => op.Service.GetAsync(h.HallId, first.BookingId));
        await Assert.ThrowsAsync<NotFoundException>(() => h.CreateAsync(key: key));
        h.Current.Id = "new-owner";
        await using (var op = h.Operation()) Assert.Equal(first.BookingId, (await op.Service.GetAsync(h.HallId, first.BookingId)).BookingId);
        await using var db = h.Context(); Assert.Equal("owner", (await db.Set<BookingAuditEvent>().SingleAsync()).ActorUserId);
    }

    [Fact]
    public async Task CrossHallAndOtherOwnerCannotReadOrMutate()
    {
        await using var h = await ExternalBookingHarness.CreateAsync(); var result = await h.CreateAsync();
        await using var op = h.Operation();
        await Assert.ThrowsAsync<NotFoundException>(() => op.Service.GetAsync(Guid.NewGuid(), result.BookingId));
        h.Current.Id = "new-owner";
        await Assert.ThrowsAsync<NotFoundException>(() => op.Service.ListAsync(h.HallId, h.Request.Date, h.Request.Date, 1, 50));
        await Assert.ThrowsAsync<NotFoundException>(() => op.Service.UpdateAsync(h.HallId, result.BookingId, h.Request, Guid.NewGuid().ToString(), 1));
        await Assert.ThrowsAsync<NotFoundException>(() => op.Service.CancelAsync(h.HallId, result.BookingId, new(), Guid.NewGuid().ToString(), 1));
    }

    [Theory]
    [InlineData("customer")]
    [InlineData("phone")]
    [InlineData("event")]
    [InlineData("negative")]
    [InlineData("excess")]
    [InlineData("precision")]
    [InlineData("guests")]
    [InlineData("empty")]
    public async Task InvalidDetailsAndAmountsAreRejected(string kind)
    {
        await using var h = await ExternalBookingHarness.CreateAsync();
        var request = kind switch {
            "customer" => h.Request with { CustomerName = " " }, "phone" => h.Request with { Phone = "script" },
            "event" => h.Request with { EventType = "invalid" }, "negative" => h.Request with { TotalAmount = -1 },
            "excess" => h.Request with { TotalAmount = 1, AmountReceivedExternally = 2 },
            "precision" => h.Request with { TotalAmount = 1.001m }, "guests" => h.Request with { Guests = 0 },
            _ => h.Request with { SlotStarts = [] } };
        await Assert.ThrowsAsync<Wesal.Domain.Exceptions.ValidationException>(() => h.CreateAsync(request));
    }

    [Theory]
    [InlineData("fraction")]
    [InlineData("duplicate")]
    [InlineData("window")]
    [InlineData("past")]
    [InlineData("midnight")]
    public async Task InvalidSchedulesCannotReserve(string kind)
    {
        await using var h = await ExternalBookingHarness.CreateAsync();
        var request = kind switch {
            "fraction" => h.Request with { SlotStarts = [new TimeOnly(10,0).Add(TimeSpan.FromMilliseconds(1))] },
            "duplicate" => h.Request with { SlotStarts = [new(10,0),new(10,0)] },
            "window" => h.Request with { SlotStarts = [new(7,0)] },
            "past" => h.Request with { Date = DateOnly.FromDateTime(h.Clock.Now.UtcDateTime).AddDays(-1) },
            _ => h.Request with { SlotStarts = [new(23,0),new(0,0)] } };
        if (kind == "fraction") await Assert.ThrowsAsync<Wesal.Domain.Exceptions.ValidationException>(() => h.CreateAsync(request));
        else await Assert.ThrowsAsync<ExternalBookingException>(() => h.CreateAsync(request));
    }

    [Fact]
    public async Task SameDayUsesHebronTime_AndRejectsAnyStartedHour()
    {
        await using var h = await ExternalBookingHarness.CreateAsync();
        h.Clock.Now = new DateTimeOffset(2026, 11, 15, 7, 30, 0, TimeSpan.Zero); // 09:30 Hebron
        var today = new DateOnly(2026, 11, 15);
        await h.CreateAsync(h.Request with { Date = today, SlotStarts = [new(10,0)] });
        await Assert.ThrowsAsync<ExternalBookingException>(() => h.CreateAsync(h.Request with { Date = today, SlotStarts = [new(9,0)] }));
    }

    [Fact]
    public async Task SelectedNoncontiguousHoursReserveOnlyTheRequestedHours()
    {
        await using var h=await ExternalBookingHarness.CreateAsync();
        await h.CreateAsync(h.Request with { SlotStarts=[new(10,0),new(12,0)] });
        await using var db=h.Context();
        Assert.Equal(2,await db.HallSlotAvailabilities.CountAsync());
        Assert.False(await db.HallSlotAvailabilities.AnyAsync(x=>x.StartTime==new TimeOnly(11,0)));
    }

    [Theory]
    [InlineData("expired")]
    [InlineData("admin")]
    [InlineData("unpaid")]
    [InlineData("pending")]
    [InlineData("blocked")]
    public async Task AdmissionRechecksEligibilityAndDayGate(string state)
    {
        await using var h = await ExternalBookingHarness.CreateAsync();
        await h.ChangeHallAsync(x => {
            if (state == "expired") x.SubscriptionCycleEnd = new DateOnly(2026, 1, 1);
            if (state == "admin") x.IsAdminLocked = true;
            if (state == "unpaid") x.PaymentStatus = HallPaymentStatus.Unpaid;
            if (state == "pending") x.Status = HallStatus.PendingReview;
        });
        if (state == "blocked") { await using var db = h.Context(); db.HallDayAvailabilities.Add(new() { HallId=h.HallId, Date=h.Request.Date, IsOpen=false }); await db.SaveChangesAsync(); }
        await Assert.ThrowsAsync<ExternalBookingException>(() => h.CreateAsync());
    }

    [Fact]
    public async Task Expiry_AllowsReadDetailsEditAndCancellation_ButRefusesReschedule()
    {
        await using var h = await ExternalBookingHarness.CreateAsync(); var result = await h.CreateAsync();
        await h.ChangeHallAsync(x => { x.SubscriptionCycleEnd = new DateOnly(2026,1,1); x.SystemLocked=true; });
        await using var op = h.Operation();
        Assert.Equal(result.BookingId, (await op.Service.GetAsync(h.HallId, result.BookingId)).BookingId);
        Assert.Single((await op.Service.ListAsync(h.HallId,h.Request.Date,h.Request.Date,1,10)).Items);
        await Assert.ThrowsAsync<ExternalBookingException>(() => op.Service.UpdateAsync(h.HallId,result.BookingId,h.Request with { Date=h.Request.Date.AddDays(1) },Guid.NewGuid().ToString(),1));
        var edited = await op.Service.UpdateAsync(h.HallId,result.BookingId,h.Request with { Notes="Owner correction" },Guid.NewGuid().ToString(),1);
        var cancelled = await op.Service.CancelAsync(h.HallId,result.BookingId,new("Customer called"),Guid.NewGuid().ToString(),edited.Revision);
        Assert.Equal("Cancelled",cancelled.Status);
        await using var db = h.Context();
        Assert.All(await db.HallSlotAvailabilities.ToArrayAsync(), x=>Assert.Equal(HallSlotStatus.Available,x.Status));
        Assert.Equal(3,await db.Set<BookingAuditEvent>().CountAsync()); Assert.Equal(2,await db.BookingSlots.CountAsync());
    }

    [Fact]
    public async Task StaleRevisionsCannotOverwrite_AndCancelledBookingsCannotBeEdited()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(); var b=await h.CreateAsync();
        await using var op=h.Operation();
        var e=await Assert.ThrowsAsync<ExternalBookingException>(()=>op.Service.UpdateAsync(h.HallId,b.BookingId,h.Request,Guid.NewGuid().ToString(),0)); Assert.Equal(428,e.StatusCode);
        var updated=await op.Service.UpdateAsync(h.HallId,b.BookingId,h.Request with {Notes="Updated"},Guid.NewGuid().ToString(),1);
        e=await Assert.ThrowsAsync<ExternalBookingException>(()=>op.Service.CancelAsync(h.HallId,b.BookingId,new(),Guid.NewGuid().ToString(),1)); Assert.Equal(412,e.StatusCode);
        await op.Service.CancelAsync(h.HallId,b.BookingId,new(),Guid.NewGuid().ToString(),updated.Revision);
        e=await Assert.ThrowsAsync<ExternalBookingException>(()=>op.Service.UpdateAsync(h.HallId,b.BookingId,h.Request,Guid.NewGuid().ToString(),3)); Assert.Equal(409,e.StatusCode);
    }

    [Fact]
    public async Task CancelAndEditReceiptsReplayWithoutAdditionalAudit_AndCreateReplayCannotResurrect()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(); var createKey=Guid.NewGuid().ToString(); var b=await h.CreateAsync(key:createKey);
        await using var op=h.Operation(); var editKey=Guid.NewGuid().ToString(); var cancelKey=Guid.NewGuid().ToString();
        var request=h.Request with {Notes="Changed"};
        var edit=await op.Service.UpdateAsync(h.HallId,b.BookingId,request,editKey,1);
        Assert.Equivalent(edit,await op.Service.UpdateAsync(h.HallId,b.BookingId,request,editKey,1));
        var cancel=await op.Service.CancelAsync(h.HallId,b.BookingId,new(),cancelKey,2);
        Assert.Equivalent(cancel,await op.Service.CancelAsync(h.HallId,b.BookingId,new(),cancelKey,2));
        await h.CreateAsync(key:createKey);
        Assert.Equal("Cancelled",(await op.Service.GetAsync(h.HallId,b.BookingId)).Status);
        await using var db=h.Context(); Assert.Equal(3,await db.Set<BookingAuditEvent>().CountAsync());
    }

    [Fact]
    public async Task ExternalProjectionAndActiveGuardsWorkWithoutAUserJoin()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(); var b=await h.CreateAsync();
        await using var db=h.Context(); var repo=new OwnerDashboardRepository(db); var slots=new BookingRepository(db);
        var row=Assert.Single((await repo.GetBookingRequestsAsync(h.HallId,"owner"))!);
        Assert.Equal("External customer",row.RequesterName); Assert.Equal(BookingSource.ExternalManual,row.Source);
        Assert.True(await slots.HasActiveBookingsOnDayAsync(h.HallId,h.Request.Date));
        Assert.True(await slots.HasActiveHourlyBookingsOutsideWindowAsync(h.HallId,new(12,0),new(18,0)));
        Assert.Single((await repo.GetActiveBookingsInRangeAsync(h.HallId,"owner",h.Request.Date,h.Request.Date))!);
        Assert.Empty(await slots.GetByRequesterAsync("owner"));
        Assert.Empty(await slots.GetPendingAcceptanceNotificationsAsync());
        Assert.Equal(0,await slots.DeleteAsync(b.BookingId));
    }

    [Fact]
    public async Task AdministrativeAndAccountLocksStillProtectHistoryAndCancellation()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(); var b=await h.CreateAsync();
        await h.ChangeHallAsync(x=>x.IsAdminLocked=true);
        await using var op=h.Operation();
        await Assert.ThrowsAsync<ExternalBookingException>(()=>op.Service.GetAsync(h.HallId,b.BookingId));
        await Assert.ThrowsAsync<ExternalBookingException>(()=>op.Service.CancelAsync(h.HallId,b.BookingId,new(),Guid.NewGuid().ToString(),1));
        h.AccountLocks.Setup(x=>x.GetLockedUntilAsync(It.IsAny<string>(),It.IsAny<CancellationToken>())).ReturnsAsync(h.Clock.Now.AddDays(1));
        await Assert.ThrowsAsync<ForbiddenException>(()=>h.CreateAsync());
    }
}

internal sealed class ExternalBookingHarness : IAsyncDisposable
{
    private readonly ServiceProvider provider;
    private readonly string? databaseName;
    private readonly string? adminConnection;
    public readonly ExternalCurrentUser Current=new();
    public readonly ExternalClock Clock=new();
    public readonly Mock<IAccountLockService> AccountLocks=new() { CallBase=true };
    public Guid HallId {get;private set;}
    public ExternalBookingRequest Request => new() {CustomerName="External customer",Phone="0599123456",EventType="wedding",Date=new(2026,11,16),SlotStarts=[new(10,0),new(11,0)]};
    public string? ConnectionString {get;}

    private ExternalBookingHarness(ServiceProvider provider,string? name,string? admin,string? connection)
        =>(this.provider,databaseName,adminConnection,ConnectionString)=(provider,name,admin,connection);

    public static async Task<ExternalBookingHarness> CreateAsync(bool postgres=false)
    {
        string? admin=null,name=null,connection=null;
        var services=new ServiceCollection();services.AddLogging();
        if(postgres)
        {
            var configured=Environment.GetEnvironmentVariable("WESAL_TEST_PG") ?? throw new InvalidOperationException("Disposable PostgreSQL is required.");
            var b=new Npgsql.NpgsqlConnectionStringBuilder(configured);
            if(b.Host is not ("localhost" or "127.0.0.1" or "::1")) throw new InvalidOperationException("Only disposable loopback PostgreSQL is allowed.");
            b.Database="postgres";admin=b.ConnectionString;name="wesal_external_"+Guid.NewGuid().ToString("N");
            await using(var c=new Npgsql.NpgsqlConnection(admin)) {await c.OpenAsync();await using var cmd=c.CreateCommand();cmd.CommandText=$"CREATE DATABASE \"{name}\"";await cmd.ExecuteNonQueryAsync();}
            b.Database=name;b.Pooling=false;connection=b.ConnectionString;
            services.AddDbContext<ApplicationDbContext>(o=>o.UseNpgsql(connection));
        }
        else
        {
            var root=new InMemoryDatabaseRoot();var memoryName=Guid.NewGuid().ToString();
            services.AddDbContext<ApplicationDbContext>(o=>o.UseInMemoryDatabase(memoryName,root).ConfigureWarnings(w=>w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
        }
        services.AddIdentityCore<ApplicationUser>().AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
        var h=new ExternalBookingHarness(services.BuildServiceProvider(),name,admin,connection);
        h.AccountLocks.Setup(x=>x.GetLockedUntilAsync(It.IsAny<string>(),It.IsAny<CancellationToken>())).ReturnsAsync((DateTimeOffset?)null);
        await using var db=h.Context();
        if(postgres) await db.Database.MigrateAsync(); else await db.Database.EnsureCreatedAsync();
        db.Users.AddRange(new ApplicationUser {Id="owner",UserName="owner",NormalizedUserName="OWNER",FullName="Owner"},new ApplicationUser {Id="new-owner",UserName="new-owner",NormalizedUserName="NEW-OWNER",FullName="Next Owner"});
        var hall=new Hall {Name="External test hall",Address="Gaza",Capacity=200,OwnerId="owner",Status=HallStatus.Approved,PaymentStatus=HallPaymentStatus.Paid,SubscriptionCycleEnd=new(2027,1,1),HourlySlotStart=new(9,0),HourlySlotEnd=new(18,0)};
        db.Halls.Add(hall);await db.SaveChangesAsync();h.HallId=hall.Id;return h;
    }

    public ApplicationDbContext Context()=>new(provider.GetRequiredService<DbContextOptions<ApplicationDbContext>>());
    public OperationScope Operation()
    {
        var scope=provider.CreateScope();var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var service=new OwnerExternalBookingService(new ExternalBookingRepository(db),new BookingRepository(db),new OwnerDashboardRepository(db),new UnitOfWork(db),Current,Clock,AccountLocks.Object,
            scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>(),new ExternalBookingRequestValidator());
        return new OperationScope(scope,db,service);
    }
    public async Task<ExternalBookingDto> CreateAsync(ExternalBookingRequest? request=null,string? key=null)
    {await using var op=Operation();return await op.Service.CreateAsync(HallId,request??Request,key??Guid.NewGuid().ToString());}
    public async Task ChangeHallAsync(Action<Hall> change) {await using var db=Context();var hall=await db.Halls.SingleAsync(x=>x.Id==HallId);change(hall);await db.SaveChangesAsync();}
    public async ValueTask DisposeAsync()
    {
        await provider.DisposeAsync();
        if(databaseName is not null) {await using var c=new Npgsql.NpgsqlConnection(adminConnection);await c.OpenAsync();await using var cmd=c.CreateCommand();cmd.CommandText=$"DROP DATABASE \"{databaseName}\" WITH (FORCE)";await cmd.ExecuteNonQueryAsync();}
    }
    internal sealed class OperationScope(IServiceScope scope,ApplicationDbContext db,OwnerExternalBookingService service):IAsyncDisposable
    {
        public ApplicationDbContext Db=>db;public OwnerExternalBookingService Service=>service;
        public UserManager<ApplicationUser> Users=>scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        public ValueTask DisposeAsync(){scope.Dispose();return ValueTask.CompletedTask;}
    }
}

internal sealed class ExternalClock : IDateTime {public DateTimeOffset Now {get;set;}=new(2026,11,15,7,30,0,TimeSpan.Zero);}
internal sealed class ExternalCurrentUser : ICurrentUserService
{
    public string Id="owner";public string Role=ApplicationRoles.HallOwner;public bool Authenticated=true;
    public string? UserId=>Id;public string? UserName=>Id;public string? Email=>null;public bool IsAuthenticated=>Authenticated;public IReadOnlyList<string> Roles=>[Role];
}
