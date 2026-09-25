using System.Reflection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;
using Wesal.Infrastructure.Halls;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence.Data;
using Wesal.Persistence.Migrations;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class DayBlockHardeningShould : IDisposable
{
    private const string BlockedDayMessage = "The hall is not available on";

    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public DayBlockHardeningShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
        services.AddIdentityCore<ApplicationUser>(o =>
        {
            o.Password.RequireDigit = true;
            o.Password.RequireLowercase = true;
            o.Password.RequireUppercase = true;
            o.Password.RequireNonAlphanumeric = true;
            o.Password.RequiredLength = 8;
            o.User.RequireUniqueEmail = true;
        }).AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
        services.AddLogging();
        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
        var roleManager = _provider.GetRequiredService<RoleManager<ApplicationRole>>();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.HallOwner)).GetAwaiter().GetResult();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.RegisteredUser)).GetAwaiter().GetResult();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
    }

    private async Task<ApplicationUser> CreateUserAsync(string email, string phone, string role)
    {
        var user = new ApplicationUser
        {
            FullName = "Test User",
            Email = email,
            UserName = email,
            PhoneNumber = phone
        };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded)
        {
            throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        }

        await _userManager.AddToRoleAsync(user, role);
        return user;
    }

    private Hall AddHall(
        string ownerId,
        bool showBookedSlots = true,
        string name = "Grand Hall",
        TimeOnly? windowStart = null,
        TimeOnly? windowEnd = null)
    {
        var hall = new Hall
        {
            Name = name,
            Address = "Al-Rashid Street, Gaza",
            Region = HallRegion.Gaza,
            Capacity = 200,
            Price = 1500,
            ShowPrice = true,
            ContactPhone = "+970599111111",
            Description = "Spacious hall",
            OwnerId = ownerId,
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            IsDeleted = false,
            ShowBookedSlots = showBookedSlots,
            HourlySlotStart = windowStart ?? new TimeOnly(9, 0),
            HourlySlotEnd = windowEnd ?? new TimeOnly(18, 0)
        };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private static DateOnly Tomorrow() => DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);

    private static DateOnly InDays(int days) => DateOnly.FromDateTime(DateTime.UtcNow).AddDays(days);

    private void BlockDay(Hall hall, DateOnly date)
    {
        _context.HallDayAvailabilities.Add(new HallDayAvailability
        {
            HallId = hall.Id,
            Date = date,
            IsOpen = false
        });
        _context.SaveChanges();
    }

    private void AddSlot(Hall hall, DateOnly date, TimeOnly start, HallSlotStatus status)
    {
        _context.HallSlotAvailabilities.Add(new HallSlotAvailability
        {
            HallId = hall.Id,
            Date = date,
            StartTime = start,
            Status = status
        });
        _context.SaveChanges();
    }

    private Booking AddHourlyBooking(Hall hall, DateOnly date, TimeOnly slotStart, BookingStatus status)
    {
        var booking = new Booking
        {
            HallId = hall.Id,
            RequesterUserId = "seeker-1",
            Date = date,
            NameOnBooking = "Layla Hassan",
            Slots =
            [
                new BookingSlot
                {
                    StartTime = slotStart,
                    EndTime = slotStart.AddHours(1)
                }
            ],
            Status = status
        };
        _context.Bookings.Add(booking);
        _context.SaveChanges();
        return booking;
    }

    private BookingRepository BookingRepo() => new(_context);

    private HallRepository HallRepo() => new(_context);

    private UnitOfWork UnitOfWork() => new(_context);

    private HourlySlotService Hourly(string seekerId)
        => new(
            HallRepo(),
            BookingRepo(),
            UnitOfWork(),
            new FakeCurrentUser(seekerId, true, ApplicationRoles.RegisteredUser));

    private OwnerHourlyAvailabilityService OwnerHourly(string ownerId)
        => new(
            _userManager,
            new FakeCurrentUser(ownerId, true, ApplicationRoles.HallOwner),
            new OwnerDashboardRepository(_context),
            BookingRepo(),
            UnitOfWork());

    private HallDetailsService HallDetails()
        => new(
            HallRepo(),
            new FakeCurrentUser(null, false),
            new FakeDateTime(DateTimeOffset.UtcNow),
            Hourly("seeker-1"),
            _provider.GetRequiredService<ILoggerFactory>().CreateLogger<HallDetailsService>());

    private HallSearchService Search() => new(HallRepo());

    private static HourlyBookingRequestDto HourlyRequest(
        Guid hallId,
        DateOnly date,
        string name = "Layla Hassan")
        => new()
        {
            HallId = hallId,
            Date = date,
            SlotStarts = [new TimeOnly(10, 0)],
            NameOnBooking = name,
            RequesterName = "Layla"
        };

    [Fact]
    public async Task HourlyBookingRequest_OnBlockedDay_IsRejectedWithTheDayGateConflict()
    {
        var owner = await CreateUserAsync("bypass1@example.com", "+970599300001", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("bypass2@example.com", "+970599300002", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        BlockDay(hall, date);
        AddSlot(hall, date, new TimeOnly(10, 0), HallSlotStatus.Available);

        var exception = await Assert.ThrowsAsync<ConflictException>(() =>
            Hourly(seeker.Id).CreateHourlyBookingAsync(HourlyRequest(hall.Id, date)));

        Assert.Contains(BlockedDayMessage, exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(date.ToString("yyyy-MM-dd"), exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task HourlyBookingRequest_OnBlockedDay_WritesNoBookingAndLeavesTheSlotAvailable()
    {
        var owner = await CreateUserAsync("bypass3@example.com", "+970599300003", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("bypass4@example.com", "+970599300004", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        BlockDay(hall, date);
        AddSlot(hall, date, new TimeOnly(10, 0), HallSlotStatus.Available);

        await Assert.ThrowsAsync<ConflictException>(() =>
            Hourly(seeker.Id).CreateHourlyBookingAsync(HourlyRequest(hall.Id, date)));

        Assert.Empty(await _context.Bookings.ToListAsync());
        var slot = await _context.HallSlotAvailabilities.SingleAsync();
        Assert.Equal(HallSlotStatus.Available, slot.Status);
    }

    [Fact]
    public async Task HourlyBookingRequest_OnOpenDay_PersistsTheNameAndSlot()
    {
        var owner = await CreateUserAsync("open1@example.com", "+970599300005", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("open2@example.com", "+970599300006", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();

        var result = await Hourly(seeker.Id).CreateHourlyBookingAsync(
            HourlyRequest(hall.Id, date, "Nour Al-Abed"));

        Assert.Equal(BookingStatus.Pending, result.Status);
        var booking = Assert.Single(await _context.Bookings.ToListAsync());
        Assert.Equal("Nour Al-Abed", booking.NameOnBooking);
        Assert.Equal(new TimeOnly(10, 0), Assert.Single(booking.Slots).StartTime);
    }

    [Fact]
    public async Task HourlyCatalog_BlockedDay_IsDisclosedAsClosedWhenShowBookedSlotsIsOn()
    {
        var owner = await CreateUserAsync("cat1@example.com", "+970599300011", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, showBookedSlots: true);
        var date = Tomorrow();
        BlockDay(hall, date);

        var catalog = await Hourly("seeker-1").GetHourlyCatalogAsync(hall.Id, date);

        Assert.False(catalog.DayOpen);
        Assert.Empty(catalog.Slots);
    }

    [Fact]
    public async Task HourlyCatalog_BlockedDayWithShowBookedSlotsOff_IsIndistinguishableFromAFullyBookedDay()
    {
        var owner = await CreateUserAsync("cat2@example.com", "+970599300012", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, showBookedSlots: false);
        var blockedDate = InDays(1);
        var fullyBookedDate = InDays(2);
        BlockDay(hall, blockedDate);

        for (var hour = 9; hour < 18; hour++)
        {
            AddSlot(hall, fullyBookedDate, new TimeOnly(hour, 0), HallSlotStatus.Booked);
        }

        var service = Hourly("seeker-1");
        var blocked = await service.GetHourlyCatalogAsync(hall.Id, blockedDate);
        var fullyBooked = await service.GetHourlyCatalogAsync(hall.Id, fullyBookedDate);

        Assert.Equal(fullyBooked.DayOpen, blocked.DayOpen);
        Assert.Equal(fullyBooked.Slots.Count, blocked.Slots.Count);
        Assert.Empty(blocked.Slots);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task Calendar_DisclosesABlockedDayOnlyWhenShowBookedSlotsIsOn(
        bool showBookedSlots,
        bool expectedIsOpen)
    {
        var owner = await CreateUserAsync("cal@example.com", "+970599300013", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, showBookedSlots: showBookedSlots);
        var date = Tomorrow();
        BlockDay(hall, date);

        var calendar = await Hourly("seeker-1").GetAvailabilityCalendarAsync(hall.Id, date, date);

        var day = Assert.Single(calendar.Days);
        Assert.Equal(expectedIsOpen, day.IsOpen);
    }

    [Fact]
    public async Task Search_ExcludesAHallWhoseDateIsBlocked()
    {
        var owner = await CreateUserAsync("search1@example.com", "+970599300014", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, name: "Searchable Hall");
        var date = Tomorrow();

        var before = await Search().SearchHallsAsync(new HallSearchRequest { Date = date });
        Assert.Single(before.Items);

        BlockDay(hall, date);

        var after = await Search().SearchHallsAsync(new HallSearchRequest { Date = date });
        Assert.Empty(after.Items);
        Assert.Equal(0, after.TotalCount);
    }

    [Fact]
    public async Task Search_StillReturnsTheHallForADateThatIsNotBlocked()
    {
        var owner = await CreateUserAsync("search2@example.com", "+970599300015", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, name: "Searchable Hall");
        BlockDay(hall, InDays(3));

        var result = await Search().SearchHallsAsync(new HallSearchRequest { Date = Tomorrow() });

        Assert.Single(result.Items);
    }

    [Fact]
    public async Task HallDetails_HidesTheSlotsOfABlockedDay()
    {
        var owner = await CreateUserAsync("details1@example.com", "+970599300017", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        BlockDay(hall, date);

        var details = await HallDetails().GetHallDetailsAsync(hall.Id);

        var day = Assert.Single(details.Availability, candidate => candidate.Date == date);
        Assert.Empty(day.Slots);
    }

    [Fact]
    public async Task HallDetails_LeavesUnblockedDaysBookable()
    {
        var owner = await CreateUserAsync("details2@example.com", "+970599300018", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        BlockDay(hall, InDays(5));

        var details = await HallDetails().GetHallDetailsAsync(hall.Id);

        Assert.NotEmpty(details.Availability);
        Assert.All(
            details.Availability.Where(day => day.Date != InDays(5)),
            day => Assert.Contains(day.Slots, slot => slot.Status == HallSlotStatus.Available));
    }

    [Fact]
    public async Task OwnerDayBlock_PersistsAClosedDay()
    {
        var owner = await CreateUserAsync("ownerview1@example.com", "+970599300019", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var service = OwnerHourly(owner.Id);

        await service.SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = false });

        var gate = await _context.HallDayAvailabilities
            .AsNoTracking()
            .SingleAsync(day => day.HallId == hall.Id && day.Date == date);
        Assert.False(gate.IsOpen);
    }

    [Fact]
    public async Task OwnerDayBlock_KeepsTheGateVisibleToThePersistenceLayerWhileSeekersSeeTheDayAsOpen()
    {
        var owner = await CreateUserAsync("ownerview2@example.com", "+970599300020", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, showBookedSlots: false);
        var date = Tomorrow();

        await OwnerHourly(owner.Id).SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = false });

        var seekerCalendar = await Hourly("seeker-1").GetAvailabilityCalendarAsync(hall.Id, date, date);
        Assert.True(Assert.Single(seekerCalendar.Days).IsOpen);
        var gate = await _context.HallDayAvailabilities
            .AsNoTracking()
            .SingleAsync(day => day.HallId == hall.Id && day.Date == date);
        Assert.False(gate.IsOpen);
    }

    [Fact]
    public async Task DayBlock_ThatWouldOrphanAnActiveBooking_IsRejectedWithoutPersistingTheGate()
    {
        var owner = await CreateUserAsync("atomic1@example.com", "+970599300021", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        AddHourlyBooking(hall, date, new TimeOnly(10, 0), BookingStatus.Accepted);

        await Assert.ThrowsAsync<ConflictException>(() =>
            OwnerHourly(owner.Id).SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = false }));

        Assert.Empty(await _context.HallDayAvailabilities.ToListAsync());
    }

    [Fact]
    public async Task DayBlock_AndBookingCreation_KeepTheSameDayUnbookable()
    {
        var owner = await CreateUserAsync("atomic2@example.com", "+970599300022", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("atomic3@example.com", "+970599300023", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();

        await OwnerHourly(owner.Id).SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = false });

        await Assert.ThrowsAsync<ConflictException>(() =>
            Hourly(seeker.Id).CreateHourlyBookingAsync(HourlyRequest(hall.Id, date)));

        Assert.Empty(await _context.Bookings.ToListAsync());
    }

    [Fact]
    public async Task NarrowingTheHourlyWindow_IsRejectedWhenItWouldStrandAnActiveBooking()
    {
        var owner = await CreateUserAsync("window1@example.com", "+970599300024", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, windowStart: new TimeOnly(9, 0), windowEnd: new TimeOnly(18, 0));
        AddHourlyBooking(hall, Tomorrow(), new TimeOnly(17, 0), BookingStatus.Pending);

        await Assert.ThrowsAsync<ConflictException>(() =>
            OwnerHourly(owner.Id).UpdateHourlySettingsAsync(
                hall.Id,
                new UpdateOwnerHourlySettingsRequest { HourlySlotEnd = new TimeOnly(16, 0) }));

        var persisted = await _context.Halls.AsNoTracking().SingleAsync();
        Assert.Equal(new TimeOnly(18, 0), persisted.HourlySlotEnd);
    }

    [Fact]
    public async Task NarrowingTheHourlyWindow_IsRejectedWhenItWouldStrandAnAcceptedBooking()
    {
        var owner = await CreateUserAsync("window2@example.com", "+970599300025", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, windowStart: new TimeOnly(9, 0), windowEnd: new TimeOnly(18, 0));
        AddHourlyBooking(hall, Tomorrow(), new TimeOnly(9, 0), BookingStatus.Accepted);

        await Assert.ThrowsAsync<ConflictException>(() =>
            OwnerHourly(owner.Id).UpdateHourlySettingsAsync(
                hall.Id,
                new UpdateOwnerHourlySettingsRequest { HourlySlotStart = new TimeOnly(10, 0) }));
    }

    [Fact]
    public async Task NarrowingTheHourlyWindow_SucceedsWhenNoActiveBookingWouldBeStranded()
    {
        var owner = await CreateUserAsync("window3@example.com", "+970599300026", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, windowStart: new TimeOnly(9, 0), windowEnd: new TimeOnly(18, 0));
        AddHourlyBooking(hall, Tomorrow(), new TimeOnly(10, 0), BookingStatus.Pending);

        var updated = await OwnerHourly(owner.Id).UpdateHourlySettingsAsync(
            hall.Id,
            new UpdateOwnerHourlySettingsRequest
            {
                HourlySlotStart = new TimeOnly(9, 0),
                HourlySlotEnd = new TimeOnly(12, 0)
            });

        Assert.Equal(new TimeOnly(12, 0), updated.HourlySlotEnd);
    }

    [Theory]
    [InlineData(BookingStatus.Cancelled)]
    [InlineData(BookingStatus.Rejected)]
    public async Task NarrowingTheHourlyWindow_IgnoresBookingsThatAreNoLongerLive(BookingStatus status)
    {
        var owner = await CreateUserAsync($"window-{status}@example.com", "+970599300027", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, windowStart: new TimeOnly(9, 0), windowEnd: new TimeOnly(18, 0));
        AddHourlyBooking(hall, Tomorrow(), new TimeOnly(17, 0), status);

        var updated = await OwnerHourly(owner.Id).UpdateHourlySettingsAsync(
            hall.Id,
            new UpdateOwnerHourlySettingsRequest { HourlySlotEnd = new TimeOnly(16, 0) });

        Assert.Equal(new TimeOnly(16, 0), updated.HourlySlotEnd);
    }

    [Fact]
    public async Task TogglingShowBookedSlotsAlone_NeverHitsTheStrandingGuard()
    {
        var owner = await CreateUserAsync("toggle1@example.com", "+970599300029", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, windowStart: new TimeOnly(9, 0), windowEnd: new TimeOnly(18, 0));
        AddHourlyBooking(hall, Tomorrow(), new TimeOnly(17, 0), BookingStatus.Pending);

        var updated = await OwnerHourly(owner.Id).UpdateHourlySettingsAsync(
            hall.Id,
            new UpdateOwnerHourlySettingsRequest { ShowBookedSlots = false });

        Assert.False(updated.ShowBookedSlots);
        Assert.Equal(new TimeOnly(18, 0), updated.HourlySlotEnd);
    }

    [Fact]
    public void ANewHallDefaultsToShowingBookedSlots()
    {
        var hall = new Hall();

        Assert.True(hall.ShowBookedSlots);
    }

    [Fact]
    public void TheDefaultAlignmentMigration_ChangesOnlyTheColumnDefaultAndNeverRewritesRows()
    {
        var builder = new MigrationBuilder("Npgsql.EntityFrameworkCore.PostgreSQL");
        var migration = new AlignHallsShowBookedSlotsDefault();

        typeof(Migration)
            .GetMethod("Up", BindingFlags.Instance | BindingFlags.NonPublic)!
            .Invoke(migration, [builder]);

        var operation = Assert.Single(builder.Operations);
        var alter = Assert.IsType<AlterColumnOperation>(operation);
        Assert.Equal("ShowBookedSlots", alter.Name);
        Assert.Equal("Halls", alter.Table);
        Assert.Equal(true, alter.DefaultValue);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    private sealed class FakeDateTime : IDateTime
    {
        private readonly DateTimeOffset _now;

        public FakeDateTime(DateTimeOffset now) => _now = now;

        public DateTimeOffset Now => _now;
    }

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        private readonly string[] _roles;

        public FakeCurrentUser(string? userId, bool authenticated, params string[] roles)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
            _roles = roles.Length > 0 ? roles : [ApplicationRoles.HallOwner];
        }

        public string? UserId { get; }
        public string? UserName => "test";
        public string? Email => "test@example.com";
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles => _roles;
    }
}
