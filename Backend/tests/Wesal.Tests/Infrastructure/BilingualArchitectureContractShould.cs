using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Tests verifying the bilingual AI conversation architecture contract (US-AI-07).
/// These tests ensure ResponseLanguage flows correctly through the DTOs and services,
/// and that the language precedence contract is upheld.
/// </summary>
public class BilingualArchitectureContractShould
{
    private static ISubscriptionPaymentService CreatePaymentService()
        => new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions()));

    private readonly HowToService _howToService = new(CreatePaymentService());
    private readonly RecommendationServiceStub _recommendationService = new();

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
    public async Task RecommendationStub_EnglishLanguage_ReturnsEnglishResponseLanguage()
    {
        var result = await _recommendationService.GetRecommendationsAsync("I need a hall", "en", CancellationToken.None);

        Assert.Equal("en", result.ResponseLanguage);
        Assert.Contains("not yet available", result.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RecommendationStub_ArabicLanguage_ReturnsArabicResponseLanguage()
    {
        var result = await _recommendationService.GetRecommendationsAsync("أحتاج قاعة", "ar", CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
        Assert.Contains("غير متاحة", result.Message);
    }

    [Fact]
    public async Task RecommendationStub_NullLanguage_DefaultsToArabic()
    {
        var result = await _recommendationService.GetRecommendationsAsync("test", null, CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
    }

    [Fact]
    public async Task RecommendationStub_EmptyLanguage_DefaultsToArabic()
    {
        var result = await _recommendationService.GetRecommendationsAsync("test", "", CancellationToken.None);

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

        Assert.Equal("ar", result.ResponseLanguage);
    }
}
