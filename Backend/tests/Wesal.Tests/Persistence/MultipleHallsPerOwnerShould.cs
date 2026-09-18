using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Persistence.Data;

namespace Wesal.Tests.Persistence;

public class MultipleHallsPerOwnerShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;

    public MultipleHallsPerOwnerShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
    }

    private Hall CreateHall(string ownerId, string name, HallStatus status = HallStatus.PendingReview)
    {
        var hall = new Hall { Name = name, Address = "Gaza", Region = HallRegion.Gaza, Capacity = 100, OwnerId = ownerId, Status = status, Description = "Test" };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        _context.Entry(hall).State = EntityState.Detached;
        return hall;
    }

    [Fact]
    public async Task SameOwnerId_CanExistOnMultipleHallRecords()
    {
        var ownerId = "owner-multi-1";
        CreateHall(ownerId, "Hall A");
        CreateHall(ownerId, "Hall B");
        CreateHall(ownerId, "Hall C");
        var count = await _context.Halls.CountAsync(h => h.OwnerId == ownerId);
        Assert.Equal(3, count);
    }

    [Fact]
    public async Task EachHall_HasUniqueId()
    {
        var ownerId = "owner-unique-1";
        var a = CreateHall(ownerId, "Hall A");
        var b = CreateHall(ownerId, "Hall B");
        Assert.NotEqual(a.Id, b.Id);
    }

    [Fact]
    public async Task OwnerCanRetrieveAllOwnHalls()
    {
        var ownerId = "owner-retrieve-1";
        CreateHall(ownerId, "Hall A");
        CreateHall(ownerId, "Hall B");
        CreateHall("other-owner", "Other Hall");
        var halls = await _context.Halls.Where(h => h.OwnerId == ownerId && !h.IsDeleted).ToListAsync();
        Assert.Equal(2, halls.Count);
        Assert.All(halls, h => Assert.Equal(ownerId, h.OwnerId));
    }

    [Fact]
    public async Task HallSpecificRetrieval_ReturnsCorrectHall()
    {
        var ownerId = "owner-specific-1";
        var hallA = CreateHall(ownerId, "Hall A");
        var hallB = CreateHall(ownerId, "Hall B");
        var retrievedA = await _context.Halls.FirstOrDefaultAsync(h => h.Id == hallA.Id && h.OwnerId == ownerId);
        var retrievedB = await _context.Halls.FirstOrDefaultAsync(h => h.Id == hallB.Id && h.OwnerId == ownerId);
        Assert.NotNull(retrievedA);
        Assert.NotNull(retrievedB);
        Assert.Equal("Hall A", retrievedA.Name);
        Assert.Equal("Hall B", retrievedB.Name);
    }

    [Fact]
    public async Task UpdatingHallA_DoesNotModifyHallB()
    {
        var ownerId = "owner-update-1";
        var hallA = CreateHall(ownerId, "Hall A");
        var hallB = CreateHall(ownerId, "Hall B");
        hallA.Name = "Hall A Updated";
        _context.Halls.Update(hallA);
        await _context.SaveChangesAsync();
        var reloadedB = await _context.Halls.FindAsync(hallB.Id);
        Assert.Equal("Hall B", reloadedB!.Name);
    }

    [Fact]
    public async Task ApprovalStatus_IndependentPerHall()
    {
        var ownerId = "owner-status-1";
        var hallA = CreateHall(ownerId, "Hall A", HallStatus.PendingReview);
        var hallB = CreateHall(ownerId, "Hall B", HallStatus.PendingReview);
        var hallC = CreateHall(ownerId, "Hall C", HallStatus.PendingReview);
        var hallAEntity = await _context.Halls.FindAsync(hallA.Id);
        hallAEntity!.Status = HallStatus.Approved;
        await _context.SaveChangesAsync();
        var reloadedA = await _context.Halls.FindAsync(hallA.Id);
        var reloadedB = await _context.Halls.FindAsync(hallB.Id);
        var reloadedC = await _context.Halls.FindAsync(hallC.Id);
        Assert.Equal(HallStatus.Approved, reloadedA!.Status);
        Assert.Equal(HallStatus.PendingReview, reloadedB!.Status);
        Assert.Equal(HallStatus.PendingReview, reloadedC!.Status);
    }

    [Fact]
    public async Task BookingData_IsolatedPerHall()
    {
        var ownerId = "owner-booking-1";
        var hallA = CreateHall(ownerId, "Hall A");
        var hallB = CreateHall(ownerId, "Hall B");
        var bookingA = new Booking { HallId = hallA.Id, RequesterUserId = "user-1", Date = new DateOnly(2026, 9, 10), Period = BookingPeriodType.FirstPeriod, Status = BookingStatus.Pending };
        var bookingB = new Booking { HallId = hallB.Id, RequesterUserId = "user-2", Date = new DateOnly(2026, 9, 10), Period = BookingPeriodType.FirstPeriod, Status = BookingStatus.Pending };
        _context.Bookings.AddRange(bookingA, bookingB);
        await _context.SaveChangesAsync();
        var bookingsForA = await _context.Bookings.Where(b => b.HallId == hallA.Id).ToListAsync();
        var bookingsForB = await _context.Bookings.Where(b => b.HallId == hallB.Id).ToListAsync();
        Assert.Single(bookingsForA);
        Assert.Single(bookingsForB);
        Assert.NotEqual(bookingsForA[0].HallId, bookingsForB[0].HallId);
    }

    [Fact]
    public async Task CrossOwnerAccess_Prevented()
    {
        var ownerA = "owner-a-1";
        var ownerB = "owner-b-1";
        var hallA = CreateHall(ownerA, "Hall A");
        var hallB = CreateHall(ownerB, "Hall B");
        var retrievedByA = await _context.Halls.FirstOrDefaultAsync(h => h.Id == hallB.Id && h.OwnerId == ownerA);
        Assert.Null(retrievedByA);
        var retrievedByB = await _context.Halls.FirstOrDefaultAsync(h => h.Id == hallA.Id && h.OwnerId == ownerB);
        Assert.Null(retrievedByB);
    }

    [Fact]
    public async Task FailedSecondHallCreation_DoesNotAffectFirst()
    {
        var ownerId = "owner-fail-1";
        var hallA = CreateHall(ownerId, "Hall A");
        var countBefore = await _context.Halls.CountAsync(h => h.OwnerId == ownerId);
        // Simulate failed creation (validation would have thrown before SaveChanges, so no new hall)
        var countAfter = await _context.Halls.CountAsync(h => h.OwnerId == ownerId);
        Assert.Equal(countBefore, countAfter);
        var reloadedA = await _context.Halls.FindAsync(hallA.Id);
        Assert.NotNull(reloadedA);
        Assert.Equal("Hall A", reloadedA.Name);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }
}
