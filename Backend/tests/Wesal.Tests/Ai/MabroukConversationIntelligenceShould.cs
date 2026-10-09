using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Ai;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Ai;

public sealed class MabroukConversationIntelligenceShould
{
    private sealed record ConversationCase(string Id, string Category, string[] Turns);

    [Fact]
    public async Task LoadAtLeastFiftyMultiTurnConversationScenariosIncludingTheExactProductionRegression()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Ai", "Fixtures", "mabrouk-v3-conversations.json");
        var cases = JsonSerializer.Deserialize<List<ConversationCase>>(await File.ReadAllTextAsync(path),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        Assert.NotNull(cases);
        Assert.True(cases.Count >= 50);
        Assert.All(cases.Where(scenario => scenario.Id != "production-exact"), scenario => Assert.InRange(scenario.Turns.Length, 3, 10));
        Assert.True(cases.Sum(scenario => scenario.Turns.Length) >= 250);

        var production = new[]
        {
            "هلا", "بدي صالة ل300 شخص", "بكم ومتى متوفرة", "بكرة", "وديني عالقاعات",
            "شو القاعات الموجودة شو سعرعن", "طيب قلي شو قاعات موجودة", "وريني القاعات",
            "احكيلي عن الصالات الموجودة", "غيرها", "عندكم مصورين؟", "وديني عالمصورين",
            "مين مطورين وصال؟", "كيف أضيف قاعة؟", "وشو بطلب مني؟", "وبعد ما أرسلها؟"
        };
        Assert.Contains(cases, scenario => scenario.Turns.SequenceEqual(production));
    }

    [Fact]
    public async Task ResumePendingDateFromDurableStateAndCallAvailability()
    {
        var harness = new MabroukHarness();
        using var sessions = new ChatSessionService();
        var session = await sessions.InitializeSessionAsync("ar");
        var search = await harness.AskAsync("بدي صالة ل300 شخص");
        await sessions.SaveExchangeAsync(session.SessionId, "بدي صالة ل300 شخص", search.Message, search.Intent,
            AiResponseMemory.ShownHalls(search), AiResponseMemory.FocusedHall(search));

        var context = await sessions.GetConversationContextAsync(session.SessionId);
        var availabilityAsk = await harness.AskAsync("بكم ومتى متوفرة", conversation: context);
        var active = Assert.Single(AiResponseMemory.ShownHalls(search));
        var state = AiConversationStateResolver.Advance(context.State, "بكم ومتى متوفرة", availabilityAsk) with
        {
            ActiveHallId = active.HallId,
            ActiveHallName = active.HallName,
            PendingIntent = nameof(AiIntentType.CheckHallAvailability),
            PendingClarification = "date",
            MissingField = "date"
        };
        Assert.Equal(AiAssistantResponseKind.Clarification, availabilityAsk.Kind);
        await sessions.SaveExchangeAsync(session.SessionId, "بكم ومتى متوفرة", availabilityAsk.Message, availabilityAsk.Intent,
            AiResponseMemory.ShownHalls(availabilityAsk), AiResponseMemory.FocusedHall(availabilityAsk), conversationState: state);

        // A new context read models a request after an application restart.
        var restartedContext = await sessions.GetConversationContextAsync(session.SessionId);
        var resumed = await harness.AskAsync("بكرة", conversation: restartedContext);
        Assert.Equal(AiAssistantResponseKind.Availability, resumed.Kind);
        Assert.Equal(active.HallId, resumed.Availability?.HallId);
        Assert.Equal(MabroukHarness.Now.AddDays(1).Date, resumed.Availability?.Date.ToDateTime(TimeOnly.MinValue));
        Assert.Single(harness.Slots.Calls);
    }

    [Fact]
    public async Task PrioritizeCollectionQuestionsOverFocusedHallAndNavigateAnotherResult()
    {
        var harness = new MabroukHarness();
        var previous = new AiConversationContext([], null,
            [new(harness.NakheelId, "قاعة النخيل"), new(harness.OrchidId, "قاعة الأوركيد")],
            new(harness.NakheelId, "قاعة النخيل"), new AiConversationState(ActiveGoal: "hall_details", ActiveHallId: harness.NakheelId));
        var list = await harness.AskAsync("احكيلي عن الصالات الموجودة", conversation: previous);
        Assert.Equal(AiAssistantResponseKind.Halls, list.Kind);
        Assert.Equal(2, list.Halls.Count);
        Assert.Equal(AiIntentType.SearchHalls, list.Intent?.Intent);

        var state = new AiConversationState(ActiveGoal: "find_hall", ShownHallIds: [harness.NakheelId, harness.OrchidId], SelectedResultIndex: 0);
        var next = await harness.AskAsync("غيرها", conversation: previous with { State = state });
        Assert.Equal(AiAssistantResponseKind.HallDetails, next.Kind);
        Assert.Equal(harness.OrchidId, next.HallDetails?.HallId);
    }

    [Theory]
    [InlineData("وديني عالقاعات")]
    [InlineData("وديني علقاعات")]
    [InlineData("وديني للقاعات")]
    [InlineData("روح عالقاعات")]
    [InlineData("افتح صفحة القاعات")]
    public void ResolvePalestinianAttachedHallNavigationToRegisteredRoute(string text)
    {
        var match = Wesal.Application.Ai.Navigation.AiNavigationIntentDetector.Detect(text);
        Assert.NotNull(match);
        Assert.Equal(Wesal.Application.Ai.Navigation.WesalNavigationRegistry.Halls, match!.Page.Key);
        Assert.Equal(Wesal.Application.Ai.Navigation.AiNavigationMode.Auto, match.Mode);
    }

    [Fact]
    public async Task PreservePhotographerCapabilityAnswerAndDistinguishExplicitNavigation()
    {
        var harness = new MabroukHarness();
        var capability = await harness.AskAsync("عندكم مصورين؟");
        Assert.Contains("قيد التجهيز", capability.Message);
        Assert.Null(capability.Actions);

        var navigation = await harness.AskAsync("وديني عالمصورين");
        Assert.Contains(navigation.Actions ?? [], action => action.PageKey == "photographers");
    }

    [Fact]
    public async Task KeepRecoveryKnowledgeAnswersInConversationFlow()
    {
        var harness = new MabroukHarness();
        var team = await harness.AskAsync("مين مطورين وصال؟");
        var creator = await harness.AskAsync("مين عمل مبروك؟");
        var addHall = await harness.AskAsync("كيف أضيف قاعة؟");
        Assert.Contains("عبد العزيز الخزندار", team.Message);
        Assert.Contains("فريق وصال صنعني", creator.Message);
        Assert.Contains("إثبات الهوية", addHall.Message);
    }

    [Fact]
    public void SerializeStructuredStateWithinBoundedPayload()
    {
        var state = new AiConversationState("find_hall", "check_availability", "check_availability", "date", "date",
            Guid.NewGuid(), "قاعة النخيل", [Guid.NewGuid()], 0, "Gaza", 300, ["price", "availability"], new DateOnly(2026, 10, 10));
        var json = JsonSerializer.Serialize(state);
        Assert.True(json.Length < 8_000);
        Assert.DoesNotContain("token", json, StringComparison.OrdinalIgnoreCase);
    }
}
