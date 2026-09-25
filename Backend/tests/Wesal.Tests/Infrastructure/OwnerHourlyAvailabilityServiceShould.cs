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
/// Owner-facing hourly-slot availability management (WESAL-TASK-1): blocking a whole
/// calendar day, and writing the ShowBookedSlots toggle plus the bookable hourly window.
/// These use the real repositories over an in-memory database so the day-gate and
/// hourly-slot queries are the same code the API runs, then assert the change is
/// actually reflected through the seeker-facing HourlySlotService.
/// </summary>
public class OwnerHourlyAvailabilityServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public OwnerHourlyAvailabilityServiceShould()
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

    private async Task<ApplicationUser> CreateOwnerAsync(string email, string phone)
    {
        var user = new ApplicationUser { FullName = "Hall Owner", Email = email, UserName = email, PhoneNumber = phone };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, ApplicationRoles.HallOwner);
        return user;
    }

    private Hall AddHall(string ownerId, string name = "Grand Hall")
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
            IsDeleted = false
        };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private OwnerHourlyAvailabilityService CreateOwnerService(ICurrentUserService currentUser)
        => new(_userManager, currentUser, new OwnerDashboardRepository(_context),
            new BookingRepository(_context), new UnitOfWork(_context));

    private HourlySlotService CreateSeekerService()
        => new(new HallRepository(_context), new BookingRepository(_context),
            new UnitOfWork(_context), new FakeCurrentUser("seeker-1", true, ApplicationRoles.RegisteredUser));

    private static DateOnly Tomorrow() => DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);

    private void AddBookedSlot(Guid hallId, DateOnly date, TimeOnly start)
    {
        _context.HallSlotAvailabilities.Add(new HallSlotAvailability
        {
            HallId = hallId,
            Date = date,
            StartTime = start,
            Status = HallSlotStatus.Booked
        });
        _context.SaveChanges();
    }

    // ---------- Step B: owner day block ----------

    [Fact]
    public async Task SetDayBlock_BlockingDay_ClosesCatalogAndCalendarForSeekers()
    {
        var owner = await CreateOwnerAsync("block1@example.com", "+970599100001");
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var ownerService = CreateOwnerService(new FakeCurrentUser(owner.Id, true));

        var result = await ownerService.SetDayBlockAsync(
            hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = false });

        Assert.False(result.IsOpen);
        Assert.Equal(date, result.Date);

        // Persisted as a closed gate.
        var gate = await _context.HallDayAvailabilities
            .FirstOrDefaultAsync(day => day.HallId == hall.Id && day.Date == date);
        Assert.NotNull(gate);
        Assert.False(gate!.IsOpen);

        // The seeker catalog exposes no slots and reports the day closed.
        var catalog = await CreateSeekerService().GetHourlyCatalogAsync(hall.Id, date);
        Assert.False(catalog.DayOpen);
        Assert.Empty(catalog.Slots);

        // The seeker calendar reports the same day closed.
        var calendar = await CreateSeekerService().GetAvailabilityCalendarAsync(hall.Id, date, date.AddDays(1));
        Assert.False(calendar.Days[0].IsOpen);
        Assert.True(calendar.Days[1].IsOpen);
    }

    [Fact]
    public async Task SetDayBlock_UnblockingDay_ReopensCatalogForSeekers()
    {
        var owner = await CreateOwnerAsync("block2@example.com", "+970599100002");
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var ownerService = CreateOwnerService(new FakeCurrentUser(owner.Id, true));

        await ownerService.SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = false });
        var reopened = await ownerService.SetDayBlockAsync(
            hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = true });

        Assert.True(reopened.IsOpen);

        var catalog = await CreateSeekerService().GetHourlyCatalogAsync(hall.Id, date);
        Assert.True(catalog.DayOpen);
        Assert.NotEmpty(catalog.Slots);
    }

    [Fact]
    public async Task SetDayBlock_BlockedDay_RejectsBookingWithConflict()
    {
        var owner = await CreateOwnerAsync("block3@example.com", "+970599100003");
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var ownerService = CreateOwnerService(new FakeCurrentUser(owner.Id, true));
        await ownerService.SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = false });

        var exception = await Assert.ThrowsAsync<ConflictException>(() =>
            CreateSeekerService().CreateHourlyBookingAsync(new HourlyBookingRequestDto
            {
                HallId = hall.Id,
                Date = date,
                SlotStart = new TimeOnly(10, 0),
                NameOnBooking = "Layla Hassan",
                RequesterName = "Layla Hassan"
            }));

        Assert.Contains("blocked", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SetDayBlock_AnotherOwner_ThrowsNotFound()
    {
        var ownerA = await CreateOwnerAsync("blocka@example.com", "+970599100004");
        var ownerB = await CreateOwnerAsync("blockb@example.com", "+970599100005");
        var hall = AddHall(ownerA.Id);
        var service = CreateOwnerService(new FakeCurrentUser(ownerB.Id, true));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = Tomorrow(), IsOpen = false }));
    }

    [Fact]
    public async Task SetDayBlock_Unauthenticated_ThrowsUnauthorized()
    {
        var owner = await CreateOwnerAsync("blockc@example.com", "+970599100006");
        var hall = AddHall(owner.Id);
        var service = CreateOwnerService(new FakeCurrentUser(null, false));

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = Tomorrow(), IsOpen = false }));
    }

    [Theory]
    [InlineData(BookingStatus.Pending)]
    [InlineData(BookingStatus.Accepted)]
    public async Task SetDayBlock_DayWithActiveBooking_ThrowsConflict(BookingStatus status)
    {
        var owner = await CreateOwnerAsync($"blocklive{status}@example.com", $"+9705991000{(int)status + 10}");
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        _context.Bookings.Add(new Booking
        {
            HallId = hall.Id,
            RequesterUserId = "seeker-1",
            Date = date,
            SlotStart = new TimeOnly(10, 0),
            NameOnBooking = "Layla Hassan",
            Status = status
        });
        await _context.SaveChangesAsync();

        var service = CreateOwnerService(new FakeCurrentUser(owner.Id, true));

        var exception = await Assert.ThrowsAsync<ConflictException>(() =>
            service.SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = false }));

        Assert.Contains("active booking", exception.Message, StringComparison.OrdinalIgnoreCase);

        // The day must remain open: no silent orphaning of the live booking.
        var gate = await _context.HallDayAvailabilities
            .FirstOrDefaultAsync(day => day.HallId == hall.Id && day.Date == date);
        Assert.True(gate is null || gate.IsOpen);
    }

    [Theory]
    [InlineData(BookingStatus.Cancelled)]
    [InlineData(BookingStatus.Rejected)]
    public async Task SetDayBlock_DayWithInactiveBooking_Succeeds(BookingStatus status)
    {
        var owner = await CreateOwnerAsync($"blockdead{status}@example.com", $"+9705991000{(int)status + 20}");
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        _context.Bookings.Add(new Booking
        {
            HallId = hall.Id,
            RequesterUserId = "seeker-1",
            Date = date,
            SlotStart = new TimeOnly(10, 0),
            NameOnBooking = "Layla Hassan",
            Status = status
        });
        await _context.SaveChangesAsync();

        var service = CreateOwnerService(new FakeCurrentUser(owner.Id, true));
        var result = await service.SetDayBlockAsync(
            hall.Id, new OwnerDayBlockRequest { Date = date, IsOpen = false });

        Assert.False(result.IsOpen);
    }

    [Fact]
    public async Task SetDayBlock_PastDate_ThrowsValidation()
    {
        var owner = await CreateOwnerAsync("blockpast@example.com", "+970599100030");
        var hall = AddHall(owner.Id);
        var service = CreateOwnerService(new FakeCurrentUser(owner.Id, true));

        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest { Date = yesterday, IsOpen = false }));
    }

    // ---------- Step C: ShowBookedSlots + hourly window write path ----------

    [Fact]
    public async Task UpdateHourlySettings_ShowBookedSlotsOff_CatalogOmitsBookedSlots()
    {
        var owner = await CreateOwnerAsync("settings1@example.com", "+970599100101");
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        AddBookedSlot(hall.Id, date, new TimeOnly(10, 0));
        var service = CreateOwnerService(new FakeCurrentUser(owner.Id, true));

        // Default is ON: the booked slot is visible and marked Booked.
        var before = await CreateSeekerService().GetHourlyCatalogAsync(hall.Id, date);
        Assert.Equal(HallSlotStatus.Booked, Assert.Single(before.Slots, s => s.StartTime == new TimeOnly(10, 0)).Status);

        var updated = await service.UpdateHourlySettingsAsync(
            hall.Id, new UpdateOwnerHourlySettingsRequest { ShowBookedSlots = false });

        Assert.False(updated.ShowBookedSlots);

        var after = await CreateSeekerService().GetHourlyCatalogAsync(hall.Id, date);
        Assert.DoesNotContain(after.Slots, s => s.StartTime == new TimeOnly(10, 0));
        // Available slots are always returned regardless of the toggle.
        Assert.Contains(after.Slots, s => s.StartTime == new TimeOnly(11, 0));
    }

    [Fact]
    public async Task UpdateHourlySettings_NarrowsWindow_CatalogReflectsNewWindow()
    {
        var owner = await CreateOwnerAsync("settings2@example.com", "+970599100102");
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var service = CreateOwnerService(new FakeCurrentUser(owner.Id, true));

        var updated = await service.UpdateHourlySettingsAsync(hall.Id, new UpdateOwnerHourlySettingsRequest
        {
            HourlySlotStart = new TimeOnly(14, 0),
            HourlySlotEnd = new TimeOnly(17, 0)
        });

        Assert.Equal(new TimeOnly(14, 0), updated.HourlySlotStart);
        Assert.Equal(new TimeOnly(17, 0), updated.HourlySlotEnd);

        var catalog = await CreateSeekerService().GetHourlyCatalogAsync(hall.Id, date);
        Assert.Equal(3, catalog.Slots.Count);
        Assert.Equal(new TimeOnly(14, 0), catalog.Slots[0].StartTime);
        Assert.Equal(new TimeOnly(16, 0), catalog.Slots[2].StartTime);
    }

    [Fact]
    public async Task UpdateHourlySettings_PartialUpdate_KeepsUnspecifiedValues()
    {
        var owner = await CreateOwnerAsync("settings3@example.com", "+970599100103");
        var hall = AddHall(owner.Id);
        var service = CreateOwnerService(new FakeCurrentUser(owner.Id, true));

        await service.UpdateHourlySettingsAsync(hall.Id, new UpdateOwnerHourlySettingsRequest
        {
            HourlySlotStart = new TimeOnly(8, 0),
            HourlySlotEnd = new TimeOnly(12, 0)
        });

        // Toggle only: the window must survive unchanged.
        var afterToggle = await service.UpdateHourlySettingsAsync(
            hall.Id, new UpdateOwnerHourlySettingsRequest { ShowBookedSlots = false });

        Assert.False(afterToggle.ShowBookedSlots);
        Assert.Equal(new TimeOnly(8, 0), afterToggle.HourlySlotStart);
        Assert.Equal(new TimeOnly(12, 0), afterToggle.HourlySlotEnd);

        var persisted = await _context.Halls.FirstAsync(h => h.Id == hall.Id);
        Assert.Equal(new TimeOnly(8, 0), persisted.HourlySlotStart);
        Assert.Equal(new TimeOnly(12, 0), persisted.HourlySlotEnd);
        Assert.False(persisted.ShowBookedSlots);
    }

    [Fact]
    public async Task UpdateHourlySettings_StartAfterEnd_ThrowsValidation()
    {
        var owner = await CreateOwnerAsync("settings4@example.com", "+970599100104");
        var hall = AddHall(owner.Id);
        var service = CreateOwnerService(new FakeCurrentUser(owner.Id, true));

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.UpdateHourlySettingsAsync(hall.Id, new UpdateOwnerHourlySettingsRequest
            {
                HourlySlotStart = new TimeOnly(18, 0),
                HourlySlotEnd = new TimeOnly(10, 0)
            }));
    }

    [Fact]
    public async Task UpdateHourlySettings_AnotherOwner_ThrowsNotFound()
    {
        var ownerA = await CreateOwnerAsync("settingsa@example.com", "+970599100105");
        var ownerB = await CreateOwnerAsync("settingsb@example.com", "+970599100106");
        var hall = AddHall(ownerA.Id);
        var service = CreateOwnerService(new FakeCurrentUser(ownerB.Id, true));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.UpdateHourlySettingsAsync(
                hall.Id, new UpdateOwnerHourlySettingsRequest { ShowBookedSlots = false }));

        var persisted = await _context.Halls.FirstAsync(h => h.Id == hall.Id);
        Assert.True(persisted.ShowBookedSlots);
    }

    [Fact]
    public async Task UpdateHourlySettings_Unauthenticated_ThrowsUnauthorized()
    {
        var owner = await CreateOwnerAsync("settings5@example.com", "+970599100107");
        var hall = AddHall(owner.Id);
        var service = CreateOwnerService(new FakeCurrentUser(null, false));

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.UpdateHourlySettingsAsync(
                hall.Id, new UpdateOwnerHourlySettingsRequest { ShowBookedSlots = false }));
    }

    [Fact]
    public async Task UpdateHourlySettings_ToggleDoesNotAlterExistingBookings()
    {
        var owner = await CreateOwnerAsync("settings6@example.com", "+970599100108");
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var booking = new Booking
        {
            HallId = hall.Id,
            RequesterUserId = "seeker-1",
            Date = date,
            SlotStart = new TimeOnly(10, 0),
            NameOnBooking = "Layla Hassan",
            Status = BookingStatus.Accepted
        };
        _context.Bookings.Add(booking);
        await _context.SaveChangesAsync();

        var service = CreateOwnerService(new FakeCurrentUser(owner.Id, true));
        await service.UpdateHourlySettingsAsync(
            hall.Id, new UpdateOwnerHourlySettingsRequest { ShowBookedSlots = false });

        var persisted = await _context.Bookings.FirstAsync(b => b.Id == booking.Id);
        Assert.Equal(BookingStatus.Accepted, persisted.Status);
        Assert.Equal("Layla Hassan", persisted.NameOnBooking);

        // A display toggle must not create or mutate any hourly-slot state.
        Assert.Empty(await _context.HallSlotAvailabilities.ToListAsync());
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
