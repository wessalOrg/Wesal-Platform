using Microsoft.EntityFrameworkCore;
using Wesal.Application.Ai;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class RecommendationServiceShould : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly RecommendationService _service;

    public RecommendationServiceShould()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ApplicationDbContext(options);

        var repo = new HallRepository(_context);
        var extractor = new NaturalLanguageCriteriaExtractor();
        var matcher = new HallRecommendationMatcher(repo);
        _service = new RecommendationService(extractor, matcher);

        SeedHalls();
    }

    private void SeedHalls()
    {
        _context.Halls.AddRange(
            new Hall { Id = Guid.NewGuid(), Name = "Gaza Grand Hall", Region = HallRegion.Gaza, Address = "Gaza City Center", Capacity = 300, Status = HallStatus.Approved, IsDeleted = false, Price = 1500, ShowPrice = true },
            new Hall { Id = Guid.NewGuid(), Name = "North Celebration Hall", Region = HallRegion.NorthGaza, Address = "Jabalia", Capacity = 200, Status = HallStatus.Approved, IsDeleted = false, Price = 800, ShowPrice = true },
            new Hall { Id = Guid.NewGuid(), Name = "South Hall", Region = HallRegion.SouthGaza, Address = "Khan Yunis", Capacity = 400, Status = HallStatus.Approved, IsDeleted = false, Price = 1200, ShowPrice = true },
            new Hall { Id = Guid.NewGuid(), Name = "Deleted Hall", Region = HallRegion.Gaza, Address = "Gaza", Capacity = 500, Status = HallStatus.Approved, IsDeleted = true, Price = 1000 },
            new Hall { Id = Guid.NewGuid(), Name = "Pending Hall", Region = HallRegion.Gaza, Address = "Gaza", Capacity = 350, Status = HallStatus.PendingReview, IsDeleted = false, Price = 900 }
        );
        _context.SaveChanges();
    }

    [Fact]
    public async Task ReturnsSuccess_WhenRegionMatched()
    {
        var result = await _service.GetRecommendationsAsync("I need a hall in Gaza for 250 people", "en", CancellationToken.None);

        Assert.Equal(RecommendationStatus.Success, result.Status);
        Assert.NotEmpty(result.Recommendations);
        Assert.All(result.Recommendations, r => Assert.Equal("Gaza", r.Region));
    }

    [Fact]
    public async Task ReturnsSuccess_WhenArabicQuery()
    {
        var result = await _service.GetRecommendationsAsync("أحتاج قاعة في غزة سعة 250 شخص", "ar", CancellationToken.None);

        Assert.Equal(RecommendationStatus.Success, result.Status);
        Assert.NotEmpty(result.Recommendations);
    }

    [Fact]
    public async Task ExtractsAndReturnsCriteria()
    {
        var result = await _service.GetRecommendationsAsync("I need a hall in Gaza for 250 people", "en", CancellationToken.None);

        Assert.NotNull(result.ExtractedCriteria);
        Assert.Equal("Gaza", result.ExtractedCriteria.Region);
        Assert.Equal(250, result.ExtractedCriteria.Capacity);
    }

    [Fact]
    public async Task FiltersByCapacity()
    {
        // 350 capacity: only South Hall (400) qualifies
        var result = await _service.GetRecommendationsAsync("I need a hall for 350 people", "en", CancellationToken.None);

        Assert.Equal(RecommendationStatus.Success, result.Status);
        Assert.Single(result.Recommendations);
        Assert.Equal("South Hall", result.Recommendations[0].HallName);
    }

    [Fact]
    public async Task ReturnsNoResults_WhenNoMatch()
    {
        var result = await _service.GetRecommendationsAsync("I need a hall in South Gaza for 5000 people", "en", CancellationToken.None);

        Assert.Equal(RecommendationStatus.NoResults, result.Status);
        Assert.Empty(result.Recommendations);
    }

    [Fact]
    public async Task ReturnsIncompleteCriteria_WhenEmptyMessage()
    {
        var result = await _service.GetRecommendationsAsync("hello", "en", CancellationToken.None);

        Assert.Equal(RecommendationStatus.IncompleteCriteria, result.Status);
        Assert.Empty(result.Recommendations);
    }

    [Fact]
    public async Task ExcludesDeletedHalls()
    {
        var result = await _service.GetRecommendationsAsync("I need a hall in Gaza", "en", CancellationToken.None);

        Assert.DoesNotContain(result.Recommendations, r => r.HallName == "Deleted Hall");
    }

    [Fact]
    public async Task ExcludesPendingHalls()
    {
        var result = await _service.GetRecommendationsAsync("I need a hall in Gaza", "en", CancellationToken.None);

        Assert.DoesNotContain(result.Recommendations, r => r.HallName == "Pending Hall");
    }

    [Fact]
    public async Task ReturnsResponseLanguage()
    {
        var resultEn = await _service.GetRecommendationsAsync("I need a hall in Gaza", "en", CancellationToken.None);
        Assert.Equal("en", resultEn.ResponseLanguage);

        var resultAr = await _service.GetRecommendationsAsync("أحتاج قاعة في غزة", "ar", CancellationToken.None);
        Assert.Equal("ar", resultAr.ResponseLanguage);
    }

    [Fact]
    public async Task ReturnsUtcTimestamp()
    {
        var before = DateTime.UtcNow;
        var result = await _service.GetRecommendationsAsync("I need a hall in Gaza for 200", "en", CancellationToken.None);
        var after = DateTime.UtcNow;

        Assert.True(result.Timestamp >= before.AddSeconds(-1));
        Assert.True(result.Timestamp <= after.AddSeconds(1));
    }

    [Fact]
    public async Task ReturnsRealHallData_NotFake()
    {
        var result = await _service.GetRecommendationsAsync("I need a hall in Gaza for 250", "en", CancellationToken.None);

        Assert.Equal(RecommendationStatus.Success, result.Status);
        var hall = result.Recommendations[0];
        Assert.NotEqual(Guid.Empty, hall.HallId);
        Assert.False(string.IsNullOrEmpty(hall.HallName));
        Assert.False(string.IsNullOrEmpty(hall.Address));
        Assert.True(hall.Capacity > 0);
        Assert.True(hall.IsAvailable);
        Assert.Null(hall.UnavailableReason);
    }

    [Fact]
    public async Task InjectsDependencies_CallsExtractorAndMatcher()
    {
        // Verify the service actually uses the pipeline by checking criteria are extracted
        var result = await _service.GetRecommendationsAsync("I need a hall in North Gaza for 100 people", "en", CancellationToken.None);

        Assert.NotNull(result.ExtractedCriteria);
        Assert.Equal("NorthGaza", result.ExtractedCriteria.Region);
        Assert.Equal(100, result.ExtractedCriteria.Capacity);
    }

    [Fact]
    public async Task MultipleRegions_Work()
    {
        var resultGaza = await _service.GetRecommendationsAsync("I need a hall in Gaza", "en", CancellationToken.None);
        Assert.All(resultGaza.Recommendations, r => Assert.Equal("Gaza", r.Region));

        var resultNorth = await _service.GetRecommendationsAsync("I need a hall in North Gaza", "en", CancellationToken.None);
        Assert.All(resultNorth.Recommendations, r => Assert.Equal("North Gaza", r.Region));
    }

    public void Dispose() => _context.Dispose();
}
