using Microsoft.Extensions.Options;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class AiBilingualProcessingShould
{
    private readonly IAiLanguageDetector _detector = new AiLanguageDetector();
    private ISubscriptionPaymentService CreatePayment() => new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions()));

    [Fact]
    public async Task ArabicMessage_ResultsInArabicResponse()
    {
        var service = new HowToService(CreatePayment(), _detector);
        var result = await service.AskHowToAsync("كيف أحجز قاعة", "en", CancellationToken.None);
        Assert.Equal("ar", result.ResponseLanguage);
        Assert.Contains("حجز", result.Answer);
    }

    [Fact]
    public async Task EnglishMessage_ResultsInEnglishResponse()
    {
        var service = new HowToService(CreatePayment(), _detector);
        var result = await service.AskHowToAsync("how do I book a hall", "ar", CancellationToken.None);
        Assert.Equal("en", result.ResponseLanguage);
        Assert.Contains("book", result.Answer, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task MixedAmbiguous_UsesSiteLanguageFallback()
    {
        var service = new HowToService(CreatePayment(), _detector);
        // Balanced mixed should return null detection -> fallback to site language ar
        var result = await service.AskHowToAsync("مرحبا hello", "ar", CancellationToken.None);
        Assert.Equal("ar", result.ResponseLanguage);
    }

    [Fact]
    public async Task MixedAmbiguous_EnglishSiteFallback()
    {
        var service = new HowToService(CreatePayment(), _detector);
        var result = await service.AskHowToAsync("مرحبا hello", "en", CancellationToken.None);
        Assert.Equal("en", result.ResponseLanguage);
    }

    [Fact]
    public async Task SiteLanguage_UsedOnlyWhenDetectionFails()
    {
        var service = new HowToService(CreatePayment(), _detector);
        // Arabic query should ignore site language en
        var arWithEnSite = await service.AskHowToAsync("كيف أبحث عن قاعة", "en", CancellationToken.None);
        Assert.Equal("ar", arWithEnSite.ResponseLanguage);
        // English query should ignore site language ar
        var enWithArSite = await service.AskHowToAsync("how do I search", "ar", CancellationToken.None);
        Assert.Equal("en", enWithArSite.ResponseLanguage);
    }

    [Fact]
    public async Task NoMixedLanguageResponse_WhenDominantDetected()
    {
        var service = new HowToService(CreatePayment(), _detector);
        var result = await service.AskHowToAsync("مرحبا مرحبا مرحبا hello", "en", CancellationToken.None);
        Assert.Equal("ar", result.ResponseLanguage);
        // Should not contain English answer when detected Arabic
        Assert.DoesNotContain("search", result.Answer, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task HowTo_StillFunctional_AfterBilingual()
    {
        var service = new HowToService(CreatePayment(), _detector);
        var result = await service.AskHowToAsync("how to search", "en", CancellationToken.None);
        Assert.NotNull(result.Answer);
        Assert.Equal("en", result.ResponseLanguage);
    }

    [Fact]
    public async Task Recommendation_StillFunctional_AfterBilingual()
    {
        var service = new RecommendationServiceStub(_detector);
        var result = await service.GetRecommendationsAsync("أحتاج قاعة في غزة", "en", CancellationToken.None);
        Assert.Equal("ar", result.ResponseLanguage);
    }

    [Fact]
    public async Task Recommendation_EnglishQuery_ArabicSite_ReturnsEnglish()
    {
        var service = new RecommendationServiceStub(_detector);
        var result = await service.GetRecommendationsAsync("I need a hall in Gaza", "ar", CancellationToken.None);
        Assert.Equal("en", result.ResponseLanguage);
    }

    [Fact]
    public async Task DetectionFailure_UsesSiteLanguageFallback()
    {
        var service = new HowToService(CreatePayment(), _detector);
        var result = await service.AskHowToAsync("123 456", "en", CancellationToken.None);
        Assert.Equal("en", result.ResponseLanguage);
        var resultAr = await service.AskHowToAsync("123 456", "ar", CancellationToken.None);
        Assert.Equal("ar", resultAr.ResponseLanguage);
    }

    [Fact]
    public async Task ExistingChatSessions_RemainFunctional()
    {
        using var sessionService = new ChatSessionService();
        var session = await sessionService.InitializeSessionAsync("ar");
        var retrieved = await sessionService.GetSessionAsync(session.SessionId);
        Assert.NotNull(retrieved);
        Assert.Equal("ar", retrieved!.Language);
    }
}
