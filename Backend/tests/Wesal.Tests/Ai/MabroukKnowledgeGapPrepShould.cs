using Microsoft.Extensions.Options;
using Wesal.Application.Ai;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Ai;

/// <summary>
/// Mabrouk-side preparation for the Knowledge Studio learning loop (no Studio
/// dependency): the built-in knowledge inventory stays intact, genuine unknown
/// product questions are detectable via the generic-fallback category, and all
/// operational/known outcomes stay out of the future gap inbox.
/// </summary>
public sealed class MabroukKnowledgeGapPrepShould
{
    private static HowToService CreateHowTo()
        => new(new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions())), knowledgeService: new WesalKnowledgeService());

    [Fact]
    public void PreserveBuiltInKnowledgeInventory()
    {
        var root = Path.Combine(RepoPaths.Root(), "Backend", "documentation", "ai-knowledge");
        var files = Directory.GetFiles(root, "*.md", SearchOption.AllDirectories);
        Assert.Equal(26, files.Length);

        var verified = 0;
        var categories = new HashSet<string>(StringComparer.Ordinal);
        foreach (var file in files)
        {
            var meta = ReadFrontMatter(file);
            Assert.True(meta.ContainsKey("title"), $"Missing title: {file}");
            Assert.True(meta.ContainsKey("category"), $"Missing category: {file}");
            Assert.True(meta.ContainsKey("status"), $"Missing status: {file}");
            Assert.True(meta.ContainsKey("keywords"), $"Missing keywords: {file}");
            categories.Add(meta["category"]);
            if (meta["status"] == "verified") verified++;
        }

        Assert.Equal(20, verified);
        Assert.Equal(
            ["faq", "hall-owner", "platform", "policies", "user-guide"],
            categories.OrderBy(category => category, StringComparer.Ordinal));

        foreach (var doc in new[]
        {
            "mabrouk-knowledge-coverage-audit.md",
            "mabrouk-v2-audit.md",
            "mabrouk-v3-conversation-audit.md",
            "mabrouk-knowledge-preservation-baseline.md"
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

    /// <summary>
    /// Proven absorption caveat (see integration doc): brand-bearing unknowns
    /// currently match the official platform article, so the generic-only hook
    /// does not see them. The Studio hybrid ranking must resolve this; this test
    /// pins the current behavior so any change is deliberate.
    /// </summary>
    [Theory]
    [InlineData("هل وصال عنده خطة مؤكدة يفتح بخانيونس؟")]
    [InlineData("هل يوجد مكتب لوصال في رفح؟")]
    public async Task BrandBearingUnknownsAreAbsorbedByOfficialArticle(string question)
    {
        var service = CreateHowTo();
        var answer = await service.AskHowToAsync(question, "ar", allowModel: false);
        Assert.Equal("platform", answer.Category);
        Assert.False(HowToService.IsGenericFallbackAnswer(answer));
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
