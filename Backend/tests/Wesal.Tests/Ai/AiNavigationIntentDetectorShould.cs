using Wesal.Application.Ai.Navigation;

namespace Wesal.Tests.Ai;

public class AiNavigationIntentDetectorShould
{
    [Theory]
    [InlineData("بدي صالة", "halls", AiNavigationMode.Suggest)]
    [InlineData("وديني عالصالات", "halls", AiNavigationMode.Auto)]
    [InlineData("افتحلي صفحة الصالات", "halls", AiNavigationMode.Auto)]
    [InlineData("ورجيني كل الصالات", "halls", AiNavigationMode.Auto)]
    [InlineData("وين بلاقي الصالات؟", "halls", AiNavigationMode.Suggest)]
    [InlineData("وين الأسئلة الشائعة؟", "faq", AiNavigationMode.Suggest)]
    [InlineData("روح عالأسئلة الشائعة", "faq", AiNavigationMode.Auto)]
    [InlineData("بدي مساعدة", "help", AiNavigationMode.Suggest)]
    [InlineData("سجلني دخول", "login", AiNavigationMode.Auto)]
    [InlineData("بدي أسجل حساب جديد", "register", AiNavigationMode.Suggest)]
    [InlineData("take me to the halls page", "halls", AiNavigationMode.Auto)]
    [InlineData("where is the FAQ?", "faq", AiNavigationMode.Suggest)]
    [InlineData("open login", "login", AiNavigationMode.Auto)]
    [InlineData("شو هي صفحة الصالات؟", "halls", AiNavigationMode.Suggest)]
    public void Detect_ClassifiesNavigationRequests(string message, string pageKey, AiNavigationMode mode)
    {
        var match = AiNavigationIntentDetector.Detect(message);

        Assert.NotNull(match);
        Assert.Equal(pageKey, match!.Page.Key);
        Assert.Equal(mode, match.Mode);
    }

    [Theory]
    [InlineData("كم سعر القاعة؟")]
    [InlineData("متاحة الجمعة؟")]
    [InlineData("كيف أحجز قاعة؟")]
    [InlineData("احكيلي عن قاعة النخيل")]
    [InlineData("قاعة النخيل كم سعرها")]
    [InlineData("ما سعر وصال؟")]
    [InlineData("بدي دعم")]
    [InlineData("hello")]
    public void Detect_DoesNotTreatDataQuestionsAsNavigation(string message)
        => Assert.Null(AiNavigationIntentDetector.Detect(message));

    [Theory]
    [InlineData("بدي قاعة لعرس")]
    [InlineData("I want a wedding hall")]
    public void Detect_DoesNotTurnHallSearchIntentIntoNavigation(string message)
    {
        Assert.Null(AiNavigationIntentDetector.Detect(message));
        Assert.Null(AiNavigationIntentDetector.DetectSuggestion(message));
    }

    [Fact]
    public void Detect_DoesNotNavigateForHomepageContentQuestions()
    {
        const string message = "شو موجود بالصفحة الرئيسية لوصال؟";

        Assert.Null(AiNavigationIntentDetector.Detect(message));
        Assert.Null(AiNavigationIntentDetector.DetectSuggestion(message));
    }

    [Fact]
    public void Detect_DoesNotRouteAnAdminDashboardRequestToTheOwnerDashboard()
    {
        Assert.Null(AiNavigationIntentDetector.Detect("open the admin dashboard"));
        Assert.Null(AiNavigationIntentDetector.DetectSuggestion("open the admin dashboard"));
    }

    [Theory]
    [InlineData("بدي تصوير", "photographers.marketplace")]
    [InlineData("وديني عالتصوير", "photographers.marketplace")]
    [InlineData("I want a photographer", "photographers.marketplace")]
    [InlineData("بدي مصور للعرس", "photographers.marketplace")]
    [InlineData("وين بلاقي بوفيه", "catering")]
    public void DetectUnavailableTopic_FindsServicesWithoutAPage(string message, string topic)
    {
        Assert.Null(AiNavigationIntentDetector.Detect(message));
        Assert.Equal(topic, AiNavigationIntentDetector.DetectUnavailableTopic(message)?.Key);
    }

    [Fact]
    public void DetectUnavailableTopic_IgnoresPlainHallQuestions()
        => Assert.Null(AiNavigationIntentDetector.DetectUnavailableTopic("كم سعر قاعة النخيل"));

    [Fact]
    public void DetectSuggestion_AttachesAPageToHowToQuestions()
    {
        Assert.Equal("halls", AiNavigationIntentDetector.DetectSuggestion("كيف أبحث عن صالة؟")?.Page.Key);
        Assert.Equal("register", AiNavigationIntentDetector.DetectSuggestion("كيف أسجل حساب جديد؟")?.Page.Key);
        Assert.All(
            new[] { "كيف أبحث عن صالة؟", "كيف أسجل حساب جديد؟" },
            m => Assert.Equal(AiNavigationMode.Suggest, AiNavigationIntentDetector.DetectSuggestion(m)!.Mode));
    }
}
