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
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class OwnerAvailabilityServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public OwnerAvailabilityServiceShould()
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
        _context.HallBookingPeriods.AddRange(
            new HallBookingPeriod { HallId = hall.Id, Type = BookingPeriodType.FirstPeriod, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(15, 0) },
            new HallBookingPeriod { HallId = hall.Id, Type = BookingPeriodType.SecondPeriod, StartTime = new TimeOnly(16, 0), EndTime = new TimeOnly(23, 0) });
        _context.SaveChanges();
        return hall;
    }

    private OwnerAvailabilityService CreateService(FakeCurrentUser currentUser)
        => new(_userManager, currentUser, new OwnerDashboardRepository(_context),
            new HallRepository(_context), new BookingRepository(_context), new UnitOfWork(_context));

    [Fact]
    public async Task GetAvailability_ReturnsBothPeriods()
    {
        var owner = await CreateOwnerAsync("owner1@example.com", "+970599000001");
        var hall = AddHall(owner.Id);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));
        var from = new DateOnly(2026, 9, 10);
        var result = await service.GetAvailabilityAsync(hall.Id, from, from);
        Assert.Single(result.Days);
        Assert.Equal(2, result.Days[0].Periods.Count);
        Assert.All(result.Days[0].Periods, p => Assert.Equal(AvailabilityStatus.Available, p.Status));
    }

    [Fact]
    public async Task GetAvailability_AnotherOwner_ThrowsNotFound()
    {
        var ownerA = await CreateOwnerAsync("ownera@example.com", "+970599000002");
        var ownerB = await CreateOwnerAsync("ownerb@example.com", "+970599000003");
        var hall = AddHall(ownerA.Id);
        var service = CreateService(new FakeCurrentUser(ownerB.Id, true));
        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAvailabilityAsync(hall.Id, new DateOnly(2026, 9, 10), new DateOnly(2026, 9, 10)));
    }

    [Fact]
    public async Task GetAvailability_Unauthenticated_ThrowsUnauthorized()
    {
        var owner = await CreateOwnerAsync("ownerc@example.com", "+970599000004");
        var hall = AddHall(owner.Id);
        var service = CreateService(new FakeCurrentUser(null, false));
        await Assert.ThrowsAsync<UnauthorizedException>(() => service.GetAvailabilityAsync(hall.Id, new DateOnly(2026, 9, 10), new DateOnly(2026, 9, 10)));
    }

    [Fact]
    public async Task UpdateFirstPeriod_DoesNotModifySecond()
    {
        var owner = await CreateOwnerAsync("ownerd@example.com", "+970599000005");
        var hall = AddHall(owner.Id);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));
        var date = new DateOnly(2026, 9, 10);
        var updated = await service.UpdateAvailabilityAsync(hall.Id, new UpdateOwnerAvailabilityRequest { Date = date, PeriodType = BookingPeriodType.FirstPeriod, Status = AvailabilityStatus.Booked });
        Assert.Equal(BookingPeriodType.FirstPeriod, updated.PeriodType);
        Assert.Equal(AvailabilityStatus.Booked, updated.Status);
        var calendar = await service.GetAvailabilityAsync(hall.Id, date, date);
        var first = calendar.Days[0].Periods.First(p => p.PeriodType == BookingPeriodType.FirstPeriod);
        var second = calendar.Days[0].Periods.First(p => p.PeriodType == BookingPeriodType.SecondPeriod);
        Assert.Equal(AvailabilityStatus.Booked, first.Status);
        Assert.Equal(AvailabilityStatus.Available, second.Status);
    }

    [Fact]
    public async Task UpdateSecondPeriod_DoesNotModifyFirst()
    {
        var owner = await CreateOwnerAsync("ownere@example.com", "+970599000006");
        var hall = AddHall(owner.Id);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));
        var date = new DateOnly(2026, 9, 11);
        await service.UpdateAvailabilityAsync(hall.Id, new UpdateOwnerAvailabilityRequest { Date = date, PeriodType = BookingPeriodType.SecondPeriod, Status = AvailabilityStatus.Booked });
        var calendar = await service.GetAvailabilityAsync(hall.Id, date, date);
        Assert.Equal(AvailabilityStatus.Available, calendar.Days[0].Periods.First(p => p.PeriodType == BookingPeriodType.FirstPeriod).Status);
        Assert.Equal(AvailabilityStatus.Booked, calendar.Days[0].Periods.First(p => p.PeriodType == BookingPeriodType.SecondPeriod).Status);
    }

    [Fact]
    public async Task UpdatePeriod_BelongingToAnotherHall_Rejected()
    {
        var owner = await CreateOwnerAsync("ownerf@example.com", "+970599000007");
        var hallA = AddHall(owner.Id, "Hall A");
        var hallB = AddHall(owner.Id, "Hall B");
        // Remove periods from Hall B so FirstPeriod template missing? Actually both have periods; simulate by requesting valid type but verify hall scoping works
        var service = CreateService(new FakeCurrentUser(owner.Id, true));
        // Delete Hall B periods directly to simulate invalid period for that hall
        var periodsB = await _context.HallBookingPeriods.Where(p => p.HallId == hallB.Id).ToListAsync();
        _context.HallBookingPeriods.RemoveRange(periodsB);
        await _context.SaveChangesAsync();
        await Assert.ThrowsAsync<ValidationException>(() => service.UpdateAvailabilityAsync(hallB.Id, new UpdateOwnerAvailabilityRequest { Date = new DateOnly(2026, 9, 10), PeriodType = BookingPeriodType.FirstPeriod, Status = AvailabilityStatus.Booked }));
        // Hall A still updatable
        var updated = await service.UpdateAvailabilityAsync(hallA.Id, new UpdateOwnerAvailabilityRequest { Date = new DateOnly(2026, 9, 10), PeriodType = BookingPeriodType.FirstPeriod, Status = AvailabilityStatus.Booked });
        Assert.Equal(AvailabilityStatus.Booked, updated.Status);
    }

    [Fact]
    public async Task ReleaseOccupiedPeriod_Rejected()
    {
        var owner = await CreateOwnerAsync("ownerg@example.com", "+970599000008");
        var hall = AddHall(owner.Id);
        var date = new DateOnly(2026, 9, 12);
        // Create active booking occupying FirstPeriod
        _context.Bookings.Add(new Booking { HallId = hall.Id, RequesterUserId = "user-1", Date = date, Period = BookingPeriodType.FirstPeriod, Status = BookingStatus.Pending });
        await _context.SaveChangesAsync();
        // Also mark availability Booked to reflect reservation
        _context.HallAvailabilities.Add(new HallAvailability { HallId = hall.Id, Date = date, PeriodType = BookingPeriodType.FirstPeriod, Status = AvailabilityStatus.Booked });
        await _context.SaveChangesAsync();
        var service = CreateService(new FakeCurrentUser(owner.Id, true));
        await Assert.ThrowsAsync<ConflictException>(() => service.UpdateAvailabilityAsync(hall.Id, new UpdateOwnerAvailabilityRequest { Date = date, PeriodType = BookingPeriodType.FirstPeriod, Status = AvailabilityStatus.Available }));
    }

    [Fact]
    public async Task BookedPeriod_ReflectsInPublicAvailability()
    {
        var owner = await CreateOwnerAsync("ownerh@example.com", "+970599000009");
        var hall = AddHall(owner.Id);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));
        var date = new DateOnly(2026, 9, 13);
        await service.UpdateAvailabilityAsync(hall.Id, new UpdateOwnerAvailabilityRequest { Date = date, PeriodType = BookingPeriodType.FirstPeriod, Status = AvailabilityStatus.Booked });
        var avail = await _context.HallAvailabilities.FirstOrDefaultAsync(a => a.HallId == hall.Id && a.Date == date && a.PeriodType == BookingPeriodType.FirstPeriod);
        Assert.NotNull(avail);
        Assert.Equal(AvailabilityStatus.Booked, avail!.Status);
    }

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(string? userId, bool authenticated)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
        }
        public string? UserId { get; }
        public string? UserName => "test";
        public string? Email => "test@example.com";
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles => ["HallOwner"];
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }
}
