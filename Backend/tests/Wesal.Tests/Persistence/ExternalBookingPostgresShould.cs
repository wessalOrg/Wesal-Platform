using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Persistence.Repositories;
using Wesal.Tests.Infrastructure;

namespace Wesal.Tests.Persistence;

public sealed class ExternalBookingPostgresShould
{
    [ExternalPostgresFact]
    public async Task CommittedExternalBookingPreventsDayBlockingAndWindowNarrowing()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(true);await h.CreateAsync();await using var op=h.Operation();
        var availability=new Wesal.Infrastructure.OwnerDashboard.OwnerHourlyAvailabilityService(op.Users,h.Current,
            new OwnerDashboardRepository(op.Db),new BookingRepository(op.Db),new UnitOfWork(op.Db));
        await Assert.ThrowsAsync<ConflictException>(()=>availability.SetDayBlockAsync(h.HallId,new(){Date=h.Request.Date,IsOpen=false}));
        await Assert.ThrowsAsync<ConflictException>(()=>availability.UpdateHourlySettingsAsync(h.HallId,new(){HourlySlotStart=new TimeOnly(12,0)}));
        await using var verify=h.Context();Assert.False(await verify.HallDayAvailabilities.AnyAsync(x=>!x.IsOpen));
        Assert.Equal(new TimeOnly(9,0),(await verify.Halls.SingleAsync()).HourlySlotStart);
    }

    [ExternalPostgresFact]
    public async Task MigrationPreservesExistingOnlineBookingIdentityStatusAndPayment()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(true);await using var db=h.Context();
        var migrator=db.GetService<IMigrator>();await migrator.MigrateAsync("20261019192622_AddHelpTicketAdminRead");
        var id=Guid.NewGuid();var paidAt=new DateTimeOffset(2026,10,1,9,0,0,TimeSpan.Zero);
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO wesal."Bookings" ("Id","HallId","RequesterUserId","Date","Status","NameOnBooking","DepositAmount","DepositPaymentConfirmedAt","CreatedAt")
            VALUES ({id},{h.HallId},{"existing-online-user"},{h.Request.Date},{2},{"Original online name"},{50m},{paidAt},{paidAt})
            """);
        await migrator.MigrateAsync();
        var booking=await db.Bookings.SingleAsync(x=>x.Id==id);
        Assert.Equal(BookingSource.Online,booking.Source);Assert.Equal(BookingStatus.Accepted,booking.Status);
        Assert.Equal("existing-online-user",booking.RequesterUserId);Assert.Equal("Original online name",booking.NameOnBooking);
        Assert.Equal(50m,booking.DepositAmount);Assert.Equal(paidAt,booking.DepositPaymentConfirmedAt);Assert.Equal(1,booking.Revision);
    }

    [ExternalPostgresFact]
    public async Task ParallelDuplicateEditsAndCancellations_CommitOneEventPerMutation()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(true);var b=await h.CreateAsync();
        var key=Guid.NewGuid().ToString();await using var a=h.Operation();await using var c=h.Operation();
        var edits=await Task.WhenAll(a.Service.UpdateAsync(h.HallId,b.BookingId,h.Request with {Notes="Revised"},key,1),
            c.Service.UpdateAsync(h.HallId,b.BookingId,h.Request with {Notes="Revised"},key,1));
        Assert.All(edits,x=>Assert.Equal(2,x.Revision));
        var cancelKey=Guid.NewGuid().ToString();
        var cancellations=await Task.WhenAll(a.Service.CancelAsync(h.HallId,b.BookingId,new(),cancelKey,2),c.Service.CancelAsync(h.HallId,b.BookingId,new(),cancelKey,2));
        Assert.All(cancellations,x=>Assert.Equal(3,x.Revision));
        await using var db=h.Context();Assert.Equal(3,await db.Set<BookingAuditEvent>().CountAsync());
    }

    [ExternalPostgresFact]
    public async Task ExternalBookingBlocksTheRealOnlineService_WithoutExposingItsCustomer()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(true);
        h.Clock.Now=DateTimeOffset.UtcNow;var date=DateOnly.FromDateTime(h.Clock.Now.UtcDateTime).AddDays(2);
        await h.ChangeHallAsync(x=>{x.SubscriptionCycleEnd=date.AddDays(90);x.ShowBookedSlots=true;});
        await h.CreateAsync(h.Request with {Date=date});
        h.Current.Role=Wesal.Domain.Constants.ApplicationRoles.RegisteredUser;h.Current.Id="online-user";
        await using var db=h.Context();
        var service=new Wesal.Infrastructure.Bookings.HourlySlotService(new HallRepository(db),new BookingRepository(db),new UnitOfWork(db),h.Current,
            new Wesal.Tests.TestDoubles.RecordingOwnerBookingRequestNotifier(),new Wesal.Tests.TestDoubles.RecordingNotificationDispatcher());
        await Assert.ThrowsAsync<ConflictException>(()=>service.CreateHourlyBookingAsync(new Wesal.Application.Common.Models.HourlyBookingRequestDto {
            HallId=h.HallId,Date=date,SlotStarts=h.Request.SlotStarts,NameOnBooking="Online user",RequesterName="Online user"}));
        var catalog=await service.GetHourlyCatalogAsync(h.HallId,date);
        var json=System.Text.Json.JsonSerializer.Serialize(catalog);
        Assert.DoesNotContain("External customer",json);Assert.DoesNotContain("0599123456",json);
        Assert.Contains(catalog.Slots,x=>x.StartTime==new TimeOnly(10,0)&&x.Status==HallSlotStatus.Booked);
    }

    [ExternalPostgresFact]
    public async Task ParallelExternalCreates_OnlyOneCanOwnTheHours()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(true);
        var results=await Task.WhenAll(Attempt(()=>h.CreateAsync()),Attempt(()=>h.CreateAsync()));
        Assert.Equal(1,results.Count(x=>x));
        await using var db=h.Context();Assert.Single(await db.Bookings.ToListAsync());
        Assert.Equal(2,await db.HallSlotAvailabilities.CountAsync(x=>x.Status==HallSlotStatus.Booked));
    }

    [ExternalPostgresFact]
    public async Task ParallelDuplicateCreates_ReturnOnePersistentBookingAndReceipt()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(true);var key=Guid.NewGuid().ToString();
        var results=await Task.WhenAll(h.CreateAsync(key:key),h.CreateAsync(key:key));
        Assert.Equal(results[0].BookingId,results[1].BookingId);
        await using var db=h.Context();Assert.Single(await db.Set<BookingAuditEvent>().ToListAsync());Assert.Single(await db.Set<BookingMutationReceipt>().ToListAsync());
    }

    [ExternalPostgresFact]
    public async Task FailedReschedule_RollsBackAllNewClaims_AndPreservesOriginalDetailsAndAudit()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(true);var original=await h.CreateAsync();
        await h.CreateAsync(h.Request with {SlotStarts=[new(14,0)]});
        await using var op=h.Operation();
        await Assert.ThrowsAsync<ExternalBookingException>(()=>op.Service.UpdateAsync(h.HallId,original.BookingId,h.Request with {SlotStarts=[new(13,0),new(14,0)],CustomerName="Changed"},Guid.NewGuid().ToString(),1));
        await using var db=h.Context();var b=await db.Bookings.Include(x=>x.Slots).Include(x=>x.ExternalDetails).SingleAsync(x=>x.Id==original.BookingId);
        Assert.Equal(1,b.Revision);Assert.Equal("External customer",b.ExternalDetails!.CustomerName);
        Assert.Equal(new[]{new TimeOnly(10,0),new TimeOnly(11,0)},b.Slots.OrderBy(x=>x.StartTime).Select(x=>x.StartTime));
        Assert.False(await db.HallSlotAvailabilities.AnyAsync(x=>x.StartTime==new TimeOnly(13,0)));
        Assert.Equal(1,await db.Set<BookingAuditEvent>().CountAsync(x=>x.BookingId==b.Id));
    }

    [ExternalPostgresFact]
    public async Task Reschedule_RetainsIntersectionAndReleasesOnlyObsoleteHours()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(true);var original=await h.CreateAsync();
        await using var op=h.Operation();
        await op.Service.UpdateAsync(h.HallId,original.BookingId,h.Request with {SlotStarts=[new(11,0),new(12,0)]},Guid.NewGuid().ToString(),1);
        await using var db=h.Context();var slots=await db.HallSlotAvailabilities.OrderBy(x=>x.StartTime).ToListAsync();
        Assert.Equal(HallSlotStatus.Available,slots[0].Status);Assert.All(slots.Skip(1),x=>Assert.Equal(HallSlotStatus.Booked,x.Status));
    }

    [ExternalPostgresFact]
    public async Task ParallelUpdateAndCancel_HaveOneRevisionWinner()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(true);var original=await h.CreateAsync();
        await using var a=h.Operation();await using var b=h.Operation();
        var results=await Task.WhenAll(Attempt(()=>a.Service.UpdateAsync(h.HallId,original.BookingId,h.Request with {Notes="Changed"},Guid.NewGuid().ToString(),1)),
            Attempt(()=>b.Service.CancelAsync(h.HallId,original.BookingId,new(),Guid.NewGuid().ToString(),1)));
        Assert.Equal(1,results.Count(x=>x));await using var db=h.Context();Assert.Equal(2,await db.Set<BookingAuditEvent>().CountAsync());
    }

    [ExternalPostgresFact]
    public async Task CancelAfterExpiryAndRebook_LeavesCompleteHistory()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(true);var original=await h.CreateAsync();
        await h.ChangeHallAsync(x=>{x.SystemLocked=true;x.SubscriptionCycleEnd=new(2026,1,1);});
        await using(var op=h.Operation()) await op.Service.CancelAsync(h.HallId,original.BookingId,new("Customer called"),Guid.NewGuid().ToString(),1);
        await h.ChangeHallAsync(x=>{x.SystemLocked=false;x.SubscriptionCycleEnd=new(2027,1,1);});
        var next=await h.CreateAsync();Assert.NotEqual(original.BookingId,next.BookingId);
        await using var db=h.Context();Assert.Equal(2,await db.Bookings.CountAsync());Assert.Equal(4,await db.BookingSlots.CountAsync());Assert.Equal(3,await db.Set<BookingAuditEvent>().CountAsync());
    }

    [ExternalPostgresFact]
    public async Task DayBlockCommittedWhileWaiting_IsObservedUnderTheSharedLock()
        => await WaitingMutation("day");
    [ExternalPostgresFact]
    public async Task WorkingWindowCommittedWhileWaiting_IsObservedUnderTheSharedLock()
        => await WaitingMutation("window");
    [ExternalPostgresFact]
    public async Task AdministrativeLockCommittedWhileWaiting_IsObservedUnderTheSharedLock()
        => await WaitingMutation("admin");

    private static async Task WaitingMutation(string kind)
    {
        await using var h=await ExternalBookingHarness.CreateAsync(true);
        await using var writer=h.Context();await using var tx=await writer.Database.BeginTransactionAsync();
        Assert.True(await new BookingRepository(writer).LockHallForAvailabilityChangeAsync(h.HallId));
        if(kind=="day") await new BookingRepository(writer).SetDayOpenAsync(h.HallId,h.Request.Date,false);
        else {var hall=await writer.Halls.SingleAsync();if(kind=="admin")hall.IsAdminLocked=true;else hall.HourlySlotStart=new(12,0);await writer.SaveChangesAsync();}
        var create=h.CreateAsync();await WaitForLock(h.ConnectionString!);
        await tx.CommitAsync();await Assert.ThrowsAsync<ExternalBookingException>(()=>create);
        await using var verify=h.Context();Assert.Empty(await verify.Bookings.ToListAsync());
    }

    [ExternalPostgresFact]
    public async Task OnlineAndExternalClaimsUseTheSameHallLockAndUniqueSlotConstraint()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(true);
        await using var online=h.Context();await using var tx=await online.Database.BeginTransactionAsync();var repo=new BookingRepository(online);
        Assert.True(await repo.LockHallForAvailabilityChangeAsync(h.HallId));
        Assert.Equal(2,await repo.ReserveHourlySlotsAsync(h.HallId,h.Request.Date,h.Request.SlotStarts));
        await repo.AddAsync(new Booking {HallId=h.HallId,RequesterUserId="online-customer",Date=h.Request.Date,Slots=h.Request.SlotStarts.Select(x=>new BookingSlot {StartTime=x,EndTime=x.AddHours(1)}).ToList()});
        var create=h.CreateAsync();await WaitForLock(h.ConnectionString!);await tx.CommitAsync();
        await Assert.ThrowsAsync<ExternalBookingException>(()=>create);
        await using var verify=h.Context();Assert.All(await verify.HallSlotAvailabilities.ToListAsync(),x=>Assert.Equal(HallSlotStatus.Reserved,x.Status));
    }

    [ExternalPostgresFact]
    public async Task AuditCannotBeMutatedOrCascadeDeleted_AndOnlineRepositoryCannotDeleteExternal()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(true);var original=await h.CreateAsync();
        await using var db=h.Context();Assert.Equal(0,await new BookingRepository(db).DeleteAsync(original.BookingId));
        await Assert.ThrowsAsync<Npgsql.PostgresException>(()=>db.Database.ExecuteSqlRawAsync("DELETE FROM wesal.\"BookingAuditEvents\""));
        await Assert.ThrowsAsync<Npgsql.PostgresException>(()=>db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM wesal.\"Bookings\" WHERE \"Id\"={original.BookingId}"));
    }

    [ExternalPostgresFact]
    public async Task SourceConstraintsRejectFakeRequesterAndDeposit_AndKeepOnlineDefaults()
    {
        await using var h=await ExternalBookingHarness.CreateAsync(true);var original=await h.CreateAsync();
        await using var db=h.Context();
        await Assert.ThrowsAsync<Npgsql.PostgresException>(()=>db.Database.ExecuteSqlInterpolatedAsync($"UPDATE wesal.\"Bookings\" SET \"RequesterUserId\"='owner' WHERE \"Id\"={original.BookingId}"));
        await Assert.ThrowsAsync<Npgsql.PostgresException>(()=>db.Database.ExecuteSqlInterpolatedAsync($"UPDATE wesal.\"Bookings\" SET \"DepositPaymentConfirmedAt\"=now() WHERE \"Id\"={original.BookingId}"));
        db.Bookings.Add(new Booking{HallId=h.HallId,RequesterUserId="online",Date=h.Request.Date.AddDays(1)});await db.SaveChangesAsync();
        Assert.Equal(BookingSource.Online,(await db.Bookings.SingleAsync(x=>x.RequesterUserId=="online")).Source);
    }

    private static async Task<bool> Attempt(Func<Task<ExternalBookingDto>> operation)
    {try{await operation();return true;}catch(ExternalBookingException){return false;}}

    private static async Task WaitForLock(string connection)
    {
        await using var c=new Npgsql.NpgsqlConnection(connection);await c.OpenAsync();
        using var deadline=new CancellationTokenSource(TimeSpan.FromSeconds(10));
        while(true)
        {
            await using var cmd=c.CreateCommand();cmd.CommandText="SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND cardinality(pg_blocking_pids(pid))>0)";
            if((bool)(await cmd.ExecuteScalarAsync(deadline.Token))!)return;
            await Task.Delay(20,deadline.Token);
        }
    }
}

internal sealed class ExternalPostgresFactAttribute:FactAttribute
{
    public ExternalPostgresFactAttribute()
    {if(string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("WESAL_TEST_PG")))Skip="Requires an explicitly disposable loopback PostgreSQL server.";}
}
