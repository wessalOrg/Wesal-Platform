using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Ai;
using Wesal.Application.Ai.Navigation;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Ai;

public sealed class MabroukConversationIntelligenceShould
{
    private sealed record ConversationCase(string Id, string Category, string[] Turns);

    [Fact]
    public async Task PreserveSearchCriteriaWhenRecommendingFromTheSameResultSet()
    {
        var harness = new MabroukHarness();
        var initialPlan = AiSemanticPlanResolver.Resolve("بدي صالة بغزة لـ200 شخص وميزانيتي 3000 شيكل", "ar",
            new DateOnly(2026, 10, 1), null, AiTurnContext.Empty(new DateOnly(2026, 10, 1)));
        Assert.Equal(200, initialPlan.Capacity);
        var shown = new[] { new AiHallRef(harness.NakheelId, "قاعة النخيل"), new AiHallRef(harness.OrchidId, "قاعة الأوركيد") };
        var prior = AiConversationStateResolver.WithCollectionResults(null, shown, initialPlan);
        var context = new AiConversationContext([], AiSemanticPlanResolver.ToLegacyIntent(initialPlan), shown, null, prior);

        var response = await harness.AskAsync("مين الأنسب من اللي عرضتهم وليش؟", conversation: context);

        Assert.Equal(AiComparisonIntent.MostSuitable, response.SemanticPlan?.ComparisonIntent);
        Assert.Equal(200, response.SemanticPlan?.Capacity);
        Assert.Equal(3000m, response.SemanticPlan?.PriceBudget.MaximumPrice);
        Assert.Equal("Gaza", response.SemanticPlan?.Region);
        Assert.Equal(AiAssistantResponseKind.Answer, response.Kind);
        Assert.Null(response.HallDetails); // controlled fixture candidates exceed the hard budget
        Assert.Contains("ما في قاعة", response.Message);
        Assert.Empty(harness.Search.Requests);
    }

    [Fact]
    public void TrackSelectedHallsWithoutMarkingEveryShownResultAsSeen()
    {
        var first = new AiHallRef(Guid.NewGuid(), "Hall A");
        var second = new AiHallRef(Guid.NewGuid(), "Hall B");
        var state = AiConversationStateResolver.WithCollectionResults(null, [first, second]);

        Assert.Empty(state.SeenHallIds!);
        state = AiConversationStateResolver.AdvanceSelection(state, second, 1);

        Assert.Equal(second.HallId, state.LastSelectedHallId);
        Assert.Equal([second.HallId], state.SeenHallIds);
        Assert.Equal([first.HallId, second.HallId], state.ShownHallIds);
    }

    [Fact]
    public async Task AskWhichHardFilterMayChangeAfterAnAffirmativeContinuationAtExhaustion()
    {
        var harness = new MabroukHarness();
        var shown = new[] { new AiHallRef(harness.NakheelId, "قاعة النخيل"), new AiHallRef(harness.OrchidId, "قاعة الأوركيد") };
        var state = new AiConversationState(ActiveGoal: "find_hall", ShownHallIds: shown.Select(hall => hall.HallId).ToArray(),
            SelectedResultIndex: 1, TaskStatus: "exhausted", LastSemanticPlan: new AiSemanticPlan(
                AiSemanticGoal.FindHall, AiContinuationType.NewRequest, new AiHallReference(AiHallReferenceKind.None),
                null, null, AiComparisonIntent.None, [], "Gaza", "Al-Shati", null, null, null, 200,
                new AiPriceBudget(MaximumPrice: 3000), AiPriceSortPreference.LowestPrice, false, null, [], null,
                AiPlanConfidence.High, "ar"));
        var context = new AiConversationContext([], new AiAssistantIntentDto(AiIntentType.SearchHalls, "Gaza", "Al-Shati", null, 200, null,
            MaximumPrice: 3000), shown, null, state);

        var response = await harness.AskAsync("طيب اه دور", conversation: context);

        Assert.Equal(AiAssistantResponseKind.Clarification, response.Kind);
        Assert.Contains("أي شرط", response.Message);
        Assert.Contains("باقي الشروط", response.Message);
        Assert.Equal("search_filter", response.SemanticPlan?.ClarificationRequirement?.Field);
        Assert.Empty(harness.Search.Requests);
    }

    [Fact]
    public async Task ResolveShortHallNavigationOnlyAsAnActionFromAValidatedHallContext()
    {
        var harness = new MabroukHarness();
        var response = await harness.AskAsync("بتقدر توديني هناك", pinnedHall: harness.OrchidId);

        var action = Assert.Single(response.Actions!);
        Assert.Equal(AiAssistantActionTypes.Navigate, action.Type);
        Assert.Equal(AiAssistantActionTypes.ModeAuto, action.Mode);
        Assert.Equal(WesalNavigationRegistry.HallDetails, action.PageKey);
        Assert.Equal($"/halls/{harness.OrchidId:D}", action.Href);
        Assert.Contains("ما تم إرسال أي حجز", response.Message);
    }

    [Fact]
    public async Task SwitchToPlatformServicesAndResumeThePreviouslySelectedHall()
    {
        var harness = new MabroukHarness();
        var selected = new AiHallRef(harness.OrchidId, "قاعة الأوركيد");
        var context = new AiConversationContext([], new AiAssistantIntentDto(AiIntentType.GetHallDetails, null, null, null, null, selected.HallName),
            [selected], selected, new AiConversationState(ActiveGoal: "hall_details", ActiveHallId: selected.HallId,
                ActiveHallName: selected.HallName, LastSelectedHallId: selected.HallId, ShownHallIds: [selected.HallId]));

        var platform = await harness.AskAsync("طيب احكيلي شو بتقدموا", conversation: context);
        Assert.Equal(AiSemanticGoal.PlatformKnowledge, platform.SemanticPlan?.Goal);
        Assert.DoesNotContain("الأوركيد", platform.Message);

        var switched = AiConversationStateResolver.Advance(context.State, "طيب احكيلي شو بتقدموا", platform, context.LastHall);
        Assert.Equal("platform", switched.CurrentTopic);
        Assert.Equal("hall_details", switched.ActiveGoal);
        Assert.Equal(selected.HallId, switched.LastSelectedHallId);

        var resumedContext = context with { State = switched, LastHall = null };
        var resume = await harness.AskAsync("ارجع للصالة", conversation: resumedContext);
        Assert.Equal($"/halls/{selected.HallId:D}", Assert.Single(resume.Actions!).Href);
    }

    [Fact]
    public async Task KeepTheTenReviewedV7TranscriptFamiliesInTheRegressionDataset()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Ai", "Fixtures", "mabrouk-v7-real-conversation-regressions.json");
        var cases = JsonSerializer.Deserialize<List<ConversationCase>>(await File.ReadAllTextAsync(path),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(cases);
        Assert.Equal(10, cases.Count);
        Assert.Equal(34, cases.Sum(item => item.Turns.Length));
        Assert.All(cases, item => Assert.NotEmpty(item.Turns));
    }

    [Fact]
    public async Task RecommendMostSuitableShownHallUsingLivePriceAndCapacity()
    {
        var harness = new MabroukHarness();
        var shown = new[]
        {
            new AiHallRef(harness.NakheelId, "قاعة النخيل"),
            new AiHallRef(harness.OrchidId, "قاعة الأوركيد")
        };
        var context = new AiConversationContext(
            [],
            new AiAssistantIntentDto(AiIntentType.SearchHalls, null, null, null, null, null),
            shown,
            null,
            AiConversationStateResolver.WithCollectionResults(new AiConversationState(ActiveGoal: "find_hall"), shown));

        var response = await harness.AskAsync("انسب وحدة إلي لحد 6000 ولـ200 ضيف", conversation: context);

        Assert.Equal(AiComparisonIntent.MostSuitable, response.SemanticPlan?.ComparisonIntent);
        Assert.True(response.HallDetails?.HallId == harness.OrchidId,
            $"{response.Kind}: {response.Message}; plan={response.SemanticPlan}; requests={string.Join(',', harness.Details.Requested)}");
        Assert.Contains("5000", response.Message);
        Assert.Contains("250", response.Message);
        Assert.Equal(new[] { harness.NakheelId, harness.OrchidId }, harness.Details.Requested);
    }

    [Fact]
    public async Task ClarifyWhatSuitableMeansWhenNoCriteriaWereGiven()
    {
        var harness = new MabroukHarness();
        var shown = new[]
        {
            new AiHallRef(harness.NakheelId, "قاعة النخيل"),
            new AiHallRef(harness.OrchidId, "قاعة الأوركيد")
        };
        var context = new AiConversationContext(
            [],
            new AiAssistantIntentDto(AiIntentType.SearchHalls, null, null, null, null, null),
            shown,
            null,
            AiConversationStateResolver.WithCollectionResults(new AiConversationState(ActiveGoal: "find_hall"), shown));

        var response = await harness.AskAsync("انسب وحدة إلي؟", conversation: context);

        Assert.Equal(AiAssistantResponseKind.Clarification, response.Kind);
        Assert.Contains("الميزانية", response.Message);
        Assert.Empty(harness.Details.Requested);
    }

    [Fact]
    public async Task DoNotRelaxHardConstraintsWhenNoShownHallMatchesSuitabilityRequest()
    {
        var harness = new MabroukHarness();
        var shown = new[]
        {
            new AiHallRef(harness.NakheelId, "قاعة النخيل"),
            new AiHallRef(harness.OrchidId, "قاعة الأوركيد")
        };
        var context = new AiConversationContext(
            [],
            new AiAssistantIntentDto(AiIntentType.SearchHalls, null, null, null, null, null),
            shown,
            null,
            AiConversationStateResolver.WithCollectionResults(new AiConversationState(ActiveGoal: "find_hall"), shown));

        var response = await harness.AskAsync("انسب وحدة إلي بميزانية 4000 ولـ200 ضيف", conversation: context);

        Assert.Equal(AiAssistantResponseKind.Answer, response.Kind);
        Assert.Null(response.HallDetails);
        Assert.Contains("ما في قاعة", response.Message);
        Assert.Empty(harness.Search.Requests);
    }

    [Fact]
    public async Task ExplainWhyTheSelectedHallWasSuitableUsingItsLiveFields()
    {
        var harness = new MabroukHarness();
        var plan = AiSemanticPlanResolver.Resolve(
            "انسب وحدة إلي لحد 6000 ولـ200 ضيف", "ar", new DateOnly(2026, 10, 1), null,
            AiTurnContext.Empty(new DateOnly(2026, 10, 1)));
        var shown = new[]
        {
            new AiHallRef(harness.NakheelId, "قاعة النخيل"),
            new AiHallRef(harness.OrchidId, "قاعة الأوركيد")
        };
        var context = new AiConversationContext(
            [],
            new AiAssistantIntentDto(AiIntentType.GetHallDetails, null, null, null, null, "قاعة الأوركيد"),
            shown,
            shown[1],
            new AiConversationState(
                ActiveGoal: "find_hall",
                ActiveHallId: harness.OrchidId,
                ActiveHallName: "قاعة الأوركيد",
                ShownHallIds: shown.Select(hall => hall.HallId).ToArray(),
                SelectedResultIndex: 1,
                LastSemanticPlan: plan));

        var response = await harness.AskAsync("ليش هاي؟", conversation: context);

        Assert.Equal(AiAssistantResponseKind.Answer, response.Kind);
        Assert.True(response.HallDetails?.HallId == harness.OrchidId,
            $"{response.Kind}: {response.Message}; requests={string.Join(',', harness.Details.Requested)}");
        Assert.Contains("5000", response.Message);
        Assert.Contains("250", response.Message);
        Assert.Empty(harness.Search.Requests);
    }

    [Fact]
    public async Task UpdateTheSessionBudgetAndKeepTheOtherSearchCriteria()
    {
        var harness = new MabroukHarness();
        var initial = AiSemanticPlanResolver.Resolve(
            "بدي صالة بغزة لـ200 شخص وبحدود 5000", "ar", new DateOnly(2026, 10, 1), null,
            AiTurnContext.Empty(new DateOnly(2026, 10, 1)));
        var priorIntent = AiSemanticPlanResolver.ToLegacyIntent(initial);
        var context = new AiConversationContext(
            [],
            priorIntent,
            [],
            null,
            new AiConversationState(ActiveGoal: "find_hall", LastSemanticPlan: initial));

        var response = await harness.AskAsync("لا ممكن 6000", conversation: context);

        Assert.True(response.Kind == AiAssistantResponseKind.Halls,
            $"{response.Kind}: {response.Message}; plan={response.SemanticPlan}; intent={response.Intent}");
        Assert.Equal(6000m, response.Intent?.AroundPrice);
        var search = Assert.Single(harness.Search.Requests);
        Assert.Equal(Wesal.Domain.Enums.HallRegion.Gaza, search.Region);
        Assert.Equal(200, search.MinimumCapacity);
        Assert.Equal(6000m, search.AroundPrice);
    }

    [Fact]
    public async Task ClearThePreviousAreaWhenTheUserRejectsIt()
    {
        var harness = new MabroukHarness();
        var priorPlan = AiSemanticPlanResolver.Resolve(
            "بدي صالة في حي الرمال لـ150 شخص", "ar", new DateOnly(2026, 10, 1), null,
            AiTurnContext.Empty(new DateOnly(2026, 10, 1)));
        var priorIntent = AiSemanticPlanResolver.ToLegacyIntent(priorPlan);
        var context = new AiConversationContext(
            [], priorIntent, [], null,
            new AiConversationState(ActiveGoal: "find_hall", LastSemanticPlan: priorPlan));

        var response = await harness.AskAsync("مش بالرمال", conversation: context);

        Assert.Equal(AiAssistantResponseKind.Halls, response.Kind);
        Assert.True(response.SemanticPlan?.ClearAreaPreference,
            $"priorArea={priorPlan.Area}; planArea={response.SemanticPlan?.Area}; cleared={response.SemanticPlan?.ClearedArea}");
        var search = Assert.Single(harness.Search.Requests);
        Assert.Equal(Wesal.Domain.Enums.HallRegion.Gaza, search.Region);
        Assert.Null(search.Area);
        Assert.Equal(150, search.MinimumCapacity);
    }

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
        Assert.Contains("عبد الرحمن أبو سالم", creator.Message);
        Assert.Contains("عبد العزيز الخزندار", creator.Message);
        Assert.Contains("إثبات الهوية", addHall.Message);
    }

    [Fact]
    public void KeepConversationHallWhenEnteringPendingDateWithoutHallPayload()
    {
        var hall = new AiHallRef(Guid.NewGuid(), "قاعة النخيل");
        var intent = new AiAssistantIntentDto(AiIntentType.CheckHallAvailability, null, null, null, null, "قاعة النخيل");
        var clarification = new AiAssistantResponse(AiAssistantResponseKind.Clarification, "لأي تاريخ؟", "ar", DateTime.UtcNow, [], null, null, intent);

        var withoutFallback = AiConversationStateResolver.Advance(new AiConversationState(), "بكم ومتى متوفرة", clarification);
        Assert.Null(withoutFallback.ActiveHallId);

        var withFallback = AiConversationStateResolver.Advance(new AiConversationState(), "بكم ومتى متوفرة", clarification, hall);
        Assert.Equal(hall.HallId, withFallback.ActiveHallId);
        Assert.Equal(hall.HallName, withFallback.ActiveHallName);
        Assert.Equal("date", withFallback.PendingClarification);
        Assert.Equal(nameof(AiIntentType.CheckHallAvailability), withFallback.PendingIntent);
    }

    [Fact]
    public async Task SelectBareOrdinalFromLastShownHalls()
    {
        var harness = new MabroukHarness();
        var context = new AiConversationContext([],
            null,
            [new(harness.NakheelId, "قاعة النخيل"), new(harness.OrchidId, "قاعة الأوركيد")],
            null,
            new AiConversationState(ShownHallIds: [harness.NakheelId, harness.OrchidId], SelectedResultIndex: -1));
        var second = await harness.AskAsync("الثانية", conversation: context);
        Assert.Equal(AiAssistantResponseKind.HallDetails, second.Kind);
        Assert.Equal(harness.OrchidId, second.HallDetails?.HallId);
    }

    [Fact]
    public async Task SelectOrdinalFromDurableShownIdsWhenShortMemoryIsEmpty()
    {
        var harness = new MabroukHarness();
        // A clarification turn wipes LastHalls in production storage; the durable
        // state still carries the result ids for the follow-up ordinal.
        var context = new AiConversationContext([],
            null,
            [],
            null,
            new AiConversationState(ShownHallIds: [harness.NakheelId, harness.OrchidId], SelectedResultIndex: -1));
        var first = await harness.AskAsync("الأولى", conversation: context);
        Assert.Equal(AiAssistantResponseKind.HallDetails, first.Kind);
        Assert.Equal(harness.NakheelId, first.HallDetails?.HallId);
    }

    [Fact]
    public async Task OrdinalSelectionAdvancesTheResultCursorForNextNavigation()
    {
        var harness = new MabroukHarness();
        // Same as production after a clarification wiped LastHalls: only the
        // durable state's shown ids remain for the follow-up ordinal.
        var context = new AiConversationContext([],
            null,
            [],
            null,
            new AiConversationState(ShownHallIds: [harness.NakheelId, harness.OrchidId], SelectedResultIndex: -1));
        var first = await harness.AskAsync("الأولى", conversation: context);
        Assert.Equal(AiAssistantResponseKind.HallDetails, first.Kind);
        // AiAssistantController saves AdvanceSelection with the focused hall.
        var focused = AiResponseMemory.FocusedHall(first);
        Assert.NotNull(focused);
        var afterOrdinal = context with
        {
            LastHall = focused,
            State = AiConversationStateResolver.AdvanceSelection(context.State, focused, 0)
        };
        var next = await harness.AskAsync("غيرها", conversation: afterOrdinal);
        Assert.Equal(AiAssistantResponseKind.HallDetails, next.Kind);
        Assert.Equal(harness.OrchidId, next.HallDetails?.HallId);
    }

    [Fact]
    public async Task NavigateNextResultFromDurableShownIdsWhenShortMemoryIsEmpty()
    {
        var harness = new MabroukHarness();
        // Production wipes LastHalls on turns that show no new list; the durable
        // state still carries the result ids and the selected cursor.
        var context = new AiConversationContext([],
            null,
            [],
            new(harness.NakheelId, "قاعة النخيل"),
            new AiConversationState(ActiveGoal: "find_hall", ActiveHallId: harness.NakheelId, ActiveHallName: "قاعة النخيل",
                ShownHallIds: [harness.NakheelId, harness.OrchidId], SelectedResultIndex: 0));
        var next = await harness.AskAsync("غيرها", conversation: context);
        Assert.Equal(AiAssistantResponseKind.HallDetails, next.Kind);
        Assert.Equal(harness.OrchidId, next.HallDetails?.HallId);
    }

    [Fact]
    public async Task ResumePendingDateEndToEndThroughControllerStyleState()
    {
        var harness = new MabroukHarness();
        using var sessions = new ChatSessionService();
        _ = await sessions.InitializeSessionAsync("ar");

        // Turn 1: single-hall search, state saved exactly like AiAssistantController.
        var search = await harness.AskAsync("بدي صالة ل300 شخص");
        Assert.Equal(AiAssistantResponseKind.Halls, search.Kind);
        var single = Assert.Single(search.Halls);
        var shown = AiResponseMemory.ShownHalls(search);
        var focused = AiResponseMemory.FocusedHall(search);
        var afterSearch = new AiConversationContext([], search.Intent, shown, focused,
            AiConversationStateResolver.WithCollectionResults(null, shown));

        // Turn 2: availability question without a date; the clarification carries
        // no hall payload, so the controller passes the conversation hall through.
        var availabilityAsk = await harness.AskAsync("بكم ومتى متوفرة", conversation: afterSearch);
        Assert.Equal(AiAssistantResponseKind.Clarification, availabilityAsk.Kind);
        var fallback = afterSearch.LastHall ?? (afterSearch.LastHalls is { Count: 1 } one ? one[0] : null);
        var state = AiConversationStateResolver.Advance(afterSearch.State, "بكم ومتى متوفرة", availabilityAsk, fallback);
        Assert.Equal(single.HallId, state.ActiveHallId);
        Assert.Equal("date", state.PendingClarification);

        // Turn 3 (after a restart): the one-word date resumes against that hall.
        var resumed = await harness.AskAsync("بكرة", conversation: afterSearch with { State = state });
        Assert.Equal(AiAssistantResponseKind.Availability, resumed.Kind);
        Assert.Equal(single.HallId, resumed.Availability?.HallId);
        Assert.Equal(MabroukHarness.Now.AddDays(1).Date, resumed.Availability?.Date.ToDateTime(TimeOnly.MinValue));
    }

    [Fact]
    public async Task ExecuteEveryFixtureConversationTurnThroughTheHarness()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Ai", "Fixtures", "mabrouk-v3-conversations.json");
        var cases = JsonSerializer.Deserialize<List<ConversationCase>>(await File.ReadAllTextAsync(path),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        Assert.NotNull(cases);
        var loadedConversations = cases.Count;
        var loadedTurns = cases.Sum(scenario => scenario.Turns.Length);
        Assert.Equal(81, loadedConversations);
        Assert.Equal(269, loadedTurns);

        var executedConversations = 0;
        var executedTurns = 0;
        var assertions = 0;
        var failures = new List<string>();
        void Check(bool condition, string failure)
        {
            assertions++;
            if (!condition) failures.Add(failure);
        }

        foreach (var scenario in cases)
        {
            var harness = new MabroukHarness();
            using var sessions = new ChatSessionService();
            var session = await sessions.InitializeSessionAsync("ar");
            foreach (var turn in scenario.Turns)
            {
                var context = await sessions.GetConversationContextAsync(session.SessionId);
                AiAssistantResponse response;
                try
                {
                    response = await harness.AskAsync(turn, conversation: context);
                }
                catch (Exception ex)
                {
                    failures.Add($"{scenario.Id} turn '{turn}': threw {ex.GetType().Name}");
                    continue;
                }

                executedTurns++;
                Check(!string.IsNullOrWhiteSpace(response.Message), $"{scenario.Id} turn '{turn}': empty message");
                Check(response.Kind != AiAssistantResponseKind.Error, $"{scenario.Id} turn '{turn}': Error kind");
                if (response.Availability is { } availability)
                {
                    assertions++;
                    if (availability.HallId == Guid.Empty || availability.Slots is null)
                        failures.Add($"{scenario.Id} turn '{turn}': bad availability payload");
                }
                if (response.HallDetails is { } details)
                {
                    assertions++;
                    if (details.HallId == Guid.Empty)
                        failures.Add($"{scenario.Id} turn '{turn}': bad hall details payload");
                }
                foreach (var action in response.Actions ?? [])
                {
                    assertions++;
                    if (action.Type != AiAssistantActionTypes.Navigate
                        || WesalNavigationRegistry.ResolveHref(action.PageKey) != action.Href)
                        failures.Add($"{scenario.Id} turn '{turn}': untrusted navigation action {action.PageKey} -> {action.Href}");
                }

                // Pinned deterministic answers must hold inside long conversations too.
                if (turn == "عندكم مصورين؟")
                {
                    Check(response.Message.Contains("قيد التجهيز"), $"{scenario.Id}: photographer capability lost");
                    Check(response.Actions is null || response.Actions.Count == 0, $"{scenario.Id}: photographer capability leaked navigation");
                }
                if (turn == "وديني عالمصورين")
                    Check(response.Actions?.Any(action => action.PageKey == "photographers") == true, $"{scenario.Id}: photographer navigation lost");
                if (turn == "عندكم منسق مناسبات؟")
                    Check(response.Message.Contains("قيد التجهيز"), $"{scenario.Id}: planner capability lost");
                if (turn == "وديني عمنسقي المناسبات")
                    Check(response.Actions?.Any(action => action.PageKey == "event_planners") == true, $"{scenario.Id}: planner navigation lost");
                if (turn == "مين مطورين وصال؟")
                    Check(response.Message.Contains("عبد العزيز الخزندار"), $"{scenario.Id}: team answer lost");
                if (turn == "مين عمل مبروك؟")
                    Check(response.Message.Contains("عبد الرحمن أبو سالم")
                        && response.Message.Contains("عبد العزيز الخزندار"), $"{scenario.Id}: Mabrouk developer fact lost");
                if (turn == "كيف أضيف قاعة؟")
                    Check(response.Message.Contains("إثبات الهوية"), $"{scenario.Id}: add-hall answer lost");
                if (turn is "كيف أتواصل مع وصال؟" or "طيب كيف أتواصل مع وصال؟")
                    Check(response.Message.Contains("+970567581412"), $"{scenario.Id}: support contact lost");
                if (turn == "كيف أتواصل مع صاحب القاعة؟")
                    Check(!response.Message.Contains("+970567581412"), $"{scenario.Id}: owner/support answers mixed");

                var state = AdvanceLikeController(context, turn, response);
                await sessions.SaveExchangeAsync(session.SessionId, turn, response.Message, response.Intent,
                    AiResponseMemory.ShownHalls(response), AiResponseMemory.FocusedHall(response), conversationState: state);
                var saved = await sessions.GetConversationContextAsync(session.SessionId);
                var stateJson = JsonSerializer.Serialize(saved.State);
                Check(stateJson.Length < 8_000, $"{scenario.Id} turn '{turn}': state exceeded 8KB");
                Check(stateJson.IndexOf("token", StringComparison.OrdinalIgnoreCase) < 0, $"{scenario.Id} turn '{turn}': state leaked a secret");
            }
            executedConversations++;
        }

        Assert.Equal(loadedConversations, executedConversations);
        Assert.Equal(loadedTurns, executedTurns);
        Assert.True(failures.Count == 0,
            $"Fixture execution failures ({failures.Count}/{assertions} assertions): " + string.Join("; ", failures.Take(20)));
    }

    [Fact]
    public async Task RunTheV4GoldenSearchBudgetDetailsAndAvailabilityConversation()
    {
        var harness = new MabroukHarness();
        using var sessions = new ChatSessionService();
        var session = await sessions.InitializeSessionAsync("ar");
        AiAssistantResponse? search = null;
        AiAssistantResponse? cheapest = null;
        AiAssistantResponse? price = null;
        AiAssistantResponse? location = null;
        AiAssistantResponse? availabilityQuestion = null;
        AiAssistantResponse? tomorrow = null;
        AiAssistantResponse? another = null;

        foreach (var message in new[]
        {
            "بدي صالة بغزة ل150 شخص",
            "ارخص وحدة",
            "قديش سعرها؟",
            "وين؟",
            "متى فاضية؟",
            "بكرة",
            "غيرها"
        })
        {
            var context = await sessions.GetConversationContextAsync(session.SessionId);
            var response = await harness.AskAsync(message, conversation: context);
            var nextState = AdvanceLikeController(context, message, response);
            await sessions.SaveExchangeAsync(
                session.SessionId,
                message,
                response.Message,
                response.Intent,
                AiResponseMemory.ShownHalls(response),
                AiResponseMemory.FocusedHall(response),
                conversationState: nextState);

            switch (message)
            {
                case "بدي صالة بغزة ل150 شخص": search = response; break;
                case "ارخص وحدة": cheapest = response; break;
                case "قديش سعرها؟": price = response; break;
                case "وين؟": location = response; break;
                case "متى فاضية؟": availabilityQuestion = response; break;
                case "بكرة": tomorrow = response; break;
                case "غيرها": another = response; break;
            }
        }

        Assert.NotNull(search?.SemanticPlan);
        Assert.Equal(150, search.SemanticPlan.Capacity);
        Assert.NotEmpty(search.Halls);
        Assert.All(search.Halls, hall => Assert.True(hall.Capacity >= 150));

        Assert.Equal(AiComparisonIntent.Cheapest, cheapest?.SemanticPlan?.ComparisonIntent);
        Assert.Equal("قاعة الأوركيد", cheapest?.HallDetails?.HallName);
        Assert.Contains("5000", cheapest?.Message);
        Assert.Equal("قاعة الأوركيد", price?.HallDetails?.HallName);
        Assert.Equal(5000, price?.HallDetails?.Price);
        Assert.Equal("قاعة الأوركيد", location?.HallDetails?.HallName);
        Assert.Contains("النصر", location?.Message);
        Assert.Equal(AiAssistantResponseKind.Clarification, availabilityQuestion?.Kind);
        Assert.Equal(AiAssistantResponseKind.Availability, tomorrow?.Kind);
        Assert.Equal(harness.OrchidId, tomorrow?.Availability?.HallId);
        Assert.Equal(new DateOnly(2026, 10, 2), tomorrow?.Availability?.Date);
        Assert.Equal(AiAssistantResponseKind.HallDetails, another?.Kind);
        Assert.Equal(harness.NakheelId, another?.HallDetails?.HallId);
    }

    [Fact]
    public async Task ReturnOnlyTheTrustedHallOwnerContactForAnActiveHall()
    {
        var harness = new MabroukHarness();
        var context = new AiConversationContext(
            [],
            new AiAssistantIntentDto(AiIntentType.GetHallDetails, null, null, null, null, "قاعة الأوركيد"),
            [new AiHallRef(harness.OrchidId, "قاعة الأوركيد")],
            new AiHallRef(harness.OrchidId, "قاعة الأوركيد"),
            new AiConversationState(
                ActiveGoal: "hall_details",
                ActiveHallId: harness.OrchidId,
                ActiveHallName: "قاعة الأوركيد"));

        var response = await harness.AskAsync("بدي رقم صاحبها", conversation: context);

        Assert.Equal(AiAssistantResponseKind.Answer, response.Kind);
        Assert.Contains("+970599000222", response.Message);
        Assert.DoesNotContain("+970567581412", response.Message);
        Assert.Equal(AiRequestedFact.Contact, Assert.Single(response.SemanticPlan!.RequestedFacts));
    }

    [Fact]
    public async Task ResolveTheArabicAndEnglishCityStarsNameWithoutTreatingStarsAsARating()
    {
        var harness = new MabroukHarness();
        var cityStarsId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        harness.Details.Add(MabroukHarness.Hall(cityStarsId, "City Stars", "غزة", "مخيم الشاطئ", 300, 3500m, []));
        harness.Search.Items = harness.Search.Items.Append(new HallListItemDto
        {
            HallId = cityStarsId,
            HallName = "City Stars",
            Region = "Gaza",
            Address = "مخيم الشاطئ",
            Capacity = 300,
            Price = 3500m
        }).ToArray();

        var english = await harness.AskAsync("city stars", "en");
        var arabic = await harness.AskAsync("صالة سيتي ستارز بكم", "ar");

        Assert.Equal(AiAssistantResponseKind.HallDetails, english.Kind);
        Assert.Equal("City Stars", english.HallDetails?.HallName);
        Assert.Equal(AiAssistantResponseKind.HallDetails, arabic.Kind);
        Assert.Equal("City Stars", arabic.HallDetails?.HallName);
        Assert.Equal(3500, arabic.HallDetails?.Price);
        Assert.Equal(AiComparisonIntent.None, AiSemanticPlanResolver.Resolve(
            "سيتي ستارز", "ar", new DateOnly(2026, 10, 1), null,
            AiTurnContext.Empty(new DateOnly(2026, 10, 1))).ComparisonIntent);
    }

    [Fact]
    public async Task CheckOnlyBoundedLiveAvailabilityDaysForTheRequestedMonth()
    {
        var harness = new MabroukHarness();
        var context = new AiConversationContext(
            [],
            new AiAssistantIntentDto(AiIntentType.GetHallDetails, null, null, null, null, "قاعة الأوركيد"),
            [new AiHallRef(harness.OrchidId, "قاعة الأوركيد")],
            new AiHallRef(harness.OrchidId, "قاعة الأوركيد"),
            new AiConversationState(
                ActiveGoal: "hall_details",
                ActiveHallId: harness.OrchidId,
                ActiveHallName: "قاعة الأوركيد"));

        var response = await harness.AskAsync("متى فاضية بالشهر الجاي", conversation: context);

        Assert.Equal(AiAssistantResponseKind.Answer, response.Kind);
        Assert.Contains("01/11/2026", response.Message);
        Assert.Contains("30/11/2026", response.Message);
        Assert.Equal(30, harness.Slots.Calls.Count);
        Assert.All(harness.Slots.Calls, call => Assert.Equal(harness.OrchidId, call.HallId));
        Assert.Equal(new DateOnly(2026, 11, 1), harness.Slots.Calls[0].Date);
        Assert.Equal(new DateOnly(2026, 11, 30), harness.Slots.Calls[^1].Date);
    }

    [Fact]
    public async Task CompareOnlyTheSelectedResultsAfterRefetchingTheirCurrentDetails()
    {
        var harness = new MabroukHarness();
        var palmId = Guid.Parse("44444444-4444-4444-4444-444444444444");
        harness.Details.Add(MabroukHarness.Hall(palmId, "Palm Hall", "غزة", "الرمال", 600, 8000m, []));
        harness.Search.Items = harness.Search.Items.Append(new HallListItemDto
        {
            HallId = palmId,
            HallName = "Palm Hall",
            Region = "Gaza",
            Address = "الرمال",
            Capacity = 600,
            Price = 8000m
        }).ToArray();

        var search = await harness.AskAsync("بدي صالات بغزة");
        var shown = AiResponseMemory.ShownHalls(search);
        var context = new AiConversationContext(
            [],
            search.Intent,
            shown,
            AiResponseMemory.FocusedHall(search),
            AiConversationStateResolver.WithCollectionResults(null, shown, search.SemanticPlan));

        var comparison = await harness.AskAsync("قارن الأولى والثالثة", conversation: context);

        Assert.Equal(AiAssistantResponseKind.Answer, comparison.Kind);
        Assert.Equal(AiComparisonIntent.CompareSelected, comparison.SemanticPlan?.ComparisonIntent);
        Assert.Contains("قاعة النخيل", comparison.Message);
        Assert.Contains("Palm Hall", comparison.Message);
        Assert.Contains("7000", comparison.Message);
        Assert.Contains("8000", comparison.Message);
    }

    [Fact]
    public async Task SearchGazaForTheCapacityInTheColloquialOneHundredFiftyPhrase()
    {
        var harness = new MabroukHarness();

        var response = await harness.AskAsync("بغزة عندي 150 واحد");

        Assert.Null(response.SemanticPlan?.PriceBudget.MaximumPrice);
        Assert.Null(response.Intent?.MaximumPrice);
        var builtQuery = AiAssistantService.BuildSearchQuery("بغزة عندي 150 واحد", response.Intent!, "ar");
        Assert.Null(new NaturalLanguageCriteriaExtractor().Extract(builtQuery).MaximumPrice);
        var request = Assert.Single(harness.Search.Requests);
        Assert.Equal(Wesal.Domain.Enums.HallRegion.Gaza, request.Region);
        Assert.Equal(150, request.MinimumCapacity);
        Assert.Null(request.Area);
        Assert.Null(request.MaximumPrice);
        Assert.Null(request.MinimumPrice);
        Assert.Null(request.AroundPrice);
        Assert.False(request.SortByPrice);
        Assert.Null(request.Date);
        Assert.Equal(AiAssistantResponseKind.Halls, response.Kind);
        Assert.All(response.Halls, hall => Assert.True(hall.Capacity >= 150));
    }

    private static AiConversationState AdvanceLikeController(AiConversationContext context, string message, AiAssistantResponse response)
    {
        if (response.Intent?.Intent == AiIntentType.SearchHalls && response.Halls.Count > 0)
            return AiConversationStateResolver.WithCollectionResults(context.State, AiResponseMemory.ShownHalls(response), response.SemanticPlan);
        if (AiReferenceResolver.TryGetOrdinal(message) is { } ordinal)
        {
            IReadOnlyList<Guid> ids = context.LastHalls is { Count: > 0 } halls
                ? halls.Select(hall => hall.HallId).ToList()
                : context.State?.ShownHallIds ?? (IReadOnlyList<Guid>)Array.Empty<Guid>();
            if (ids.Count > (ordinal < 0 ? ids.Count - 1 : ordinal)
                && AiResponseMemory.FocusedHall(response) is { } ordinalHall)
                return AiConversationStateResolver.AdvanceSelection(context.State, ordinalHall, ordinal < 0 ? ids.Count - 1 : ordinal, response.SemanticPlan);
        }
        if (AiConversationStateResolver.IsNextResult(message) && AiResponseMemory.FocusedHall(response) is { } nextHall)
            return AiConversationStateResolver.AdvanceSelection(context.State, nextHall, (context.State?.SelectedResultIndex ?? -1) + 1, response.SemanticPlan);
        var conversationHall = context.LastHall ?? (context.LastHalls is { Count: 1 } single ? single[0] : null);
        return AiConversationStateResolver.Advance(context.State, message, response, conversationHall);
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
