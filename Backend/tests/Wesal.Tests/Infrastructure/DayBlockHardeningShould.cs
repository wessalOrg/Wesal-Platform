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

/// <summary>
/// WESAL-TASK-1 hardening regression suite for the day-block gate.
///
/// The bug this locks down: a whole-day owner block was only honoured by the hourly
/// booking endpoint. The legacy two-period endpoint never consulted the day gate at all,
/// so a seeker could book a day the owner had explicitly closed simply by calling
/// POST /api/v1/bookings, and every legacy read surface still advertised the day as
/// bookable. A blocked day must now be treated exactly like a fully-booked day through
/// every endpoint, and must stay completely invisible to seekers when the hall has
/// "hide booked days/hours" (ShowBookedSlots) turned off.
///
/// Real repositories over an in-memory database, matching the rest of the WESAL-TASK-1
/// suites, so the SQL-level day-gate and availability queries are the ones the API runs.
/// </summary>
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

    // ---------- harness ----------

    private async Task<ApplicationUser> CreateUserAsync(string email, string phone, string role)
    {
        var user = new ApplicationUser { FullName = "Test User", Email = email, UserName = email, PhoneNumber = phone };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
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

        // Legacy two-period configuration; the legacy path refuses periods a hall does not offer.
        _context.HallBookingPeriods.Add(new HallBookingPeriod
        {
            HallId = hall.Id,
            Type = BookingPeriodType.FirstPeriod,
            StartTime = new TimeOnly(9, 0),
            EndTime = new TimeOnly(15, 0)
        });
        _context.HallBookingPeriods.Add(new HallBookingPeriod
        {
            HallId = hall.Id,
            Type = BookingPeriodType.SecondPeriod,
            StartTime = new TimeOnly(15, 0),
            EndTime = new TimeOnly(22, 0)
        });
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
            SlotStart = slotStart,
            NameOnBooking = "Layla Hassan",
            Period = BookingPeriodType.FirstPeriod,
            Status = status
        };
        _context.Bookings.Add(booking);
        _context.SaveChanges();
        return booking;
    }

    private BookingRepository BookingRepo() => new(_context);
    private HallRepository HallRepo() => new(_context);
    private UnitOfWork UnitOfWork() => new(_context);

    private BookingRequestService LegacyBooking(string seekerId)
        => new(HallRepo(), new FakeCurrentUser(seekerId, true, ApplicationRoles.RegisteredUser),
            BookingRepo(), UnitOfWork(), new NoopNotifier());

    private HourlySlotService Hourly(string seekerId)
        => new(HallRepo(), BookingRepo(), UnitOfWork(),
            new FakeCurrentUser(seekerId, true, ApplicationRoles.RegisteredUser));

    private OwnerHourlyAvailabilityService OwnerHourly(string ownerId)
        => new(_userManager, new FakeCurrentUser(ownerId, true, ApplicationRoles.HallOwner),
            new OwnerDashboardRepository(_context), BookingRepo(), UnitOfWork());

    private OwnerAvailabilityService OwnerAvailability(string ownerId)
        => new(_userManager, new FakeCurrentUser(ownerId, true, ApplicationRoles.HallOwner),
            new OwnerDashboardRepository(_context), HallRepo(), BookingRepo(), UnitOfWork());

    private HallAvailabilityService LegacyAvailability()
        => new(HallRepo(), _provider.GetRequiredService<ILoggerFactory>().CreateLogger<HallAvailabilityService>());

    private HallDetailsService HallDetails()
        => new(HallRepo(), new FakeCurrentUser(null, false),
            new FakeDateTime(DateTimeOffset.UtcNow),
            _provider.GetRequiredService<ILoggerFactory>().CreateLogger<HallDetailsService>());

    private HallSearchService Search() => new(HallRepo());

    private static BookingRequestDto LegacyRequest(Guid hallId, DateOnly date, string name = "Layla Hassan")
        => new()
        {
            HallId = hallId,
            Date = date,
            Periods = [BookingPeriodType.FirstPeriod],
            NameOnBooking = name
        };

    // =====================================================================
    // BUG 1a - the critical bypass: a blocked day must be unbookable
    //          through the LEGACY endpoint exactly as through the hourly one
    // =====================================================================

    [Fact]
    public async Task LegacyBookingRequest_OnBlockedDay_IsRejectedWithTheSameConflictAsTheHourlyPath()
    {
        var owner = await CreateUserAsync("bypass1@example.com", "+970599300001", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("bypass2@example.com", "+970599300002", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        BlockDay(hall, date);
        AddSlot(hall, date, new TimeOnly(10, 0), HallSlotStatus.Available);

        var legacy = await Assert.ThrowsAsync<ConflictException>(() =>
            LegacyBooking(seeker.Id).CreateBookingRequestAsync(LegacyRequest(hall.Id, date)));

        var hourly = await Assert.ThrowsAsync<ConflictException>(() =>
            Hourly(seeker.Id).CreateHourlyBookingAsync(new HourlyBookingRequestDto
            {
                HallId = hall.Id,
                Date = date,
                SlotStart = new TimeOnly(10, 0),
                NameOnBooking = "Layla Hassan",
                RequesterName = "Layla"
            }));

        // Identical treatment, not merely "both failed".
        Assert.Equal(hourly.Message, legacy.Message);
        Assert.Contains(BlockedDayMessage, legacy.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(date.ToString("yyyy-MM-dd"), legacy.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task LegacyBookingRequest_OnBlockedDay_WritesNoBookingAndLeavesThePeriodAvailable()
    {
        var owner = await CreateUserAsync("bypass3@example.com", "+970599300003", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("bypass4@example.com", "+970599300004", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        BlockDay(hall, date);

        await Assert.ThrowsAsync<ConflictException>(() =>
            LegacyBooking(seeker.Id).CreateBookingRequestAsync(LegacyRequest(hall.Id, date)));

        Assert.Empty(await _context.Bookings.ToListAsync());

        // The legacy period must not have been reserved as a side effect.
        Assert.Empty(await _context.HallAvailabilities.ToListAsync());
    }

    [Fact]
    public async Task LegacyBookingRequest_OnOpenDay_StillSucceedsAndPersistsTheName()
    {
        var owner = await CreateUserAsync("open1@example.com", "+970599300005", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("open2@example.com", "+970599300006", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();

        var result = await LegacyBooking(seeker.Id)
            .CreateBookingRequestAsync(LegacyRequest(hall.Id, date, "Nour Al-Abed"));

        Assert.Equal(BookingStatus.Pending, result.Status);
        var booking = Assert.Single(await _context.Bookings.ToListAsync());
        Assert.Equal("Nour Al-Abed", booking.NameOnBooking);
        Assert.Equal(BookingPeriodType.FirstPeriod, booking.Period);
    }

    [Fact]
    public async Task LegacyPreFlightValidation_OnBlockedDay_IsRejectedSoSeekersAreNotToldItIsValid()
    {
        var owner = await CreateUserAsync("preflight1@example.com", "+970599300007", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("preflight2@example.com", "+970599300008", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        BlockDay(hall, date);

        await Assert.ThrowsAsync<ConflictException>(() =>
            LegacyBooking(seeker.Id).ValidateBookingRequestAsync(LegacyRequest(hall.Id, date)));
    }

    [Fact]
    public void LegacyBookingValidator_RequiresTheNameOnBooking()
    {
        var validator = new BookingRequestDtoValidator();

        var missing = validator.Validate(LegacyRequest(Guid.NewGuid(), Tomorrow(), string.Empty));
        Assert.False(missing.IsValid);
        Assert.Contains(missing.Errors, error => error.PropertyName == nameof(BookingRequestDto.NameOnBooking));

        var tooLong = validator.Validate(LegacyRequest(Guid.NewGuid(), Tomorrow(), new string('x', 101)));
        Assert.False(tooLong.IsValid);
        Assert.Contains(tooLong.Errors, error => error.PropertyName == nameof(BookingRequestDto.NameOnBooking));

        var valid = validator.Validate(LegacyRequest(Guid.NewGuid(), Tomorrow(), "Layla Hassan"));
        Assert.True(valid.IsValid);
    }

    // =====================================================================
    // BUG 2 - an omitted isOpen must never silently re-open a blocked day
    // =====================================================================

    [Fact]
    public async Task DayBlockRequest_WithoutIsOpen_IsRejectedAndLeavesTheDayBlocked()
    {
        var owner = await CreateUserAsync("silent1@example.com", "+970599300009", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var service = OwnerHourly(owner.Id);

        // The owner closes the day.
        await service.SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = false });

        // A follow-up body that simply omits isOpen must NOT be read as "true".
        await Assert.ThrowsAsync<ValidationException>(() =>
            service.SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = date }));

        var gate = await _context.HallDayAvailabilities
            .AsNoTracking()
            .SingleAsync(day => day.HallId == hall.Id && day.Date == date);
        Assert.False(gate.IsOpen);
    }

    [Fact]
    public void DayBlockValidator_RequiresIsOpenButAcceptsAnExplicitFalse()
    {
        var validator = new OwnerDayBlockRequestValidator();

        var missing = validator.Validate(new OwnerDayBlockRequest { Date = Tomorrow() });
        Assert.False(missing.IsValid);
        Assert.Contains(missing.Errors, error => error.PropertyName == nameof(OwnerDayBlockRequest.IsOpen));

        // false is a legitimate, meaningful value and must pass.
        var blocked = validator.Validate(new OwnerDayBlockRequest { Date = Tomorrow(), IsOpen = false });
        Assert.True(blocked.IsValid);

        var reopened = validator.Validate(new OwnerDayBlockRequest { Date = Tomorrow(), IsOpen = true });
        Assert.True(reopened.IsValid);
    }

    [Fact]
    public async Task DayBlock_ExplicitTrue_StillReopensTheDay()
    {
        var owner = await CreateUserAsync("reopen1@example.com", "+970599300010", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var service = OwnerHourly(owner.Id);

        await service.SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = false });
        var reopened = await service.SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = true });

        Assert.True(reopened.IsOpen);
        var catalog = await Hourly("seeker-1").GetHourlyCatalogAsync(hall.Id, date);
        Assert.True(catalog.DayOpen);
    }

    // =====================================================================
    // BUG 1c - the hourly read surfaces must respect the block AND the toggle
    // =====================================================================

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

        // A second day whose every hour is genuinely booked, under the same toggle.
        for (var hour = 9; hour < 18; hour++)
        {
            AddSlot(hall, fullyBookedDate, new TimeOnly(hour, 0), HallSlotStatus.Booked);
        }

        var service = Hourly("seeker-1");
        var blocked = await service.GetHourlyCatalogAsync(hall.Id, blockedDate);
        var fullyBooked = await service.GetHourlyCatalogAsync(hall.Id, fullyBookedDate);

        // The whole point: a seeker cannot tell the owner closed the day apart from
        // every hour happening to be booked, so the block stays hidden.
        Assert.Equal(fullyBooked.DayOpen, blocked.DayOpen);
        Assert.Equal(fullyBooked.Slots.Count, blocked.Slots.Count);
        Assert.Empty(blocked.Slots);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task Calendar_DisclosesABlockedDayOnlyWhenShowBookedSlotsIsOn(bool showBookedSlots, bool expectedIsOpen)
    {
        var owner = await CreateUserAsync("cal@example.com", "+970599300013", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, showBookedSlots: showBookedSlots);
        var date = Tomorrow();
        BlockDay(hall, date);

        var calendar = await Hourly("seeker-1").GetAvailabilityCalendarAsync(hall.Id, date, date);

        var day = Assert.Single(calendar.Days);
        Assert.Equal(expectedIsOpen, day.IsOpen);
    }

    // =====================================================================
    // BUG 1c - the LEGACY seeker-facing read surfaces
    // =====================================================================

    [Fact]
    public async Task LegacySearch_ExcludesAHallWhoseDateIsBlocked()
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
    public async Task LegacySearch_StillReturnsTheHallForADateThatIsNotBlocked()
    {
        var owner = await CreateUserAsync("search2@example.com", "+970599300015", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, name: "Searchable Hall");
        BlockDay(hall, InDays(3));

        var result = await Search().SearchHallsAsync(new HallSearchRequest { Date = Tomorrow() });

        Assert.Single(result.Items);
    }

    [Fact]
    public async Task LegacyAvailabilityQuery_ReportsEveryPeriodBookedOnABlockedDay()
    {
        var owner = await CreateUserAsync("avail1@example.com", "+970599300016", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        BlockDay(hall, date);

        var result = await LegacyAvailability().GetHallAvailabilityAsync(hall.Id, date);

        Assert.NotEmpty(result.Periods);
        Assert.All(result.Periods, period => Assert.Equal(AvailabilityStatus.Booked, period.Status));
    }

    [Fact]
    public async Task HallDetails_MarksEveryPeriodOfABlockedDayAsBooked()
    {
        var owner = await CreateUserAsync("details1@example.com", "+970599300017", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        BlockDay(hall, date);

        var details = await HallDetails().GetHallDetailsAsync(hall.Id);

        // The details page projects a rolling multi-day window, so pick out the blocked day.
        var day = Assert.Single(details.Availability, candidate => candidate.Date == date);
        Assert.NotEmpty(day.Periods);
        Assert.All(day.Periods, period => Assert.Equal(AvailabilityStatus.Booked, period.Status));
    }

    [Fact]
    public async Task HallDetails_LeavesUnblockedDaysAlone()
    {
        var owner = await CreateUserAsync("details2@example.com", "+970599300018", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        BlockDay(hall, InDays(5));

        var details = await HallDetails().GetHallDetailsAsync(hall.Id);

        Assert.NotEmpty(details.Availability);
        Assert.All(
            details.Availability.Where(day => day.Date != InDays(5)),
            day => Assert.All(day.Periods, period => Assert.Equal(AvailabilityStatus.Available, period.Status)));
    }

    [Fact]
    public async Task OwnerAvailabilityCalendar_ShowsTheOwnersOwnBlockedDayAsClosed()
    {
        var owner = await CreateUserAsync("ownerview1@example.com", "+970599300019", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();

        var service = OwnerAvailability(owner.Id);
        var before = await service.GetAvailabilityAsync(hall.Id, date, date);
        Assert.True(Assert.Single(before.Days).IsOpen);

        await OwnerHourly(owner.Id).SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = false });

        var after = await service.GetAvailabilityAsync(hall.Id, date, date);
        Assert.False(Assert.Single(after.Days).IsOpen);
    }

    [Fact]
    public async Task OwnerAvailabilityCalendar_TellsTheOwnerAboutTheBlockEvenWhenSeekersCannotSeeIt()
    {
        var owner = await CreateUserAsync("ownerview2@example.com", "+970599300020", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, showBookedSlots: false);
        var date = Tomorrow();

        await OwnerHourly(owner.Id).SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = false });

        // The seeker-facing calendar hides the block...
        var seekerCalendar = await Hourly("seeker-1").GetAvailabilityCalendarAsync(hall.Id, date, date);
        Assert.True(Assert.Single(seekerCalendar.Days).IsOpen);

        // ...but the owner who set it must still see the truth.
        var ownerCalendar = await OwnerAvailability(owner.Id).GetAvailabilityAsync(hall.Id, date, date);
        Assert.False(Assert.Single(ownerCalendar.Days).IsOpen);
    }

    // =====================================================================
    // BUG 4 - the day-gate check and the write it guards share one transaction
    // =====================================================================

    [Fact]
    public async Task DayBlock_ThatWouldOrphanAnActiveBooking_IsRejectedWithoutPersistingTheGate()
    {
        var owner = await CreateUserAsync("atomic1@example.com", "+970599300021", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        AddSlot(hall, date, new TimeOnly(10, 0), HallSlotStatus.Available);
        AddHourlyBooking(hall, date, new TimeOnly(10, 0), BookingStatus.Accepted);

        await Assert.ThrowsAsync<ConflictException>(() =>
            OwnerHourly(owner.Id).SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = false }));

        // The guard and the write are one unit: a refused block leaves no gate row behind.
        Assert.Empty(await _context.HallDayAvailabilities.ToListAsync());
    }

    [Fact]
    public async Task DayBlock_AndBookingCreation_CannotBothSucceedForTheSameDayFromTheServiceContract()
    {
        var owner = await CreateUserAsync("atomic2@example.com", "+970599300022", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("atomic3@example.com", "+970599300023", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();

        await OwnerHourly(owner.Id).SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = false });

        // Whichever entry point is used afterwards, the day stays unbookable.
        await Assert.ThrowsAsync<ConflictException>(() =>
            LegacyBooking(seeker.Id).CreateBookingRequestAsync(LegacyRequest(hall.Id, date)));

        await Assert.ThrowsAsync<ConflictException>(() =>
            Hourly(seeker.Id).CreateHourlyBookingAsync(new HourlyBookingRequestDto
            {
                HallId = hall.Id,
                Date = date,
                SlotStart = new TimeOnly(10, 0),
                NameOnBooking = "Layla Hassan",
                RequesterName = "Layla"
            }));

        Assert.Empty(await _context.Bookings.ToListAsync());
    }

    // =====================================================================
    // BUG 5 - narrowing the window must never strand a live booking
    // =====================================================================

    [Fact]
    public async Task NarrowingTheHourlyWindow_IsRejectedWhenItWouldStrandAnActiveBooking()
    {
        var owner = await CreateUserAsync("window1@example.com", "+970599300024", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, windowStart: new TimeOnly(9, 0), windowEnd: new TimeOnly(18, 0));
        var date = Tomorrow();
        // A live booking at 17:00, i.e. inside the current window.
        AddHourlyBooking(hall, date, new TimeOnly(17, 0), BookingStatus.Pending);

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
            new UpdateOwnerHourlySettingsRequest { HourlySlotStart = new TimeOnly(9, 0), HourlySlotEnd = new TimeOnly(12, 0) });

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
    public async Task NarrowingTheHourlyWindow_IgnoresLegacyBookingsBecauseTheyAreNotHourly()
    {
        var owner = await CreateUserAsync("windowlegacy@example.com", "+970599300028", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, windowStart: new TimeOnly(9, 0), windowEnd: new TimeOnly(18, 0));

        // A legacy booking carries SlotStart == 00:00 and can never fall outside a real window.
        _context.Bookings.Add(new Booking
        {
            HallId = hall.Id,
            RequesterUserId = "seeker-legacy",
            Date = Tomorrow(),
            Period = BookingPeriodType.FirstPeriod,
            Status = BookingStatus.Accepted
        });
        _context.SaveChanges();

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

    // =====================================================================
    // BUG 3 - the ShowBookedSlots column default drift
    // =====================================================================

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

        // Exactly one operation, and it is a metadata-only column alteration:
        // no UPDATE, no seed data, nothing that could touch the 9 existing production halls.
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

    private sealed class NoopNotifier : IOwnerBookingRequestNotifier
    {
        public Task NotifyBookingRequestReceivedAsync(
            string ownerUserId,
            OwnerBookingRequestNotificationEvent notification,
            CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task NotifyBookingRequestCancelledAsync(
            string ownerUserId,
            OwnerBookingCancellationNotificationEvent notification,
            CancellationToken cancellationToken = default)
            => Task.CompletedTask;
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
