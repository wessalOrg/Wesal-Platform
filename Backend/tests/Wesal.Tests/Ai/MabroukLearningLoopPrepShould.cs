using Microsoft.Extensions.Options;
using Wesal.Application.Ai;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Ai;

/// <summary>
/// Mabrouk-side learning-loop preparation: the 26 original built-in articles
/// stay intact (new Dynamic/Markdown additions allowed), genuine unknowns are
/// detectable via the generic-fallback category, brand-hijacked unknowns reach
/// the fallback after the ranking fix, and all operational/known outcomes stay
/// out of the gap inbox.
/// </summary>
public sealed class MabroukLearningLoopPrepShould
{
    private static readonly string[] OriginalCategories =
        ["faq", "hall-owner", "platform", "policies", "user-guide"];

    private static HowToService CreateHowTo()
        => new(new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions())), knowledgeService: new WesalKnowledgeService());

    [Fact]
    public void PreserveOriginalBuiltInKnowledgeInventory()
    {
        var root = Path.Combine(RepoPaths.Root(), "Backend", "documentation", "ai-knowledge");
        var originalFiles = OriginalCategories
            .SelectMany(category => Directory.GetFiles(Path.Combine(root, category), "*.md", SearchOption.AllDirectories))
            .ToArray();
        Assert.Equal(26, originalFiles.Length);

        var verified = 0;
        foreach (var file in originalFiles)
        {
            var meta = ReadFrontMatter(file);
            Assert.True(meta.ContainsKey("title"), $"Missing title: {file}");
            Assert.True(meta.ContainsKey("category"), $"Missing category: {file}");
            Assert.True(meta.ContainsKey("status"), $"Missing status: {file}");
            Assert.True(meta.ContainsKey("keywords"), $"Missing keywords: {file}");
            if (meta["status"] == "verified") verified++;
        }

        Assert.Equal(20, verified);

        // The Studio may ADD articles (e.g. mabrouk/development-team.md) but must
        // never delete or rewrite the originals.
        Assert.True(
            File.Exists(Path.Combine(root, "mabrouk", "development-team.md")),
            "Missing Studio addition: mabrouk/development-team.md");

        foreach (var doc in new[]
        {
            "mabrouk-knowledge-coverage-audit.md",
            "mabrouk-v2-audit.md",
            "mabrouk-v3-conversation-audit.md",
            "mabrouk-knowledge-preservation-baseline.md",
            "mabrouk-knowledge-studio-v3-integration.md"
        })
        {
            Assert.True(
                File.Exists(Path.Combine(RepoPaths.Root(), "Backend", "documentation", doc)),
                $"Missing Mabrouk doc: {doc}");
        }
    }

    [Theory]
    [InlineData("هل يوجد خصم للعرسان في شهر رمضان؟")]
    [InlineData("ما هي شروط كفالة العريس؟")]
    public async Task GenuineUnknownProductQuestionsYieldGenericFallbackCategory(string question)
    {
        var service = CreateHowTo();
        var answer = await service.AskHowToAsync(question, "ar", allowModel: false);
        Assert.True(HowToService.IsGenericFallbackAnswer(answer), $"Expected generic fallback for: {question} (category={answer.Category})");
        Assert.False(HowToService.IsKnownAnswerCategory(answer.Category), $"Unknown leaked into known: {question}");
    }

    [Theory]
    [InlineData("هل وصال عنده خطة مؤكدة يفتح بخانيونس؟")]
    [InlineData("هل يوجد مكتب لوصال في رفح؟")]
    [InlineData("هل وصال راح يفتح بخانيونس؟")]
    [InlineData("وصال عنده مكتب برفح؟")]
    [InlineData("متى وصال بيوصل الجنوب؟")]
    [InlineData("شو خطط وصال القادمة؟")]
    [InlineData("هل في فرع جديد لوصال؟")]
    public async Task BrandBearingUnknownsAreNotHijackedByOfficialArticle(string question)
    {
        var service = CreateHowTo();
        var answer = await service.AskHowToAsync(question, "ar", allowModel: false);
        Assert.True(HowToService.IsGenericFallbackAnswer(answer), $"Brand hijack still absorbs: {question} (category={answer.Category})");
    }

    [Theory]
    [InlineData("شو هي وصال؟", "ar")]
    [InlineData("ما هي وصال؟", "ar")]
    [InlineData("what is Wesal?", "en")]
    [InlineData("شو خدمات وصال؟", "ar")]
    public async Task BroadPlatformQueriesStillResolveToOfficialKnowledge(string question, string language)
    {
        var service = CreateHowTo();
        var answer = await service.AskHowToAsync(question, language, allowModel: false);
        Assert.False(HowToService.IsGenericFallbackAnswer(answer), $"Broad query lost its answer: {question}");
        Assert.True(HowToService.IsKnownAnswerCategory(answer.Category), $"Broad query has untrusted category {answer.Category}: {question}");
    }

    [Theory]
    [InlineData("مين مطورين وصال؟")]
    [InlineData("كيف أضيف قاعة؟")]
    [InlineData("كيف أحجز قاعة؟")]
    [InlineData("كيف أتواصل مع وصال؟")]
    public async Task KnownQuestionsYieldTrustedCategoriesNeverGenericFallback(string question)
    {
        var service = CreateHowTo();
        var answer = await service.AskHowToAsync(question, "ar", allowModel: false);
        Assert.False(HowToService.IsGenericFallbackAnswer(answer), $"Known question fell through: {question}");
        Assert.True(HowToService.IsKnownAnswerCategory(answer.Category), $"Known question has untrusted category {answer.Category}: {question}");
    }

    [Theory]
    [InlineData("هلا")]
    [InlineData("بشهر 10")]
    [InlineData("بقديش الحجز؟")]
    public async Task NarrowDeterministicAnswersAreTrustedNotGaps(string question)
    {
        var service = CreateHowTo();
        var answer = await service.AskHowToAsync(question, "ar", allowModel: false);
        Assert.False(HowToService.IsGenericFallbackAnswer(answer), $"Narrow answer misclassified as gap: {question} (category={answer.Category})");
    }

    [Fact]
    public async Task OperationalOutcomesDoNotRouteThroughGenericHowTo()
    {
        var harness = new MabroukHarness();

        // No halls match the criteria: structured Answer with a search intent, never HowTo.
        var noResults = await harness.AskAsync("بدي صالة ل5000 شخص");
        Assert.Equal(AiAssistantResponseKind.Answer, noResults.Kind);
        Assert.Equal(AiIntentType.SearchHalls, noResults.Intent?.Intent);

        // Missing date: clarification, not a knowledge answer.
        var search = await harness.AskAsync("بدي صالة ل300 شخص");
        var single = Assert.Single(search.Halls);
        var context = new AiConversationContext([],
            search.Intent,
            AiResponseMemory.ShownHalls(search),
            AiResponseMemory.FocusedHall(search),
            AiConversationStateResolver.WithCollectionResults(null, AiResponseMemory.ShownHalls(search)));
        var askDate = await harness.AskAsync("بكم ومتى متوفرة", conversation: context);
        Assert.Equal(AiAssistantResponseKind.Clarification, askDate.Kind);
        Assert.Equal(AiIntentType.CheckHallAvailability, askDate.Intent?.Intent);

        // Known Coming Soon capability: policy answer with no intent, never HowTo.
        var capability = await harness.AskAsync("عندكم مصورين؟");
        Assert.Null(capability.Intent);

        // Explicit navigation: registry-backed action, never HowTo.
        var navigation = await harness.AskAsync("وديني عالقاعات");
        Assert.Contains(navigation.Actions ?? [], action => action.PageKey == "halls");

        // End of "غيرها" list: Answer with no intent, never HowTo.
        var endContext = context with
        {
            State = new AiConversationState(ShownHallIds: [single.HallId], SelectedResultIndex: 0)
        };
        var end = await harness.AskAsync("غيرها", conversation: endContext);
        Assert.Equal(AiAssistantResponseKind.Answer, end.Kind);
        Assert.Null(end.Intent);
    }

    private static Dictionary<string, string> ReadFrontMatter(string path)
    {
        var meta = new Dictionary<string, string>(StringComparer.Ordinal);
        using var reader = new StreamReader(path);
        if (reader.ReadLine()?.Trim() != "---") return meta;
        string? line;
        while ((line = reader.ReadLine()) is not null)
        {
            if (line.Trim() == "---") break;
            var separator = line.IndexOf(':');
            if (separator > 0)
                meta[line[..separator].Trim()] = line[(separator + 1)..].Trim();
        }
        return meta;
    }
}
