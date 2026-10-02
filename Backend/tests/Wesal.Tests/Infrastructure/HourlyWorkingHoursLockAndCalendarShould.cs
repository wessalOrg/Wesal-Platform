using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Halls;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;
using Microsoft.Extensions.Logging.Abstractions;

using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Regression safety for the hourly working-hours window, the owner bookings
/// calendar and the admin lock/suspend enforcement (Edits 16, 23, 25).
/// These exercise the real services against the real repositories over an
/// in-memory database, so the guards under test are the same code the API runs.
/// </summary>
public class HourlyWorkingHoursLockAndCalendarShould : IDisposable
{
    private const string LockedHallMessage = "للأسف, هاي الصالة غير متاحة حاليا";

    private static readonly TimeOnly WindowStart = new(9, 0);
    private static readonly TimeOnly WindowEnd = new(21, 0);

    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public HourlyWorkingHoursLockAndCalendarShould()
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
        var user = new ApplicationUser { FullName = "Test User", Email = email, UserName = email, PhoneNumber = phone };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, role);
        return user;
    }

    private Hall AddHall(
        string ownerId,
        TimeOnly? start = null,
        TimeOnly? end = null,
        bool adminLocked = false,
        bool systemLocked = false)
    {
        var hall = new Hall
        {
            Name = "Grand Hall",
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
            IsAdminLocked = adminLocked,
            SystemLocked = systemLocked,
            HourlySlotStart = start ?? WindowStart,
            HourlySlotEnd = end ?? WindowEnd,
            ShowBookedSlots = true
        };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private static DateOnly Tomorrow() => DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);

    private HourlySlotService CreateSeekerService(string seekerId)
        => new(new HallRepository(_context), new BookingRepository(_context),
            new UnitOfWork(_context), new FakeCurrentUser(seekerId, true, ApplicationRoles.RegisteredUser),
            new RecordingOwnerBookingRequestNotifier(), new RecordingNotificationDispatcher());

    private OwnerHourlyAvailabilityService CreateHourlySettingsService(string ownerId)
        => new(_userManager, new FakeCurrentUser(ownerId, true, ApplicationRoles.HallOwner),
            new OwnerDashboardRepository(_context), new BookingRepository(_context),
            new UnitOfWork(_context));

    private OwnerBookingRequestsService CreateOwnerBookingsService(string ownerId)
        => new(_userManager, new FakeCurrentUser(ownerId, true, ApplicationRoles.HallOwner),
            new OwnerDashboardRepository(_context));

    private OwnerHallService CreateOwnerHallService(string ownerId)
        => new(_userManager, new FakeCurrentUser(ownerId, true, ApplicationRoles.HallOwner),
            new OwnerDashboardRepository(_context), new BookingRepository(_context),
            new LocalHallMediaStorage(Options.Create(new HallMediaOptions())),
            new UnitOfWork(_context), NullLogger<OwnerHallService>.Instance);

    private ConversationService CreateConversationService(string userId, string role)
        => new(new ConversationRepository(_context), new MessageRepository(_context),
            new FakeBookingRejectionService(), new NoOpBookingAcceptanceService(),
            new HallRepository(_context),
            new FakeCurrentUser(userId, true, role),
            new RecordingConversationNotifier(), new FakeDocumentStorage());

    private static HourlyBookingRequestDto BookingRequest(Guid hallId, DateOnly date, params TimeOnly[] starts)
        => new()
        {
            HallId = hallId,
            Date = date,
            SlotStarts = starts.ToList(),
            NameOnBooking = "Seeker Name",
            RequesterName = "Seeker Name"
        };

    // ---------- Working-hours window ----------

    [Fact]
    public async Task BookingInsideWorkingHours_Succeeds()
    {
        var owner = await CreateUserAsync("o1@example.com", "+970599100001", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("s1@example.com", "+970599100002", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();

        var result = await CreateSeekerService(seeker.Id)
            .CreateHourlyBookingAsync(BookingRequest(hall.Id, date, new TimeOnly(9, 0), new TimeOnly(10, 0)));

        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal(date, result.Date);
        Assert.Equal(
            [new TimeOnly(9, 0), new TimeOnly(10, 0)],
            result.SlotStarts.OrderBy(s => s).ToArray());
    }

    [Fact]
    public async Task BookingOutsideWorkingHours_Fails()
    {
        var owner = await CreateUserAsync("o2@example.com", "+970599100003", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("s2@example.com", "+970599100004", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();

        var tooEarly = await Assert.ThrowsAsync<ValidationException>(() =>
            CreateSeekerService(seeker.Id)
                .CreateHourlyBookingAsync(BookingRequest(hall.Id, date, new TimeOnly(8, 0))));
        Assert.Contains(tooEarly.Errors.Values.SelectMany(messages => messages),
            message => message.Contains("bookable hours", StringComparison.OrdinalIgnoreCase));

        var tooLate = await Assert.ThrowsAsync<ValidationException>(() =>
            CreateSeekerService(seeker.Id)
                .CreateHourlyBookingAsync(BookingRequest(hall.Id, date, new TimeOnly(21, 0))));
        Assert.Contains(tooLate.Errors.Values.SelectMany(messages => messages),
            message => message.Contains("bookable hours", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task WorkingHoursBoundary_OpeningSlotBookable_ClosingSlotRejected()
    {
        var owner = await CreateUserAsync("o3@example.com", "+970599100005", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("s3@example.com", "+970599100006", ApplicationRoles.RegisteredUser);
        // 09:00-21:00 window: 09:00-10:00 is the first valid slot, 20:00-21:00 the
        // last one, and 21:00 onward must not be bookable.
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var service = CreateSeekerService(seeker.Id);

        var catalog = await service.GetHourlyCatalogAsync(hall.Id, date);
        Assert.Contains(catalog.Slots, slot => slot.StartTime == new TimeOnly(9, 0));
        Assert.Contains(catalog.Slots, slot => slot.StartTime == new TimeOnly(20, 0));
        Assert.DoesNotContain(catalog.Slots, slot => slot.StartTime == new TimeOnly(21, 0));

        var opening = await service.CreateHourlyBookingAsync(
            BookingRequest(hall.Id, date, new TimeOnly(9, 0)));
        Assert.Contains(new TimeOnly(9, 0), opening.SlotStarts);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.CreateHourlyBookingAsync(BookingRequest(hall.Id, date.AddDays(1), new TimeOnly(21, 0))));
    }

    [Fact]
    public async Task InvalidWorkingWindow_IsRejected()
    {
        var owner = await CreateUserAsync("o4@example.com", "+970599100007", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var service = CreateHourlySettingsService(owner.Id);

        // Start must be before end.
        await Assert.ThrowsAsync<ValidationException>(() =>
            service.UpdateHourlySettingsAsync(hall.Id, new UpdateOwnerHourlySettingsRequest
            {
                HourlySlotStart = new TimeOnly(21, 0),
                HourlySlotEnd = new TimeOnly(9, 0)
            }));

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.UpdateHourlySettingsAsync(hall.Id, new UpdateOwnerHourlySettingsRequest
            {
                HourlySlotStart = new TimeOnly(10, 0),
                HourlySlotEnd = new TimeOnly(10, 0)
            }));

        // The persisted window is untouched by the rejected writes.
        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(WindowStart, reloaded!.HourlySlotStart);
        Assert.Equal(WindowEnd, reloaded.HourlySlotEnd);
    }

    [Fact]
    public async Task NarrowingWorkingHours_PastActiveBooking_IsRefused()
    {
        var owner = await CreateUserAsync("o5@example.com", "+970599100008", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("s5@example.com", "+970599100009", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();

        // 20:00-21:00 is inside the 09:00-21:00 window.
        await CreateSeekerService(seeker.Id)
            .CreateHourlyBookingAsync(BookingRequest(hall.Id, date, new TimeOnly(20, 0)));

        // Closing at 20:00 would orphan that live booking.
        var settingsEx = await Assert.ThrowsAsync<ConflictException>(() =>
            CreateHourlySettingsService(owner.Id).UpdateHourlySettingsAsync(
                hall.Id, new UpdateOwnerHourlySettingsRequest { HourlySlotEnd = new TimeOnly(20, 0) }));
        Assert.Contains("active booking", settingsEx.Message, StringComparison.OrdinalIgnoreCase);

        // The hall-details update path enforces the same orphan rule.
        var detailsEx = await Assert.ThrowsAsync<ConflictException>(() =>
            CreateOwnerHallService(owner.Id).UpdateOwnedHallAsync(hall.Id, DetailsRequest(hall, end: new TimeOnly(20, 0))));
        Assert.Contains("active booking", detailsEx.Message, StringComparison.OrdinalIgnoreCase);
    }

    // ---------- Owner bookings calendar (Edits 23 + 25) ----------

    [Fact]
    public async Task OwnerBookingsCalendar_ReturnsBookedDaysHoursAndFlags()
    {
        var owner = await CreateUserAsync("o6@example.com", "+970599100010", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("s6@example.com", "+970599100011", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id);
        var bookedDate = Tomorrow();
        var emptyDate = bookedDate.AddDays(1);

        await CreateSeekerService(seeker.Id).CreateHourlyBookingAsync(
            BookingRequest(hall.Id, bookedDate, new TimeOnly(9, 0), new TimeOnly(11, 0)));

        var calendar = await CreateOwnerBookingsService(owner.Id)
            .GetBookingsCalendarAsync(hall.Id, bookedDate, emptyDate);

        Assert.Equal(hall.Id, calendar.HallId);
        Assert.Equal(2, calendar.Days.Count);

        var bookedDay = Assert.Single(calendar.Days, day => day.Date == bookedDate);
        Assert.True(bookedDay.HasBookedHours);
        Assert.Equal(
            [new TimeOnly(9, 0), new TimeOnly(11, 0)],
            bookedDay.BookedHours.OrderBy(s => s).ToArray());

        var freeDay = Assert.Single(calendar.Days, day => day.Date == emptyDate);
        Assert.False(freeDay.HasBookedHours);
        Assert.Empty(freeDay.BookedHours);
    }

    [Fact]
    public async Task OwnerBookingsCalendar_ExcludesCancelledBookings()
    {
        var owner = await CreateUserAsync("o7@example.com", "+970599100012", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("s7@example.com", "+970599100013", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();

        await CreateSeekerService(seeker.Id)
            .CreateHourlyBookingAsync(BookingRequest(hall.Id, date, new TimeOnly(9, 0)));

        var booking = await _context.Bookings.FirstAsync(b => b.HallId == hall.Id && b.Date == date);
        booking.Status = BookingStatus.Cancelled;
        await _context.SaveChangesAsync();
        _context.ChangeTracker.Clear();

        var calendar = await CreateOwnerBookingsService(owner.Id)
            .GetBookingsCalendarAsync(hall.Id, date, date);

        var day = Assert.Single(calendar.Days);
        Assert.False(day.HasBookedHours);
        Assert.Empty(day.BookedHours);
    }

    [Fact]
    public async Task OwnerBookingsCalendar_InvalidRange_IsRejected()
    {
        var owner = await CreateUserAsync("o8@example.com", "+970599100014", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();

        await Assert.ThrowsAsync<ValidationException>(() =>
            CreateOwnerBookingsService(owner.Id)
                .GetBookingsCalendarAsync(hall.Id, date, date.AddDays(-1)));
    }

    // ---------- Admin lock/suspend (Edit 16) ----------

    [Fact]
    public async Task LockedHall_CannotBeBooked_WithUnavailableMessage()
    {
        var owner = await CreateUserAsync("o9@example.com", "+970599100015", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("s9@example.com", "+970599100016", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id, adminLocked: true);
        var date = Tomorrow();

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            CreateSeekerService(seeker.Id)
                .CreateHourlyBookingAsync(BookingRequest(hall.Id, date, new TimeOnly(10, 0))));

        Assert.Equal(HallManagementAccess.HallLockedCode, ex.Code);
        Assert.Equal(LockedHallMessage, ex.Message);
    }

    [Fact]
    public async Task SystemLockedHall_CannotBeBooked_WithUnavailableMessage()
    {
        var owner = await CreateUserAsync("o10@example.com", "+970599100017", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("s10@example.com", "+970599100018", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id, systemLocked: true);
        var date = Tomorrow();

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            CreateSeekerService(seeker.Id)
                .CreateHourlyBookingAsync(BookingRequest(hall.Id, date, new TimeOnly(10, 0))));

        Assert.Equal(LockedHallMessage, ex.Message);
    }

    [Fact]
    public async Task LockedHall_CannotBeContactedOrMessaged_WithUnavailableMessage()
    {
        var owner = await CreateUserAsync("o11@example.com", "+970599100019", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("s11@example.com", "+970599100020", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id, adminLocked: true);

        // Starting a hall thread is refused.
        var createEx = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            CreateConversationService(seeker.Id, ApplicationRoles.RegisteredUser)
                .CreateConversationAsync(hall.Id));
        Assert.Equal(HallManagementAccess.HallLockedCode, createEx.Code);
        Assert.Equal(LockedHallMessage, createEx.Message);

        // Sending into a pre-existing thread about the hall is refused with the same error.
        var conversation = new Conversation
        {
            HallId = hall.Id,
            SenderUserId = seeker.Id,
            HallOwnerId = owner.Id
        };
        _context.Conversations.Add(conversation);
        await _context.SaveChangesAsync();
        _context.ChangeTracker.Clear();

        var sendEx = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            CreateConversationService(seeker.Id, ApplicationRoles.RegisteredUser)
                .SendMessageAsync(conversation.Id, new SendMessageRequest { Content = "Is it available?" }));
        Assert.Equal(LockedHallMessage, sendEx.Message);

        Assert.Empty(_context.Messages);
    }

    [Fact]
    public async Task LockedHall_OwnerCannotAccessOrManage_WithUnavailableMessage()
    {
        var owner = await CreateUserAsync("o12@example.com", "+970599100021", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, adminLocked: true);
        var date = Tomorrow();

        var detailsEx = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            CreateOwnerHallService(owner.Id).GetOwnedHallDetailsAsync(hall.Id));
        Assert.Equal(HallManagementAccess.HallLockedCode, detailsEx.Code);
        Assert.Equal(LockedHallMessage, detailsEx.Message);

        var updateEx = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            CreateOwnerHallService(owner.Id).UpdateOwnedHallAsync(hall.Id, DetailsRequest(hall)));
        Assert.Equal(LockedHallMessage, updateEx.Message);

        var calendarEx = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            CreateOwnerBookingsService(owner.Id).GetBookingsCalendarAsync(hall.Id, date, date));
        Assert.Equal(LockedHallMessage, calendarEx.Message);
    }

    private static UpdateOwnerHallRequest DetailsRequest(Hall hall, TimeOnly? end = null) => new()
    {
        Name = hall.Name,
        Address = hall.Address,
        Region = hall.Region,
        Capacity = hall.Capacity,
        Price = hall.Price,
        ShowPrice = hall.ShowPrice,
        ContactPhone = hall.ContactPhone,
        Description = hall.Description,
        Photos =
        [
            new UpdateOwnerHallPhotoDto { Url = "https://cdn.example.com/cover.jpg", DisplayOrder = 0 }
        ],
        HourlySlotStart = hall.HourlySlotStart,
        HourlySlotEnd = end ?? hall.HourlySlotEnd
    };

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        private readonly string[] _roles;

        public FakeCurrentUser(string? userId, bool authenticated, params string[] roles)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
            _roles = roles;
        }

        public string? UserId { get; }
        public string? UserName => "test";
        public string? Email => "test@example.com";
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles => _roles;
    }

    private sealed class FakeBookingRejectionService : IBookingRejectionService
    {
        public Task<RejectBookingResultDto> RejectBookingAsync(
            Guid hallId, Guid bookingId, RejectBookingRequestDto request, CancellationToken cancellationToken = default)
            => Task.FromResult(new RejectBookingResultDto());

        public Task<int> DeliverPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(0);
    }

    private sealed class FakeDocumentStorage : IDocumentStorage
    {
        public string Root => Path.Combine(Path.GetTempPath(), "wesal-test-documents");

        public string OwnerDocumentsDirectory(string ownerId)
            => Path.Combine(Root, "documents", "owners", ownerId);

        public string ConversationAttachmentsDirectory(Guid conversationId)
            => Path.Combine(Root, "documents", "conversations", conversationId.ToString(), "attachments");
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }
}
