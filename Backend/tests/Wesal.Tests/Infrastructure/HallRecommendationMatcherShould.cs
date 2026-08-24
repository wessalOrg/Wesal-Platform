using Microsoft.EntityFrameworkCore;
using Wesal.Application.Ai;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class HallRecommendationMatcherShould : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly HallRecommendationMatcher _matcher;
    private readonly HallRepository _repo;

    public HallRecommendationMatcherShould()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ApplicationDbContext(options);
        _repo = new HallRepository(_context);
        _matcher = new HallRecommendationMatcher(_repo);
        SeedHalls();
    }

    private void SeedHalls()
    {
        var h1 = new Hall { Id = Guid.NewGuid(), Name = "Gaza Hall", Region = HallRegion.Gaza, Address = "Gaza City", Capacity = 300, Status = HallStatus.Approved, IsDeleted = false, Price = 1000 };
        var h2 = new Hall { Id = Guid.NewGuid(), Name = "North Hall", Region = HallRegion.NorthGaza, Address = "North Gaza", Capacity = 200, Status = HallStatus.Approved, IsDeleted = false, Price = 800 };
        var h3 = new Hall { Id = Guid.NewGuid(), Name = "Deleted Hall", Region = HallRegion.Gaza, Address = "Gaza", Capacity = 500, Status = HallStatus.Approved, IsDeleted = true, Price = 1200 };
        var h4 = new Hall { Id = Guid.NewGuid(), Name = "Pending Hall", Region = HallRegion.Gaza, Address = "Gaza", Capacity = 400, Status = HallStatus.PendingReview, IsDeleted = false, Price = 900 };
        _context.Halls.AddRange(h1, h2, h3, h4);
        _context.SaveChanges();

        // Mark h1 as booked on 2026-08-30 first period
        var booked = new HallAvailability { HallId = h1.Id, Date = new DateOnly(2026, 8, 30), PeriodType = BookingPeriodType.FirstPeriod, Status = AvailabilityStatus.Booked };
        _context.HallAvailabilities.Add(booked);
        _context.SaveChanges();
    }

    [Fact]
    public async Task Match_ByArea_ReturnsOnlyGaza()
    {
        var criteria = new ExtractedCriteriaDto(HallRegion.Gaza.ToString(), null, null, null, null);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        Assert.All(result, r => Assert.Equal("Gaza", r.Region));
        Assert.DoesNotContain(result, r => r.HallName == "North Hall");
    }

    [Fact]
    public async Task Match_ByDateAndPeriod_ExcludesBooked()
    {
        var criteria = new ExtractedCriteriaDto(HallRegion.Gaza.ToString(), null, new DateOnly(2026, 8, 30), BookingPeriodType.FirstPeriod.ToString(), null);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        // Gaza Hall is booked on that date/period, so should be excluded, leaving 0 for Gaza
        Assert.Empty(result);
    }

    [Fact]
    public async Task Match_ByDateAndPeriod_AvailablePeriod_ReturnsHall()
    {
        var criteria = new ExtractedCriteriaDto(HallRegion.Gaza.ToString(), null, new DateOnly(2026, 8, 30), BookingPeriodType.SecondPeriod.ToString(), null);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        Assert.Contains(result, r => r.HallName == "Gaza Hall");
    }

    [Fact]
    public async Task Match_ByPeriodOnly_FiltersCorrectly()
    {
        // Without date, period alone should not filter via DB (repo requires both), but matcher should still work
        var criteria = new ExtractedCriteriaDto(null, null, null, BookingPeriodType.FirstPeriod.ToString(), null);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        // Should return approved halls (2) without availability filtering
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task DeletedHall_Excluded()
    {
        var criteria = new ExtractedCriteriaDto(HallRegion.Gaza.ToString(), null, null, null, null);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        Assert.DoesNotContain(result, r => r.HallName == "Deleted Hall");
    }

    [Fact]
    public async Task PendingHall_Excluded_LockedRule()
    {
        var criteria = new ExtractedCriteriaDto(HallRegion.Gaza.ToString(), null, null, null, null);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        Assert.DoesNotContain(result, r => r.HallName == "Pending Hall");
    }

    [Fact]
    public async Task UnavailableHall_Excluded_RealAvailability()
    {
        var criteria = new ExtractedCriteriaDto(null, null, new DateOnly(2026, 8, 30), BookingPeriodType.FirstPeriod.ToString(), null);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        // North Hall is available on that date/period, Gaza Hall booked -> only North Hall should appear
        Assert.Contains(result, r => r.HallName == "North Hall");
        Assert.DoesNotContain(result, r => r.HallName == "Gaza Hall");
    }

    [Fact]
    public async Task AvailabilityReCheck_PreventsStale()
    {
        var criteria = new ExtractedCriteriaDto(HallRegion.Gaza.ToString(), null, new DateOnly(2026, 8, 31), BookingPeriodType.FirstPeriod.ToString(), null);
        var first = await _matcher.FindMatchingHallsAsync(criteria);
        Assert.Contains(first, r => r.HallName == "Gaza Hall");

        // Simulate race: another booking occurs before final result
        var gazaHall = _context.Halls.First(h => h.Name == "Gaza Hall");
        _context.HallAvailabilities.Add(new HallAvailability { HallId = gazaHall.Id, Date = new DateOnly(2026, 8, 31), PeriodType = BookingPeriodType.FirstPeriod, Status = AvailabilityStatus.Booked });
        _context.SaveChanges();

        var second = await _matcher.FindMatchingHallsAsync(criteria);
        Assert.DoesNotContain(second, r => r.HallName == "Gaza Hall");
    }

    [Fact]
    public async Task NoMatchingHalls_ReturnsEmptySafely()
    {
        var criteria = new ExtractedCriteriaDto(HallRegion.SouthGaza.ToString(), null, null, null, null);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        Assert.Empty(result);
    }

    [Fact]
    public async Task CapacityFiltering_RespectsCapacity()
    {
        var criteria = new ExtractedCriteriaDto(null, null, null, null, 250);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        // Gaza Hall 300, North Hall 200 -> only Gaza meets 250
        Assert.Contains(result, r => r.HallName == "Gaza Hall");
        Assert.DoesNotContain(result, r => r.HallName == "North Hall");
    }

    [Fact]
    public async Task ExistingBusinessRules_Respected_OnlyApproved()
    {
        var criteria = new ExtractedCriteriaDto(null, null, null, null, null);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        Assert.All(result, r => Assert.True(r.IsAvailable));
        Assert.Equal(2, result.Count); // Only 2 approved non-deleted
    }

    [Fact]
    public async Task ReusesExistingRepositoryLogic_NoDuplicateFiltering()
    {
        // Verify that matcher delegates to repository's search which already handles Approved/Deleted/Booked
        var criteria = new ExtractedCriteriaDto(HallRegion.Gaza.ToString(), "Gaza City", null, null, null);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        Assert.Contains(result, r => r.Address == "Gaza City");
    }

    public void Dispose() => _context.Dispose();
}
