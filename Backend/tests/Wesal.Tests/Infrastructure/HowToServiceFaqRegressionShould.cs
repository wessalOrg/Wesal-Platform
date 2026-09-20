using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Regression tests for FAQ questions answered from the official Knowledge Base
/// (<c>Backend/documentation/ai-knowledge</c>) through the how-to path, including
/// the exact user-reported probes and reasonable paraphrases in both languages.
/// </summary>
public class HowToServiceFaqRegressionShould
{
    private static ISubscriptionPaymentService CreatePaymentService()
        => new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions()));

    private static HowToService CreateService()
        => new(CreatePaymentService(), knowledgeService: new WesalKnowledgeService());

    private static readonly string[] OfficialCategories = ["platform", "faq", "policies"];

    [Fact]
    public async Task ArabicDevelopersProbe_ReturnsOfficialPrimaryDevelopers()
    {
        var result = await CreateService().AskHowToAsync("من هم مطورو منصة وصال؟", "ar", CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
        Assert.Contains("عبد العزيز الخزندار", result.Answer);
        Assert.Contains("محمد شمعة", result.Answer);
    }

    [Fact]
    public async Task EnglishDevelopersProbe_ReturnsOfficialPrimaryDevelopers()
    {
        var result = await CreateService().AskHowToAsync("Who developed Wesal?", "en", CancellationToken.None);

        Assert.Equal("en", result.ResponseLanguage);
        Assert.Contains("Abdulaziz Al-Khazendar", result.Answer);
        Assert.Contains("Mohammed Shama", result.Answer);
    }

    [Fact]
    public async Task ArabicSupportProbe_ReturnsOfficialContact()
    {
        var result = await CreateService().AskHowToAsync("كيف يمكنني التواصل مع دعم وصال؟", "ar", CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
        Assert.Contains("+970567581412", result.Answer);
    }

    [Fact]
    public async Task EnglishSupportProbe_ReturnsOfficialContact()
    {
        var result = await CreateService().AskHowToAsync("How can I contact Wesal support?", "en", CancellationToken.None);

        Assert.Equal("en", result.ResponseLanguage);
        Assert.Contains("+970567581412", result.Answer);
    }

    [Fact]
    public async Task ArabicPlatformProbe_AnsweredFromOfficialKnowledge()
    {
        var result = await CreateService().AskHowToAsync("ما هي منصة وصال؟", "ar", CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
        Assert.Contains(OfficialCategories, c => string.Equals(c, result.Category, StringComparison.OrdinalIgnoreCase));
        Assert.Contains("وصال", result.Answer);
    }

    [Theory]
    [InlineData("Who are the developers of Wesal?")]
    [InlineData("Who built the platform?")]
    [InlineData("من مطوري وصال؟")]
    [InlineData("مين عمل منصة وصال؟")]
    public async Task Paraphrase_ResolvesToOfficialKnowledge_NotGenericFallback(string question)
    {
        var result = await CreateService().AskHowToAsync(question, null, CancellationToken.None);

        Assert.Contains(OfficialCategories, c => string.Equals(c, result.Category, StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain("I can help you with how to use Wesal", result.Answer);
        Assert.DoesNotContain("يمكنني مساعدتك في كيفية استخدام وصال", result.Answer);
    }

    [Fact]
    public async Task Retrieval_EnglishDeveloped_ReturnsTeamArticleFirst()
    {
        var service = new WesalKnowledgeService();

        var articles = await service.SearchAsync("Who developed Wesal?", "en", 5);

        Assert.NotEmpty(articles);
        Assert.Contains("team", articles[0].Title, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Abdulaziz Al-Khazendar", articles[0].Content);
    }

    [Fact]
    public async Task ArabicSupportShortProbe_ReturnsOfficialContact()
    {
        var result = await CreateService().AskHowToAsync("كيف أتواصل مع دعم وصال؟", "ar", CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
        Assert.Equal("platform", result.Category);
        Assert.Contains("+970567581412", result.Answer);
    }

    [Fact]
    public async Task EnglishGuestBookingProbe_RequiresRegisteredAccount()
    {
        var result = await CreateService().AskHowToAsync("Can a guest send a booking request?", "en", CancellationToken.None);

        Assert.Equal("en", result.ResponseLanguage);
        Assert.Equal("booking", result.Category);
        Assert.Contains("registered account", result.Answer, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ArabicGuestBookingProbe_RequiresRegisteredAccount()
    {
        var result = await CreateService().AskHowToAsync("هل يستطيع الزائر إرسال طلب حجز؟", "ar", CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
        Assert.Equal("booking", result.Category);
        Assert.Contains("حساب مسجل", result.Answer);
    }

    [Fact]
    public async Task ContactOwnerQuestion_NotHijackedBySupportContact()
    {
        var result = await CreateService().AskHowToAsync("how do I contact the hall owner?", "en", CancellationToken.None);

        Assert.Equal("messaging", result.Category);
        Assert.Contains("Contact Hall Owner", result.Answer);
        Assert.DoesNotContain("+970567581412", result.Answer);
    }
}
