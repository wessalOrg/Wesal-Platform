using System.Text.Json;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.AiAssistant;
using Xunit.Abstractions;

namespace Wesal.Tests.Ai;

public sealed class MabroukKnowledgeCoverageShould
{
    private sealed record CoverageCase(string Question, string Language);
    private readonly ITestOutputHelper _output;

    public MabroukKnowledgeCoverageShould(ITestOutputHelper output) => _output = output;

    private static HowToService CreateHowTo()
        => new(new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions())), knowledgeService: new WesalKnowledgeService());

    [Fact]
    public async Task CoverEveryQuestionInTheKnowledgeCorpus()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Ai", "Fixtures", "mabrouk-knowledge-coverage.json");
        var cases = JsonSerializer.Deserialize<List<CoverageCase>>(await File.ReadAllTextAsync(path),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        Assert.NotNull(cases);
        Assert.True(cases.Count >= 200, $"Corpus must contain at least 200 prompts; found {cases.Count}.");

        var service = CreateHowTo();
        foreach (var testCase in cases)
        {
            var answer = await service.AskHowToAsync(testCase.Question, testCase.Language, allowModel: false);
            Assert.False(string.IsNullOrWhiteSpace(answer.Answer), $"Empty deterministic response for: {testCase.Question}");
        }
    }

    [Fact]
    public async Task ReturnVerifiedTeamInsteadOfAssistantCreatorForWesalDevelopers()
    {
        var service = CreateHowTo();
        var team = await service.TryAnswerKnownQuestionAsync("مين مطورين وصال؟", "ar");
        var creator = await service.TryAnswerKnownQuestionAsync("مين عمل مبروك؟", "ar");

        Assert.NotNull(team);
        Assert.Contains("عبد العزيز الخزندار", team!.Answer);
        Assert.Contains("محمد شمعة", team.Answer);
        Assert.DoesNotContain("صنعني", team.Answer);
        Assert.NotNull(creator);
        Assert.Contains("عبد الرحمن أبو سالم", creator!.Answer);
        Assert.Contains("عبد العزيز الخزندار", creator.Answer);
        Assert.DoesNotContain("فريق وصال صنعني", creator.Answer);
    }

    [Fact]
    public async Task PreserveCapabilityTruthAndHourlyBookingDetails()
    {
        var service = CreateHowTo();
        var about = await service.TryAnswerKnownQuestionAsync("شو هي وصال؟", "ar");
        var services = await service.TryAnswerKnownQuestionAsync("شو بتقدموا؟", "ar");
        var booking = await service.TryAnswerKnownQuestionAsync("كيف أحجز قاعة؟", "ar");

        Assert.Contains("قيد التجهيز", about!.Answer);
        Assert.Contains("لا يمكن البحث عنها أو حجزها", about.Answer);
        Assert.Contains("قيد التجهيز", services!.Answer);
        Assert.Contains("البوفيه غير متاحة", services.Answer);
        Assert.Contains("مدة كل منها ساعة", booking!.Answer);
        Assert.Contains("معلق", booking.Answer);
    }

    [Fact]
    public async Task GiveDetailedVerifiedAddHallGuidanceAndResolveItsFollowUps()
    {
        var service = CreateHowTo();
        var add = await service.TryAnswerKnownQuestionAsync("كيف بضيف قاعتي؟", "ar");
        Assert.NotNull(add);
        Assert.Contains("حساب صاحب قاعة", add!.Answer);
        Assert.Contains("إثبات الهوية", add.Answer);
        Assert.Contains("لوحة صاحب القاعة", add.Answer);
        Assert.Contains("قيد المراجعة", add.Answer);

        var context = new Wesal.Application.Common.Models.AiConversationContext(
            [new("user", "كيف أضيف قاعة؟"), new("assistant", add.Answer)], null);
        var requirements = await service.TryAnswerKnownQuestionAsync("وشو بطلب مني؟", "ar", context: context);
        var review = await service.TryAnswerKnownQuestionAsync("وبعد ما أرسلها؟", "ar", context: context);
        var visibility = await service.TryAnswerKnownQuestionAsync("وليش ممكن ما تظهر؟", "ar", context: context);
        Assert.Contains("وثيقة إثبات الهوية", requirements!.Answer);
        Assert.Contains("قيد المراجعة", review!.Answer);
        Assert.Contains("اشتراكها مدفوع ومؤكد", visibility!.Answer);
    }

    [Fact]
    public async Task KeepSupportAndHallOwnerMessagingSeparateAndUncertainPoliciesConservative()
    {
        var service = CreateHowTo();
        var support = await service.TryAnswerKnownQuestionAsync("كيف أتواصل مع وصال؟", "ar");
        var owner = await service.TryAnswerKnownQuestionAsync("كيف أتواصل مع صاحب القاعة؟", "ar");
        var uncertain = await service.TryAnswerKnownQuestionAsync("هل صاحب القاعة يقدر يحجز قاعة ثانية؟", "ar");

        Assert.Contains("+970567581412", support!.Answer);
        Assert.Equal("messaging", owner!.Category);
        Assert.DoesNotContain("+970567581412", owner.Answer);
        Assert.Contains("غير مؤكدة", uncertain!.Answer);
    }

    [Fact]
    public async Task YieldHallSearchAndLiveHallFactsToGroundedAssistantRoute()
    {
        var service = CreateHowTo();
        Assert.Null(await service.TryAnswerKnownQuestionAsync("دورلي عقاعة بغزة ل 300 شخص", "ar"));
        Assert.Null(await service.TryAnswerKnownQuestionAsync("قديش سعرها؟", "ar"));
        Assert.Null(await service.TryAnswerKnownQuestionAsync("الجمعة الجاي فاضية؟", "ar"));
    }

    [Fact]
    public async Task AnswerKnownTeamAndAddHallFactsBeforeGemini()
    {
        var harness = new MabroukHarness(geminiAvailable: true);
        var team = await harness.AskAsync("مين مطورين وصال؟");
        var addHall = await harness.AskAsync("كيف أضيف قاعة؟");

        Assert.Contains("عبد العزيز الخزندار", team.Message);
        Assert.Contains("محمد شمعة", team.Message);
        Assert.Contains("حساب صاحب قاعة", addHall.Message);
        Assert.Empty(harness.Gemini.Calls);
    }

    [Fact]
    public async Task SmokeThirteenKnowledgePromptsThroughTheLocalAssistantRouter()
    {
        var harness = new MabroukHarness();
        var context = new Wesal.Application.Common.Models.AiConversationContext(
            [new("user", "كيف أضيف قاعة؟"), new("assistant", "لإضافة قاعة من لوحة صاحب القاعة")], null);
        var prompts = new (string Question, Wesal.Application.Common.Models.AiConversationContext? Context)[]
        {
            ("مين مطورين وصال؟", null),
            ("كيف أضيف قاعة؟", null),
            ("شو لازم أرفع عشان أضيف القاعة؟", context),
            ("بعد ما أضيفها شو بصير؟", context),
            ("ليش قاعتي مش ظاهرة؟", context),
            ("شو بتقدموا؟", null),
            ("كيف أحجز؟", null),
            ("وين بشوف حجوزاتي؟", null),
            ("كيف أتواصل مع صاحب القاعة؟", null),
            ("كيف أتواصل مع وصال؟", null),
            ("عندكم مصورين؟", null),
            ("كيف أغير اللغة؟", null),
            ("مين عمل مبروك؟", null)
        };

        foreach (var prompt in prompts)
        {
            var response = await harness.AskAsync(prompt.Question, conversation: prompt.Context);
            Assert.False(string.IsNullOrWhiteSpace(response.Message), $"Empty response for: {prompt.Question}");
            var routeLog = Assert.Single(harness.RouteLogs.Skip(harness.RouteLogs.Count - 1));
            var route = routeLog.Split("route=", StringSplitOptions.None)[1].Split(' ')[0];
            _output.WriteLine($"{prompt.Question} | route={route} | source={route}");
            if (prompt.Question == "عندكم مصورين؟")
            {
                Assert.Contains("قيد التجهيز", response.Message);
                Assert.Contains("ما بتقدر تبحث عنها أو تحجزها", response.Message);
            }
        }

        Assert.Empty(harness.Gemini.Calls);
    }
}
