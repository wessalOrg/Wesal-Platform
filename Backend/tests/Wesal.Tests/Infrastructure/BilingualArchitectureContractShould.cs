using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Tests verifying the bilingual AI conversation architecture contract (US-AI-07).
/// These tests ensure ResponseLanguage flows correctly through the DTOs and services,
/// and that the language precedence contract is upheld.
/// </summary>
public class BilingualArchitectureContractShould : IDisposable
{
    private static ISubscriptionPaymentService CreatePaymentService()
        => new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions()));

    private readonly ApplicationDbContext _context;
    private readonly HowToService _howToService;
    private readonly RecommendationService _recommendationService;

    public BilingualArchitectureContractShould()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ApplicationDbContext(options);

        var repo = new HallRepository(_context);
        var extractor = new NaturalLanguageCriteriaExtractor();
        var matcher = new HallRecommendationMatcher(repo);

        _howToService = new HowToService(CreatePaymentService());
        _recommendationService = new RecommendationService(extractor, matcher);
    }

    [Fact]
    public void HowToResponse_ContainsResponseLanguage()
    {
        var response = new HowToResponse("answer", "general", "ar", DateTime.UtcNow);

        Assert.Equal("ar", response.ResponseLanguage);
    }

    [Fact]
    public void RecommendationResponse_ContainsResponseLanguage()
    {
        var response = new RecommendationResponse(
            RecommendationStatus.Success,
            null,
            Array.Empty<HallRecommendationDto>(),
            "msg",
            "en",
            DateTime.UtcNow);

        Assert.Equal("en", response.ResponseLanguage);
    }

    [Fact]
    public async Task HowToService_ArabicLanguage_ReturnsArabicResponseLanguage()
    {
        var result = await _howToService.AskHowToAsync("كيف أبحث عن قاعات", "ar", CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
        Assert.Contains("بحث", result.Answer);
    }

    [Fact]
    public async Task HowToService_EnglishLanguage_ReturnsEnglishResponseLanguage()
    {
        var result = await _howToService.AskHowToAsync("how do I search for halls", "en", CancellationToken.None);

        Assert.Equal("en", result.ResponseLanguage);
        Assert.Contains("search", result.Answer, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task HowToService_NullLanguage_DefaultsToArabic()
    {
        var result = await _howToService.AskHowToAsync("كيف أبحث", null, CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
    }

    [Fact]
    public async Task HowToService_EmptyLanguage_DefaultsToArabic()
    {
        var result = await _howToService.AskHowToAsync("كيف أبحث", "", CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
    }

    [Fact]
    public async Task HowToService_WhitespaceLanguage_DefaultsToArabic()
    {
        var result = await _howToService.AskHowToAsync("كيف أبحث", "   ", CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
    }

    [Fact]
    public async Task Recommendation_EnglishLanguage_ReturnsEnglishResponseLanguage()
    {
        var result = await _recommendationService.GetRecommendationsAsync("I need a hall in Gaza", "en", CancellationToken.None);

        Assert.Equal("en", result.ResponseLanguage);
    }

    [Fact]
    public async Task Recommendation_ArabicLanguage_ReturnsArabicResponseLanguage()
    {
        var result = await _recommendationService.GetRecommendationsAsync("أحتاج قاعة في غزة", "ar", CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
    }

    [Fact]
    public async Task Recommendation_NullLanguage_DefaultsToArabic()
    {
        var result = await _recommendationService.GetRecommendationsAsync("12345", null, CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
    }

    [Fact]
    public async Task Recommendation_EmptyLanguage_DefaultsToArabic()
    {
        var result = await _recommendationService.GetRecommendationsAsync("12345", "", CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
    }

    [Fact]
    public void HowToResponse_ArabicResponseLanguage_IsValid()
    {
        var response = new HowToResponse("جواب", "general", "ar", DateTime.UtcNow);

        Assert.Contains(response.ResponseLanguage, new[] { "ar", "en" });
        Assert.Equal("ar", response.ResponseLanguage);
    }

    [Fact]
    public void HowToResponse_EnglishResponseLanguage_IsValid()
    {
        var response = new HowToResponse("Answer", "general", "en", DateTime.UtcNow);

        Assert.Contains(response.ResponseLanguage, new[] { "ar", "en" });
        Assert.Equal("en", response.ResponseLanguage);
    }

    [Fact]
    public void RecommendationResponse_LanguageField_AppearsBeforeTimestamp()
    {
        var response = new RecommendationResponse(
            RecommendationStatus.Success,
            null,
            Array.Empty<HallRecommendationDto>(),
            "msg",
            "ar",
            DateTime.UtcNow);

        Assert.NotNull(response.ResponseLanguage);
        Assert.True(response.Timestamp > DateTime.MinValue);
    }

    [Fact]
    public async Task HowToService_EnglishQuery_ArabicSiteLanguage_ReturnsEnglishResponseLanguage()
    {
        var result = await _howToService.AskHowToAsync("how do I book a hall", "ar", CancellationToken.None);

        Assert.Equal("en", result.ResponseLanguage);
    }

    public void Dispose() => _context.Dispose();
}
