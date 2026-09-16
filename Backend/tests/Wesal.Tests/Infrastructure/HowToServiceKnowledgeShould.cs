using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Integration tests proving the Knowledge Base feeds official Wesal facts into
/// the HowTo service (the how-to path used by the unified assistant), without
/// hijacking tailored feature guidance and without hallucinating.
/// </summary>
public class HowToServiceKnowledgeShould
{
    private static ISubscriptionPaymentService CreatePaymentService()
        => new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions()));

    private static HowToService CreateService()
        => new HowToService(CreatePaymentService(), knowledgeService: new WesalKnowledgeService());

    [Fact]
    public async Task ArabicPlatformQuestion_AnsweredFromKnowledgeBase()
    {
        var result = await CreateService().AskHowToAsync("شو هي وصال؟", "ar", CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
        Assert.Contains("وصال", result.Answer);
        Assert.Equal("platform", result.Category);
    }

    [Fact]
    public async Task EnglishPlatformQuestion_UsesOfficialDescription()
    {
        var result = await CreateService().AskHowToAsync("what is wesal?", "en", CancellationToken.None);

        Assert.Equal("en", result.ResponseLanguage);
        Assert.Contains("Wesal", result.Answer);
        Assert.DoesNotContain("wedding hall booking platform for Gaza", result.Answer, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task DevQuestion_ReturnsOfficialPrimaryDevelopers()
    {
        var result = await CreateService().AskHowToAsync("who are the primary developers?", "en", CancellationToken.None);

        Assert.Contains("Abdulaziz Al-Khazendar", result.Answer);
        Assert.Contains("Mohammed Shama", result.Answer);
    }

    [Fact]
    public async Task ArabicDevQuestion_ReturnsOfficialTeam()
    {
        var result = await CreateService().AskHowToAsync("مين مطورين وصال؟", "ar", CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
        Assert.Contains("محمد شمعة", result.Answer);
    }

    [Fact]
    public async Task WhatsAppQuestion_ReturnsOfficialContact()
    {
        var result = await CreateService().AskHowToAsync("شو رقم واتساب وصال؟", "ar", CancellationToken.None);

        Assert.Contains("+970567581412", result.Answer);
        Assert.Equal("platform", result.Category);
    }

    [Fact]
    public async Task SupportHoursQuestion_ReturnsOfficialHours()
    {
        var result = await CreateService().AskHowToAsync("ما هي ساعات الدعم؟", "ar", CancellationToken.None);

        Assert.Contains("9:00", result.Answer);
        Assert.Contains("6:00", result.Answer);
    }

    [Fact]
    public async Task PriceQuestion_DoesNotInventFixedPrice()
    {
        var result = await CreateService().AskHowToAsync("كم سعر وصال؟", "ar", CancellationToken.None);

        Assert.Contains("يختلف", result.Answer);
        Assert.DoesNotContain("شيكل", result.Answer);
        Assert.DoesNotContain("دولار", result.Answer);
    }

    [Fact]
    public async Task PriceQuestionEnglish_DoesNotInventFixedPrice()
    {
        var result = await CreateService().AskHowToAsync("how much does wesal cost?", "en", CancellationToken.None);

        Assert.Contains("varies", result.Answer, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ILS", result.Answer, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("shekel", result.Answer, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ContactOwnerQuestion_NotHijackedBySupportContact()
    {
        var result = await CreateService().AskHowToAsync("how do I contact the hall owner?", "en", CancellationToken.None);

        Assert.Equal("messaging", result.Category);
        Assert.Contains("Contact Hall Owner", result.Answer);
        Assert.DoesNotContain("+970567581412", result.Answer);
    }

    [Fact]
    public async Task BookingHowTo_KeepsTailoredGuidance()
    {
        var result = await CreateService().AskHowToAsync("how do I book a hall?", "en", CancellationToken.None);

        Assert.Equal("booking", result.Category);
        Assert.Contains("Book", result.Answer);
    }

    [Fact]
    public async Task RatingHowTo_KeepsTailoredGuidance()
    {
        var result = await CreateService().AskHowToAsync("how do I rate a hall?", "en", CancellationToken.None);

        Assert.Equal("ratings", result.Category);
    }

    [Fact]
    public async Task SearchHowTo_KeepsTailoredGuidance()
    {
        var result = await CreateService().AskHowToAsync("how do I search for halls?", "en", CancellationToken.None);

        Assert.Equal("search", result.Category);
    }

    [Fact]
    public async Task PrivacyQuestion_ReturnedWithVerificationCaveat()
    {
        var result = await CreateService().AskHowToAsync("what is the wesal privacy policy?", "en", CancellationToken.None);

        Assert.Equal("policies", result.Category);
        Assert.Contains("privacy", result.Answer, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("pending verification", result.Answer, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task NeedsVerificationArticle_NotPresentedAsConfirmed()
    {
        var result = await CreateService().AskHowToAsync("what is wesal?", "en", CancellationToken.None);

        Assert.Contains("pending verification", result.Answer, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task UnrecognizedQuestion_DoesNotHallucinate()
    {
        var result = await CreateService().AskHowToAsync("ashtal zork gosta klamba", "en", CancellationToken.None);

        Assert.NotNull(result.Answer);
        Assert.Contains("I can help you", result.Answer);
    }

    [Fact]
    public async Task GeminiDisabled_KnowledgeStillAnswersOfficialQuestions()
    {
        // No Gemini configured; official questions must still resolve from the KB.
        var result = await CreateService().AskHowToAsync("what is wesal?", "en", CancellationToken.None);

        Assert.Contains("Wesal", result.Answer);
    }

    [Fact]
    public async Task ArabicFallbackSiteLanguage_OfficialQuestionStillArabic()
    {
        var result = await CreateService().AskHowToAsync("شو هي وصال؟", "en", CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
        Assert.Contains("وصال", result.Answer);
    }
}