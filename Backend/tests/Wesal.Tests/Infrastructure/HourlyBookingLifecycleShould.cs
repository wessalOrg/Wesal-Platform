using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

public class HourlyBookingLifecycleShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public HourlyBookingLifecycleShould()
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

    private Hall AddHall(string ownerId, bool showBookedSlots = true, string name = "Grand Hall")
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
            HourlySlotStart = new TimeOnly(9, 0),
            HourlySlotEnd = new TimeOnly(18, 0)
        };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private static DateOnly Tomorrow() => DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);

    private Booking AddHourlyBooking(
        Hall hall,
        DateOnly date,
        TimeOnly slotStart,
        string requesterUserId = "seeker-1",
        string? nameOnBooking = "Layla Hassan",
        BookingStatus status = BookingStatus.Pending)
    {
        var booking = new Booking
        {
            HallId = hall.Id,
            RequesterUserId = requesterUserId,
            Date = date,
            NameOnBooking = nameOnBooking,
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

    private async Task<HallSlotStatus> SlotStatusAsync(Hall hall, DateOnly date, TimeOnly start)
        => await _context.HallSlotAvailabilities
            .AsNoTracking()
            .Where(s => s.HallId == hall.Id && s.Date == date && s.StartTime == start)
            .Select(s => s.Status)
            .SingleAsync();

    private BookingRepository BookingRepo() => new(_context);

    private UnitOfWork UnitOfWork() => new(_context);

    private BookingAcceptanceService Acceptance(ICurrentUserService currentUser)
        => new(
            BookingRepo(),
            new ConversationRepository(_context),
            new MessageRepository(_context),
            UnitOfWork(),
            currentUser);

    private BookingPaymentConfirmationService PaymentConfirmation(ICurrentUserService currentUser)
        => new(BookingRepo(), UnitOfWork(), currentUser);

    /// <summary>
    /// Approves with a deposit and then confirms the payment, which is the pair of owner
    /// actions that takes a request all the way to officially booked.
    /// </summary>
    private async Task ApproveAndConfirmPayment(
        Hall hall,
        Booking booking,
        string ownerId,
        decimal deposit = 500m)
    {
        var owner = new FakeCurrentUser(ownerId, true, ApplicationRoles.HallOwner);

        await Acceptance(owner).AcceptBookingAsync(
            hall.Id,
            booking.Id,
            new AcceptBookingRequestDto { DepositAmount = deposit });

        await PaymentConfirmation(owner).ConfirmPaymentAsync(hall.Id, booking.Id);
    }

    private BookingCancellationService Cancellation(
        ICurrentUserService currentUser,
        IOwnerBookingRequestNotifier? notifier = null)
        => new(
            BookingRepo(),
            new ConversationRepository(_context),
            new MessageRepository(_context),
            UnitOfWork(),
            currentUser,
            notifier ?? new RecordingNotifier());

    private BookingRejectionService Rejection(ICurrentUserService currentUser)
        => new(
            BookingRepo(),
            new ConversationRepository(_context),
            new MessageRepository(_context),
            UnitOfWork(),
            currentUser);

    private BookingDeletionService Deletion(ICurrentUserService currentUser)
        => new(BookingRepo(), UnitOfWork(), currentUser);

       private HourlySlotService Seeker()
           => new(
               new HallRepository(_context),
               BookingRepo(),
               UnitOfWork(),
               new FakeCurrentUser("seeker-1", true, ApplicationRoles.RegisteredUser),
               new RecordingOwnerBookingRequestNotifier());


    [Fact]
    public async Task AcceptHourlyBooking_LeavesItsSlotReservedUntilPaymentIsConfirmed()
    {
        var owner = await CreateUserAsync("accept1@example.com", "+970599200001", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Reserved);
        var booking = AddHourlyBooking(hall, date, slot);

        var result = await Acceptance(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .AcceptBookingAsync(
                hall.Id,
                booking.Id,
                new AcceptBookingRequestDto { DepositAmount = 500m });

        Assert.Equal(BookingStatus.Accepted, result.Status);
        Assert.Equal(slot, Assert.Single(result.SlotStarts));
        Assert.Equal(500m, result.DepositAmount);

        // WESAL-TASK-8 (Edit 8): approval states what the requester must pay and nothing
        // more. The hour stays held as Reserved, so the owner still has a deliberate second
        // step before the hall is officially booked.
        Assert.Equal(HallSlotStatus.Reserved, await SlotStatusAsync(hall, date, slot));
        Assert.Null(result.DepositPaymentConfirmedAt);

        var persisted = await _context.Bookings.AsNoTracking().SingleAsync(b => b.Id == booking.Id);
        Assert.Equal(BookingStatus.Accepted, persisted.Status);
        Assert.Equal(500m, persisted.DepositAmount);
        Assert.Null(persisted.DepositPaymentConfirmedAt);
    }

    [Fact]
    public async Task ConfirmingPayment_MarksTheSlotBooked()
    {
        var owner = await CreateUserAsync("confirm1@example.com", "+970599200008", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Reserved);
        var booking = AddHourlyBooking(hall, date, slot);

        await ApproveAndConfirmPayment(hall, booking, owner.Id, 400m);

        // The payment confirmation is the single step that books the hall.
        Assert.Equal(HallSlotStatus.Booked, await SlotStatusAsync(hall, date, slot));

        var persisted = await _context.Bookings.AsNoTracking().SingleAsync(b => b.Id == booking.Id);
        Assert.NotNull(persisted.DepositPaymentConfirmedAt);
        Assert.Equal(BookingStatus.Accepted, persisted.Status);
    }

    [Fact]
    public async Task ShowBookedSlotsOn_ConfirmedSlotAppearsAsBookedToSeekers()
    {
        var owner = await CreateUserAsync("shown1@example.com", "+970599200003", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, showBookedSlots: true);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Reserved);
        var booking = AddHourlyBooking(hall, date, slot);

        await ApproveAndConfirmPayment(hall, booking, owner.Id);

        var catalog = await Seeker().GetHourlyCatalogAsync(hall.Id, date);
        var entry = Assert.Single(catalog.Slots, s => s.StartTime == slot);
        Assert.True(entry.IsBooked);
        Assert.Equal(HallSlotStatus.Booked, entry.Status);
        Assert.False(entry.IsSelectable);
        Assert.True(catalog.DayOpen);
    }

    [Fact]
    public async Task ShowBookedSlotsOn_AcceptedButUnpaidSlotIsShownUnavailableNotBooked()
    {
        var owner = await CreateUserAsync("unpaid1@example.com", "+970599200009", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, showBookedSlots: true);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Reserved);
        var booking = AddHourlyBooking(hall, date, slot);

        await Acceptance(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .AcceptBookingAsync(
                hall.Id,
                booking.Id,
                new AcceptBookingRequestDto { DepositAmount = 250m });

        var catalog = await Seeker().GetHourlyCatalogAsync(hall.Id, date);
        var entry = Assert.Single(catalog.Slots, s => s.StartTime == slot);

        // Reserved hours are disclosed as unavailable but never as booked, because nothing
        // has been paid for them yet - and they can never be selected.
        Assert.Equal(HallSlotStatus.Reserved, entry.Status);
        Assert.False(entry.IsBooked);
        Assert.False(entry.IsSelectable);
    }

    [Fact]
    public async Task ShowBookedSlotsOff_ConfirmedSlotIsHiddenFromSeekers()
    {
        var owner = await CreateUserAsync("hidden1@example.com", "+970599200004", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, showBookedSlots: false);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Reserved);
        var booking = AddHourlyBooking(hall, date, slot);

        await ApproveAndConfirmPayment(hall, booking, owner.Id);

        var catalog = await Seeker().GetHourlyCatalogAsync(hall.Id, date);
        Assert.DoesNotContain(catalog.Slots, s => s.StartTime == slot);
        Assert.True(catalog.DayOpen);
        Assert.NotEmpty(catalog.Slots);
    }

    [Fact]
    public async Task ShowBookedSlotsOff_AcceptedButUnpaidSlotIsHiddenFromSeekers()
    {
        var owner = await CreateUserAsync("unpaid2@example.com", "+970599200010", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, showBookedSlots: false);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Reserved);
        var booking = AddHourlyBooking(hall, date, slot);

        await Acceptance(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .AcceptBookingAsync(
                hall.Id,
                booking.Id,
                new AcceptBookingRequestDto { DepositAmount = 250m });

        var catalog = await Seeker().GetHourlyCatalogAsync(hall.Id, date);
        Assert.DoesNotContain(catalog.Slots, s => s.StartTime == slot);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task AvailabilityCalendar_NeverClosesTheDayForABookedSlot(bool showBookedSlots)
    {
        var owner = await CreateUserAsync($"cal{showBookedSlots}@example.com",
            showBookedSlots ? "+970599200005" : "+970599200006", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, showBookedSlots);
        var from = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, from, slot, HallSlotStatus.Reserved);
        var booking = AddHourlyBooking(hall, from, slot);

        await ApproveAndConfirmPayment(hall, booking, owner.Id);

        var calendar = await Seeker().GetAvailabilityCalendarAsync(hall.Id, from, from.AddDays(2));
        var day = Assert.Single(calendar.Days, d => d.Date == from);
        Assert.True(day.IsOpen);
    }

    [Fact]
    public async Task CancelHourlyBooking_ReleasesItsOwnSlot()
    {
        var seeker = await CreateUserAsync("cancel1@example.com", "+970599200007", ApplicationRoles.RegisteredUser);
        var owner = await CreateUserAsync("cancel1o@example.com", "+970599200008", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Booked);
        var booking = AddHourlyBooking(hall, date, slot, seeker.Id);

        var result = await Cancellation(new FakeCurrentUser(seeker.Id, true, ApplicationRoles.RegisteredUser))
            .CancelBookingAsync(hall.Id, booking.Id);

        Assert.Equal(BookingStatus.Cancelled, result.Status);
        Assert.Equal(slot, Assert.Single(result.SlotStarts));
        Assert.Equal(HallSlotStatus.Available, await SlotStatusAsync(hall, date, slot));
    }

    [Fact]
    public async Task CancelHourlyBooking_NotifierFailure_DoesNotFailTheCancellation()
    {
        var seeker = await CreateUserAsync("cancel3@example.com", "+970599200011", ApplicationRoles.RegisteredUser);
        var owner = await CreateUserAsync("cancel3o@example.com", "+970599200012", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Booked);
        var booking = AddHourlyBooking(hall, date, slot, seeker.Id);

        var notifier = new RecordingNotifier { ThrowOnNotify = true };
        var result = await Cancellation(new FakeCurrentUser(seeker.Id, true, ApplicationRoles.RegisteredUser), notifier)
            .CancelBookingAsync(hall.Id, booking.Id);

        Assert.Equal(BookingStatus.Cancelled, result.Status);
        Assert.Equal(HallSlotStatus.Available, await SlotStatusAsync(hall, date, slot));
    }

    [Fact]
    public async Task CancelHourlyBooking_LeavesConversationNoticeWithRealTimeRange()
    {
        var seeker = await CreateUserAsync("cancel4@example.com", "+970599200013", ApplicationRoles.RegisteredUser);
        var owner = await CreateUserAsync("cancel4o@example.com", "+970599200014", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        AddSlot(hall, date, new TimeOnly(14, 0), HallSlotStatus.Booked);
        var booking = AddHourlyBooking(hall, date, new TimeOnly(14, 0), seeker.Id);

        await Cancellation(new FakeCurrentUser(seeker.Id, true, ApplicationRoles.RegisteredUser))
            .CancelBookingAsync(hall.Id, booking.Id);

        var message = await _context.Messages.AsNoTracking().SingleAsync();
        Assert.Contains("14:00 - 15:00", message.Content);
        Assert.DoesNotContain("FirstPeriod", message.Content);
    }

    [Fact]
    public async Task CancelHourlyBooking_NotifiesOwnerWithTheHourlyRange()
    {
        var seeker = await CreateUserAsync("cancel2@example.com", "+970599200009", ApplicationRoles.RegisteredUser);
        var owner = await CreateUserAsync("cancel2o@example.com", "+970599200010", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, name: "Beach Hall");
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Booked);
        var booking = AddHourlyBooking(hall, date, slot, seeker.Id, "Nour Saleh");

        var notifier = new RecordingNotifier();
        await Cancellation(new FakeCurrentUser(seeker.Id, true, ApplicationRoles.RegisteredUser), notifier)
            .CancelBookingAsync(hall.Id, booking.Id);

        var sent = Assert.Single(notifier.Cancellations);
        Assert.Equal(owner.Id, sent.OwnerId);
        Assert.Equal(booking.Id, sent.Notification.BookingId);
        Assert.Equal(hall.Id, sent.Notification.HallId);
        Assert.Equal("Beach Hall", sent.Notification.HallName);
        Assert.Equal(date, sent.Notification.Date);
        Assert.Equal(slot, Assert.Single(sent.Notification.SlotStarts));
        Assert.Equal("14:00 - 15:00", sent.Notification.TimeRange);
        Assert.Equal("Nour Saleh", sent.Notification.RequesterName);
        Assert.Equal(seeker.Id, sent.Notification.RequesterUserId);
    }

    [Fact]
    public async Task CancelledRequest_IsNoLongerListedForTheOwner()
    {
        var seeker = await CreateUserAsync("list1@example.com", "+970599200015", ApplicationRoles.RegisteredUser);
        var owner = await CreateUserAsync("list1o@example.com", "+970599200016", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Booked);
        var booking = AddHourlyBooking(hall, date, slot, seeker.Id);

        var ownerDashboardRepo = new OwnerDashboardRepository(_context);
        var before = await ownerDashboardRepo.GetBookingRequestsAsync(hall.Id, owner.Id);
        Assert.NotNull(before);
        Assert.Single(before);
        Assert.Equal(booking.Id, before[0].BookingRequestId);

        await Cancellation(new FakeCurrentUser(seeker.Id, true, ApplicationRoles.RegisteredUser))
            .CancelBookingAsync(hall.Id, booking.Id);

        var after = await ownerDashboardRepo.GetBookingRequestsAsync(hall.Id, owner.Id);
        Assert.True(after is null || after.Count == 0);
    }

    [Fact]
    public async Task RejectHourlyBooking_ReleasesItsSlot()
    {
        var owner = await CreateUserAsync("reject1@example.com", "+970599200017", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Booked);
        var booking = AddHourlyBooking(hall, date, slot);

        var result = await Rejection(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .RejectBookingAsync(hall.Id, booking.Id, new RejectBookingRequestDto { Reason = "Slot already taken" });

        Assert.Equal(booking.Id, result.BookingId);
        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal(slot, Assert.Single(result.SlotStarts));
        Assert.Equal(HallSlotStatus.Available, await SlotStatusAsync(hall, date, slot));
        var persisted = await _context.Bookings.AsNoTracking().SingleAsync(b => b.Id == booking.Id);
        Assert.Equal(BookingStatus.Rejected, persisted.Status);
    }

    [Fact]
    public async Task RejectHourlyBooking_SendsExactArabicMessageOnRequesterOwnerConversation()
    {
        var owner = await CreateUserAsync("reject2@example.com", "+970599200018", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        AddSlot(hall, date, new TimeOnly(14, 0), HallSlotStatus.Booked);
        var booking = AddHourlyBooking(hall, date, new TimeOnly(14, 0));

        var result = await Rejection(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .RejectBookingAsync(hall.Id, booking.Id, new RejectBookingRequestDto { Reason = "الحفل محجوز بالكامل" });

        Assert.Equal(BookingRejectionNotificationStatus.Delivered, result.NotificationStatus);
        var conversation = await _context.Conversations.AsNoTracking().SingleAsync();
        Assert.Equal(hall.Id, conversation.HallId);
        Assert.Equal(booking.RequesterUserId, conversation.SenderUserId);
        Assert.Equal(owner.Id, conversation.HallOwnerId);
        var message = await _context.Messages.AsNoTracking().SingleAsync();
        Assert.Equal(owner.Id, message.SenderUserId);
        Assert.Equal(conversation.Id, message.ConversationId);
        Assert.Equal("تم رفض طلب الحجز الخاص بك للسبب الاتي: الحفل محجوز بالكامل", message.Content);
    }

    [Fact]
    public async Task RejectBooking_WithoutReason_ThrowsValidation()
    {
        var owner = await CreateUserAsync("reject3@example.com", "+970599200019", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Booked);
        var booking = AddHourlyBooking(hall, date, slot);

        await Assert.ThrowsAsync<ValidationException>(() =>
            Rejection(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
                .RejectBookingAsync(hall.Id, booking.Id, new RejectBookingRequestDto { Reason = "   " }));

        Assert.Equal(HallSlotStatus.Booked, await SlotStatusAsync(hall, date, slot));
        var persisted = await _context.Bookings.AsNoTracking().SingleAsync(b => b.Id == booking.Id);
        Assert.Equal(BookingStatus.Pending, persisted.Status);
    }

    [Fact]
    public async Task DeleteHourlyBooking_RemovesItAndAttemptsToReleaseItsSlot()
    {
        var owner = await CreateUserAsync("delete1@example.com", "+970599200020", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Booked);
        var booking = AddHourlyBooking(hall, date, slot, status: BookingStatus.Accepted);

        var result = await Deletion(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .DeleteBookingAsync(hall.Id, booking.Id);

        Assert.Equal(BookingStatus.Accepted, result.Status);
        Assert.Equal(slot, Assert.Single(result.SlotStarts));
        Assert.Empty(await _context.Bookings.Where(b => b.Id == booking.Id).ToListAsync());
        Assert.Equal(HallSlotStatus.Available, await SlotStatusAsync(hall, date, slot));
    }

    [Fact]
    public async Task CancelHourlyBooking_KeepsSlotBookedWhenAnotherActiveBookingHoldsIt()
    {
        var seekerA = await CreateUserAsync("competa@example.com", "+970599200025", ApplicationRoles.RegisteredUser);
        var seekerB = await CreateUserAsync("compb@example.com", "+970599200026", ApplicationRoles.RegisteredUser);
        var owner = await CreateUserAsync("compo@example.com", "+970599200027", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Booked);
        var cancelling = AddHourlyBooking(hall, date, slot, seekerA.Id, status: BookingStatus.Pending);
        AddHourlyBooking(hall, date, slot, seekerB.Id, status: BookingStatus.Accepted);

        await Cancellation(new FakeCurrentUser(seekerA.Id, true, ApplicationRoles.RegisteredUser))
            .CancelBookingAsync(hall.Id, cancelling.Id);

        Assert.Equal(HallSlotStatus.Booked, await SlotStatusAsync(hall, date, slot));
    }

    private sealed class RecordingNotifier : IOwnerBookingRequestNotifier
    {
        public List<(string OwnerId, OwnerBookingCancellationNotificationEvent Notification)> Cancellations { get; } = [];

        public bool ThrowOnNotify { get; set; }

        public Task NotifyBookingRequestReceivedAsync(
            string ownerUserId,
            OwnerBookingRequestNotificationEvent notification,
            CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task NotifyBookingRequestCancelledAsync(
            string ownerUserId,
            OwnerBookingCancellationNotificationEvent notification,
            CancellationToken cancellationToken = default)
        {
            if (ThrowOnNotify)
            {
                throw new InvalidOperationException("The realtime channel failed.");
            }

            Cancellations.Add((ownerUserId, notification));
            return Task.CompletedTask;
        }
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

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }
}
