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

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// The hourly-slot booking lifecycle (WESAL-TASK-1): accept / cancel / reject / delete
/// must all act on the exact 60-minute HallSlotAvailability row the booking holds, and
/// approval IS the publish step.
///
/// These use the real repositories over an in-memory database so the slot reservation and
/// release queries, and the owner request list, are the same code the API runs. The bug
/// this suite locks down: an hourly booking used to be released through the legacy
/// two-period path, so cancelling/rejecting/deleting an hourly booking released a
/// FirstPeriod row while its real hourly slot stayed Booked forever.
/// </summary>
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
        var user = new ApplicationUser { FullName = "Test User", Email = email, UserName = email, PhoneNumber = phone };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
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
            SlotStart = slotStart,
            NameOnBooking = nameOnBooking,
            Period = BookingPeriodType.FirstPeriod,
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

    private void AddLegacyAvailability(Hall hall, DateOnly date, BookingPeriodType period, AvailabilityStatus status)
    {
        _context.HallAvailabilities.Add(new HallAvailability
        {
            HallId = hall.Id,
            Date = date,
            PeriodType = period,
            Status = status
        });
        _context.SaveChanges();
    }

    private async Task<AvailabilityStatus> LegacyStatusAsync(Hall hall, DateOnly date, BookingPeriodType period)
        => await _context.HallAvailabilities
            .AsNoTracking()
            .Where(a => a.HallId == hall.Id && a.Date == date && a.PeriodType == period)
            .Select(a => a.Status)
            .SingleAsync();

    private BookingRepository BookingRepo() => new(_context);
    private UnitOfWork UnitOfWork() => new(_context);

    private BookingAcceptanceService Acceptance(ICurrentUserService currentUser)
        => new(BookingRepo(), UnitOfWork(), currentUser);

    private BookingCancellationService Cancellation(ICurrentUserService currentUser, IOwnerBookingRequestNotifier? notifier = null)
        => new(BookingRepo(), new ConversationRepository(_context), new MessageRepository(_context),
            UnitOfWork(), currentUser, notifier ?? new RecordingNotifier());

    private BookingRejectionService Rejection(ICurrentUserService currentUser)
        => new(BookingRepo(), new ConversationRepository(_context), new MessageRepository(_context),
            UnitOfWork(), currentUser);

    private BookingDeletionService Deletion(ICurrentUserService currentUser)
        => new(BookingRepo(), UnitOfWork(), currentUser);

    private HourlySlotService Seeker()
        => new(new HallRepository(_context), BookingRepo(), UnitOfWork(),
            new FakeCurrentUser("seeker-1", true, ApplicationRoles.RegisteredUser));

    // ---------- Step 1+2: approval is the publish step ----------

    [Fact]
    public async Task AcceptHourlyBooking_MarksItsSlotBooked_WithoutASeparatePublishStep()
    {
        var owner = await CreateUserAsync("accept1@example.com", "+970599200001", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Available);
        var booking = AddHourlyBooking(hall, date, slot);

        var result = await Acceptance(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .AcceptBookingAsync(hall.Id, booking.Id);

        Assert.Equal(BookingStatus.Accepted, result.Status);
        Assert.True(result.IsHourlyBooking);
        Assert.Equal(slot, result.SlotStart);

        // Acceptance alone must flip the slot to Booked: there is no publish endpoint,
        // no IsPublished column, and no second owner action required.
        Assert.Equal(HallSlotStatus.Booked, await SlotStatusAsync(hall, date, slot));
        var persisted = await _context.Bookings.AsNoTracking().SingleAsync(b => b.Id == booking.Id);
        Assert.Equal(BookingStatus.Accepted, persisted.Status);
    }

    [Fact]
    public async Task AcceptHourlyBooking_DoesNotTouchLegacyPeriodRows()
    {
        var owner = await CreateUserAsync("accept2@example.com", "+970599200002", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Available);
        AddLegacyAvailability(hall, date, BookingPeriodType.FirstPeriod, AvailabilityStatus.Booked);
        var booking = AddHourlyBooking(hall, date, slot);

        await Acceptance(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .AcceptBookingAsync(hall.Id, booking.Id);

        Assert.Equal(HallSlotStatus.Booked, await SlotStatusAsync(hall, date, slot));
        Assert.Equal(
            AvailabilityStatus.Booked,
            await LegacyStatusAsync(hall, date, BookingPeriodType.FirstPeriod));
    }

    // ---------- Step 2: ShowBookedSlots on approval ----------

    [Fact]
    public async Task ShowBookedSlotsOn_AcceptedSlotAppearsAsBookedToSeekers()
    {
        var owner = await CreateUserAsync("shown1@example.com", "+970599200003", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, showBookedSlots: true);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Available);
        var booking = AddHourlyBooking(hall, date, slot);

        await Acceptance(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .AcceptBookingAsync(hall.Id, booking.Id);

        var catalog = await Seeker().GetHourlyCatalogAsync(hall.Id, date);

        var entry = Assert.Single(catalog.Slots, s => s.StartTime == slot);
        Assert.True(entry.IsBooked);
        Assert.Equal(HallSlotStatus.Booked, entry.Status);
        Assert.True(catalog.DayOpen);
    }

    [Fact]
    public async Task ShowBookedSlotsOff_AcceptedSlotIsCompletelyHiddenFromSeekers()
    {
        var owner = await CreateUserAsync("hidden1@example.com", "+970599200004", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, showBookedSlots: false);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Available);
        var booking = AddHourlyBooking(hall, date, slot);

        await Acceptance(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .AcceptBookingAsync(hall.Id, booking.Id);

        var catalog = await Seeker().GetHourlyCatalogAsync(hall.Id, date);

        // The seeker must not see the booked hour at all, and the day stays open.
        Assert.DoesNotContain(catalog.Slots, s => s.StartTime == slot);
        Assert.True(catalog.DayOpen);
        Assert.NotEmpty(catalog.Slots);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task AvailabilityCalendar_NeverRevealsBookingActivity(bool showBookedSlots)
    {
        var owner = await CreateUserAsync($"cal{showBookedSlots}@example.com",
            showBookedSlots ? "+970599200005" : "+970599200006", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, showBookedSlots);
        var from = Tomorrow();
        AddSlot(hall, from, new TimeOnly(14, 0), HallSlotStatus.Available);
        var booking = AddHourlyBooking(hall, from, new TimeOnly(14, 0));

        await Acceptance(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .AcceptBookingAsync(hall.Id, booking.Id);

        var calendar = await Seeker().GetAvailabilityCalendarAsync(hall.Id, from, from.AddDays(2));

        // A booked hour must not close the day or otherwise expose booking activity.
        var day = Assert.Single(calendar.Days, d => d.Date == from);
        Assert.True(day.IsOpen);
    }

    // ---------- Step 1: cancel releases the hourly slot ----------

    [Fact]
    public async Task CancelHourlyBooking_ReleasesItsOwnSlotAndNeverALegacyPeriod()
    {
        var seeker = await CreateUserAsync("cancel1@example.com", "+970599200007", ApplicationRoles.RegisteredUser);
        var owner = await CreateUserAsync("cancel1o@example.com", "+970599200008", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Booked);
        AddLegacyAvailability(hall, date, BookingPeriodType.FirstPeriod, AvailabilityStatus.Available);
        var booking = AddHourlyBooking(hall, date, slot, seeker.Id, status: BookingStatus.Pending);
        _context.Entry(booking).Property(b => b.Status).CurrentValue = BookingStatus.Pending;
        await _context.SaveChangesAsync();

        var result = await Cancellation(new FakeCurrentUser(seeker.Id, true, ApplicationRoles.RegisteredUser))
            .CancelBookingAsync(hall.Id, booking.Id);

        Assert.Equal(BookingStatus.Cancelled, result.Status);
        Assert.True(result.IsHourlyBooking);
        Assert.Equal(slot, result.SlotStart);
        Assert.Equal(HallSlotStatus.Available, await SlotStatusAsync(hall, date, slot));

        // The regression guard: the legacy FirstPeriod row must stay exactly as it was.
        Assert.Equal(
            AvailabilityStatus.Available,
            await LegacyStatusAsync(hall, date, BookingPeriodType.FirstPeriod));
    }

    [Fact]
    public async Task CancelHourlyBooking_NotifiesOwnerWithRequesterNameDateAndTime()
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
        Assert.Equal(slot, sent.Notification.SlotStart);
        Assert.Equal("14:00 - 15:00", sent.Notification.TimeRange);
        Assert.True(sent.Notification.IsHourlyBooking);
        Assert.Equal("Nour Saleh", sent.Notification.RequesterName);
        Assert.Equal(seeker.Id, sent.Notification.RequesterUserId);
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
    public async Task CancelHourlyBooking_LeavesConversationNoticeWithRealTimeRangeNotPeriod()
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

    // ---------- Step 3: cancelled request disappears from the owner list ----------

    [Fact]
    public async Task CancelledRequest_IsNoLongerListedForTheOwner()
    {
        var seeker = await CreateUserAsync("list1@example.com", "+970599200015", ApplicationRoles.RegisteredUser);
        var owner = await CreateUserAsync("list1o@example.com", "+970599200016", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        AddSlot(hall, date, new TimeOnly(14, 0), HallSlotStatus.Booked);
        var booking = AddHourlyBooking(hall, date, new TimeOnly(14, 0), seeker.Id);

        var ownerDashboardRepo = new OwnerDashboardRepository(_context);
        var before = await ownerDashboardRepo.GetBookingRequestsAsync(hall.Id, owner.Id);
        Assert.Single(before);
        Assert.Equal(booking.Id, before[0].BookingRequestId);

        await Cancellation(new FakeCurrentUser(seeker.Id, true, ApplicationRoles.RegisteredUser))
            .CancelBookingAsync(hall.Id, booking.Id);

        var after = await ownerDashboardRepo.GetBookingRequestsAsync(hall.Id, owner.Id);
        Assert.Empty(after);
    }

    // ---------- Step 1: reject releases the hourly slot ----------

    [Fact]
    public async Task RejectHourlyBooking_ReleasesItsSlotAndNeverALegacyPeriod()
    {
        var owner = await CreateUserAsync("reject1@example.com", "+970599200017", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Booked);
        AddLegacyAvailability(hall, date, BookingPeriodType.FirstPeriod, AvailabilityStatus.Available);
        var booking = AddHourlyBooking(hall, date, slot);

        await Rejection(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .RejectBookingAsync(hall.Id, booking.Id, new RejectBookingRequestDto { Reason = "Slot already taken" });

        Assert.Equal(HallSlotStatus.Available, await SlotStatusAsync(hall, date, slot));
        Assert.Equal(
            AvailabilityStatus.Available,
            await LegacyStatusAsync(hall, date, BookingPeriodType.FirstPeriod));
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

        // A rejected-as-invalid request must leave the slot held and still Pending.
        Assert.Equal(HallSlotStatus.Booked, await SlotStatusAsync(hall, date, slot));
        var persisted = await _context.Bookings.AsNoTracking().SingleAsync(b => b.Id == booking.Id);
        Assert.Equal(BookingStatus.Pending, persisted.Status);
    }

    // ---------- Step 1: delete releases the hourly slot ----------

    [Fact]
    public async Task DeleteHourlyBooking_ReleasesItsSlotAndNeverALegacyPeriod()
    {
        var owner = await CreateUserAsync("delete1@example.com", "+970599200020", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var slot = new TimeOnly(14, 0);
        AddSlot(hall, date, slot, HallSlotStatus.Booked);
        AddLegacyAvailability(hall, date, BookingPeriodType.FirstPeriod, AvailabilityStatus.Available);
        var booking = AddHourlyBooking(hall, date, slot, status: BookingStatus.Accepted);

        var result = await Deletion(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .DeleteBookingAsync(hall.Id, booking.Id);

        Assert.True(result.IsHourlyBooking);
        Assert.Equal(slot, result.SlotStart);
        Assert.Empty(await _context.Bookings.Where(b => b.Id == booking.Id).ToListAsync());
        Assert.Equal(HallSlotStatus.Available, await SlotStatusAsync(hall, date, slot));
        Assert.Equal(
            AvailabilityStatus.Available,
            await LegacyStatusAsync(hall, date, BookingPeriodType.FirstPeriod));
    }

    // ---------- Legacy two-period bookings keep their old behavior ----------

    [Fact]
    public async Task CancelLegacyBooking_StillReleasesTheLegacyPeriodAndNoHourlySlot()
    {
        var seeker = await CreateUserAsync("legacy1@example.com", "+970599200021", ApplicationRoles.RegisteredUser);
        var owner = await CreateUserAsync("legacy1o@example.com", "+970599200022", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        AddLegacyAvailability(hall, date, BookingPeriodType.FirstPeriod, AvailabilityStatus.Booked);
        AddLegacyAvailability(hall, date, BookingPeriodType.SecondPeriod, AvailabilityStatus.Available);

        // A pre-migration row: no hourly slot, Period carries the real booking identity.
        var booking = new Booking
        {
            HallId = hall.Id,
            RequesterUserId = seeker.Id,
            Date = date,
            Period = BookingPeriodType.FirstPeriod,
            NameOnBooking = null,
            Status = BookingStatus.Pending
        };
        _context.Bookings.Add(booking);
        await _context.SaveChangesAsync();
        Assert.False(booking.IsHourlyBooking);

        var result = await Cancellation(new FakeCurrentUser(seeker.Id, true, ApplicationRoles.RegisteredUser))
            .CancelBookingAsync(hall.Id, booking.Id);

        Assert.False(result.IsHourlyBooking);
        Assert.Equal(
            AvailabilityStatus.Available,
            await LegacyStatusAsync(hall, date, BookingPeriodType.FirstPeriod));
        Assert.Equal(
            AvailabilityStatus.Available,
            await LegacyStatusAsync(hall, date, BookingPeriodType.SecondPeriod));
        Assert.Empty(await _context.HallSlotAvailabilities.ToListAsync());
    }

    [Fact]
    public async Task DeleteLegacyBooking_StillReleasesTheLegacyPeriod()
    {
        var owner = await CreateUserAsync("legacy2@example.com", "+970599200023", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        AddLegacyAvailability(hall, date, BookingPeriodType.SecondPeriod, AvailabilityStatus.Booked);
        var booking = new Booking
        {
            HallId = hall.Id,
            RequesterUserId = "seeker-legacy",
            Date = date,
            Period = BookingPeriodType.SecondPeriod,
            Status = BookingStatus.Accepted
        };
        _context.Bookings.Add(booking);
        await _context.SaveChangesAsync();

        await Deletion(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .DeleteBookingAsync(hall.Id, booking.Id);

        Assert.Equal(
            AvailabilityStatus.Available,
            await LegacyStatusAsync(hall, date, BookingPeriodType.SecondPeriod));
    }

    [Fact]
    public async Task AcceptLegacyBooking_DoesNotMarkAnyHourlySlotBooked()
    {
        var owner = await CreateUserAsync("legacy3@example.com", "+970599200024", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var booking = new Booking
        {
            HallId = hall.Id,
            RequesterUserId = "seeker-legacy",
            Date = date,
            Period = BookingPeriodType.FirstPeriod,
            Status = BookingStatus.Pending
        };
        _context.Bookings.Add(booking);
        await _context.SaveChangesAsync();

        var result = await Acceptance(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .AcceptBookingAsync(hall.Id, booking.Id);

        Assert.False(result.IsHourlyBooking);
        Assert.Empty(await _context.HallSlotAvailabilities.ToListAsync());
    }

    // ---------- competing claims ----------

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
