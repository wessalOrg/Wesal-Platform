using Microsoft.EntityFrameworkCore;
using Wesal.Application.Ai;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Infrastructure.Halls;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class HallRecommendationMatcherShould : IDisposable
{
    private static readonly DateOnly BookedDate = new(2026, 8, 30);
    private static readonly TimeOnly BookedStart = new(10, 0);
    private static readonly TimeOnly FreeStart = new(11, 0);

    private readonly ApplicationDbContext _context;
    private readonly HallRecommendationMatcher _matcher;
    private readonly HallSearchService _search;
    private readonly HallRepository _repo;

    public HallRecommendationMatcherShould()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ApplicationDbContext(options);
        _repo = new HallRepository(_context);
        _search = new HallSearchService(_repo);
        _matcher = new HallRecommendationMatcher(_search);
        SeedHalls();
    }

    private void SeedHalls()
    {
        var h1 = new Hall { Id = Guid.NewGuid(), Name = "Gaza Hall", Region = HallRegion.Gaza, Address = "Gaza City", Capacity = 300, Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, IsDeleted = false, Price = 1000 };
        var h2 = new Hall { Id = Guid.NewGuid(), Name = "North Hall", Region = HallRegion.NorthGaza, Address = "North Gaza", Capacity = 200, Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, IsDeleted = false, Price = 800 };
        var h3 = new Hall { Id = Guid.NewGuid(), Name = "Deleted Hall", Region = HallRegion.Gaza, Address = "Gaza", Capacity = 500, Status = HallStatus.Approved, IsDeleted = true, Price = 1200 };
        var h4 = new Hall { Id = Guid.NewGuid(), Name = "Pending Hall", Region = HallRegion.Gaza, Address = "Gaza", Capacity = 400, Status = HallStatus.PendingReview, IsDeleted = false, Price = 900 };
        _context.Halls.AddRange(h1, h2, h3, h4);
        _context.SaveChanges();

        // Mark h1 as booked on 2026-08-30 at 10:00
        var booked = new HallSlotAvailability { HallId = h1.Id, Date = BookedDate, StartTime = BookedStart, Status = HallSlotStatus.Booked };
        _context.HallSlotAvailabilities.Add(booked);
        _context.SaveChanges();
    }

    [Fact]
    public async Task Match_ByArea_ReturnsOnlyGaza()
    {
        var criteria = new ExtractedCriteriaDto(HallRegion.Gaza.ToString(), null, null, null);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        Assert.All(result, r => Assert.Equal("Gaza", r.Region));
        Assert.DoesNotContain(result, r => r.HallName == "North Hall");
    }

    [Fact]
    public async Task Match_ByDateAndStartTime_ExcludesBooked()
    {
        var result = await _search.SearchHallsAsync(new HallSearchRequest
        {
            Region = HallRegion.Gaza,
            Date = BookedDate,
            StartTime = BookedStart
        });
        // Gaza Hall is booked at that hour, so should be excluded, leaving 0 for Gaza
        Assert.Empty(result.Items);
    }

    [Fact]
    public async Task Match_ByDateAndStartTime_AvailableHour_ReturnsHall()
    {
        var result = await _search.SearchHallsAsync(new HallSearchRequest
        {
            Region = HallRegion.Gaza,
            Date = BookedDate,
            StartTime = FreeStart
        });
        Assert.Contains(result.Items, item => item.HallName == "Gaza Hall");
    }

    [Fact]
    public async Task Match_ByStartTimeOnly_FiltersCorrectly()
    {
        // Without date, a start time alone must not filter via DB (repo requires both)
        var result = await _search.SearchHallsAsync(new HallSearchRequest
        {
            StartTime = BookedStart
        });
        Assert.Equal(2, result.Items.Count);
    }

    [Fact]
    public async Task DeletedHall_Excluded()
    {
        var criteria = new ExtractedCriteriaDto(HallRegion.Gaza.ToString(), null, null, null);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        Assert.DoesNotContain(result, r => r.HallName == "Deleted Hall");
    }

    [Fact]
    public async Task PendingHall_Excluded_LockedRule()
    {
        var criteria = new ExtractedCriteriaDto(HallRegion.Gaza.ToString(), null, null, null);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        Assert.DoesNotContain(result, r => r.HallName == "Pending Hall");
    }

    [Fact]
    public async Task UnavailableHall_Excluded_RealAvailability()
    {
        var result = await _search.SearchHallsAsync(new HallSearchRequest
        {
            Date = BookedDate,
            StartTime = BookedStart
        });
        // North Hall is free at that hour, Gaza Hall booked -> only North Hall should appear
        Assert.Contains(result.Items, item => item.HallName == "North Hall");
        Assert.DoesNotContain(result.Items, item => item.HallName == "Gaza Hall");
    }

    [Fact]
    public async Task AvailabilityReCheck_PreventsStale()
    {
        var criteria = new ExtractedCriteriaDto(HallRegion.Gaza.ToString(), null, new DateOnly(2026, 8, 31), null);
        var first = await _matcher.FindMatchingHallsAsync(criteria);
        Assert.Contains(first, r => r.HallName == "Gaza Hall");

        // Simulate race: another booking occurs before final result
        var gazaHall = _context.Halls.First(h => h.Name == "Gaza Hall");
        _context.HallSlotAvailabilities.Add(new HallSlotAvailability { HallId = gazaHall.Id, Date = new DateOnly(2026, 8, 31), StartTime = BookedStart, Status = HallSlotStatus.Booked });
        _context.SaveChanges();

        var second = await _search.SearchHallsAsync(new HallSearchRequest
        {
            Region = HallRegion.Gaza,
            Date = new DateOnly(2026, 8, 31),
            StartTime = BookedStart
        });
        Assert.DoesNotContain(second.Items, item => item.HallName == "Gaza Hall");
    }

    [Fact]
    public async Task NoMatchingHalls_ReturnsEmptySafely()
    {
        var criteria = new ExtractedCriteriaDto(HallRegion.SouthGaza.ToString(), null, null, null);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        Assert.Empty(result);
    }

    [Fact]
    public async Task CapacityFiltering_RespectsCapacity()
    {
        var criteria = new ExtractedCriteriaDto(null, null, null, 250);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        // Gaza Hall 300, North Hall 200 -> only Gaza meets 250
        Assert.Contains(result, r => r.HallName == "Gaza Hall");
        Assert.DoesNotContain(result, r => r.HallName == "North Hall");
    }

    [Fact]
    public async Task ExistingBusinessRules_Respected_OnlyApproved()
    {
        var criteria = new ExtractedCriteriaDto(null, null, null, null);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        Assert.All(result, r => Assert.True(r.IsAvailable));
        Assert.Equal(2, result.Count); // Only 2 approved non-deleted
    }

    [Fact]
    public async Task ReusesExistingRepositoryLogic_NoDuplicateFiltering()
    {
        // Verify that matcher delegates to repository's search which already handles Approved/Deleted/Booked
        var criteria = new ExtractedCriteriaDto(HallRegion.Gaza.ToString(), "Gaza City", null, null);
        var result = await _matcher.FindMatchingHallsAsync(criteria);
        Assert.Contains(result, r => r.Address == "Gaza City");
    }

    public void Dispose() => _context.Dispose();
}
