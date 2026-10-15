using Wesal.Application.Ai;
using Wesal.Application.Ai.Navigation;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>Deterministically advances the small, bounded task state after each answer.</summary>
public static class AiConversationStateResolver
{
    public static AiConversationState Advance(AiConversationState? prior, string message, AiAssistantResponse response, AiHallRef? conversationHall = null)
    {
        var state = prior ?? new AiConversationState();
        var intent = response.Intent;
        var plan = response.SemanticPlan ?? intent?.SemanticPlan;
        var halls = response.Halls?.Select(h => h.HallId).Take(10).ToArray() ?? [];
        var question = AiHallQuestionClassifier.Classify(message);
        var topicSwitch = intent?.Intent == AiIntentType.HowTo && !string.IsNullOrWhiteSpace(message)
            && (message.Contains("مطور", StringComparison.Ordinal) || message.Contains("اضيف", StringComparison.Ordinal) || message.Contains("أضيف", StringComparison.Ordinal));
        var task = topicSwitch ? "knowledge" : plan?.Goal switch
        {
            AiSemanticGoal.FindHall or AiSemanticGoal.CompareHalls => "find_hall",
            AiSemanticGoal.HallDetails => "hall_details",
            AiSemanticGoal.CheckAvailability => "check_availability",
            AiSemanticGoal.PlatformKnowledge or AiSemanticGoal.OwnerWorkflow or AiSemanticGoal.BookingHelp => "knowledge",
            AiSemanticGoal.Navigate => "navigation",
            _ => intent?.Intent switch
            {
                AiIntentType.SearchHalls => "find_hall",
                AiIntentType.GetHallDetails => "hall_details",
                AiIntentType.CheckHallAvailability => "check_availability",
                AiIntentType.HowTo => state.ActiveGoal,
                _ => state.ActiveGoal
            }
        };

        var activeHallId = response.Availability?.HallId ?? response.HallDetails?.HallId
            ?? (response.Halls is { Count: 1 } ? response.Halls[0].HallId : state.ActiveHallId);
        var activeHallName = response.Availability?.HallName ?? response.HallDetails?.HallName
            ?? (response.Halls is { Count: 1 } ? response.Halls[0].HallName : state.ActiveHallName);
        var rememberedHallIds = halls.Length > 0 ? halls : state.ShownHallIds?.ToArray() ?? [];
        var selectedIndex = activeHallId is { } id && rememberedHallIds.Length > 0
            ? Array.IndexOf(rememberedHallIds, id) is var index && index >= 0 ? index : state.SelectedResultIndex
            : state.SelectedResultIndex;

        var clarificationField = response.Kind == AiAssistantResponseKind.Clarification
            ? plan?.ClarificationRequirement?.Field
                ?? (intent?.Intent == AiIntentType.CheckHallAvailability ? "date" : null)
            : null;
        var pendingDate = clarificationField == "date";
        // A date clarification carries no hall payload, so without this the active
        // hall resolved for the question (single search result / focused hall) would
        // be lost and the later date reply could never resume (TryResume needs it).
        if (pendingDate && activeHallId is null && conversationHall is not null)
        {
            activeHallId = conversationHall.HallId;
            activeHallName = conversationHall.HallName;
        }
        var date = plan?.Date ?? intent?.Date ?? state.ResolvedDate;
        var requested = new List<string>();
        if (question == AiHallQuestion.Price || message.Contains("بكم", StringComparison.Ordinal)) requested.Add("price");
        if (question == AiHallQuestion.Availability || message.Contains("متى", StringComparison.Ordinal)) requested.Add("availability");
        if (question == AiHallQuestion.Location) requested.Add("location");
        if (question == AiHallQuestion.Capacity) requested.Add("capacity");

        var navigation = response.Actions?.FirstOrDefault(a => a.Type == AiAssistantActionTypes.Navigate)?.PageKey;
        var isPlatformTopic = plan?.Goal is AiSemanticGoal.PlatformKnowledge or AiSemanticGoal.OwnerWorkflow or AiSemanticGoal.BookingHelp;
        var currentTopic = topicSwitch || isPlatformTopic
            ? "platform"
            : plan?.Goal is AiSemanticGoal.FindHall or AiSemanticGoal.CompareHalls or AiSemanticGoal.HallDetails or AiSemanticGoal.CheckAvailability
                ? "hall"
                : state.CurrentTopic;
        var seenHallIds = halls.Length > 0
            ? Array.Empty<Guid>()
            : response.HallDetails is not null && activeHallId is { } selectedHallId
                ? (state.SeenHallIds ?? Array.Empty<Guid>()).Append(selectedHallId).Distinct().Take(10).ToArray()
                : state.SeenHallIds;
        var preserveRankedSelection = plan?.ContinuationType is AiContinuationType.ContextualFollowUp or AiContinuationType.ClarificationAnswer
            && state.LastSemanticPlan?.ComparisonIntent is AiComparisonIntent.Cheapest or AiComparisonIntent.MostExpensive
                or AiComparisonIntent.Largest or AiComparisonIntent.Smallest or AiComparisonIntent.BestBudgetFit or AiComparisonIntent.MostSuitable;
        return state with
        {
            ActiveGoal = topicSwitch || isPlatformTopic ? state.ActiveGoal : task,
            ActiveIntent = intent?.Intent.ToString() ?? state.ActiveIntent,
            PendingIntent = clarificationField is null ? null : intent?.Intent.ToString(),
            PendingClarification = clarificationField,
            MissingField = clarificationField,
            ActiveHallId = activeHallId,
            ActiveHallName = activeHallName,
            LastSelectedHallId = response.HallDetails is not null || response.Availability is not null
                ? activeHallId ?? state.LastSelectedHallId
                : state.LastSelectedHallId,
            ShownHallIds = halls.Length > 0 ? halls : state.ShownHallIds,
            SeenHallIds = halls.Length > 0 ? Array.Empty<Guid>() : seenHallIds,
            SelectedResultIndex = selectedIndex,
            Region = plan?.Region ?? intent?.Region ?? state.Region,
            Capacity = plan?.Capacity ?? intent?.Capacity ?? state.Capacity,
            RequestedFacts = plan?.RequestedFacts is { Count: > 0 } planFacts
                ? planFacts.Select(fact => fact.ToString()).Take(8).ToArray()
                : requested.Count > 0 ? requested : state.RequestedFacts,
            ResolvedDate = date,
            LastNavigationTarget = navigation ?? state.LastNavigationTarget,
            PendingNavigationTarget = navigation ?? (plan?.NavigationIntent is not null ? plan.NavigationIntent : state.PendingNavigationTarget),
            LastAction = response.Actions?.FirstOrDefault()?.Type ?? (response.Kind switch
            {
                AiAssistantResponseKind.Halls => "search_halls",
                AiAssistantResponseKind.HallDetails => "select_hall",
                AiAssistantResponseKind.Availability => "check_availability",
                _ => state.LastAction
            }),
            LastToolOutcome = response.Kind is AiAssistantResponseKind.Error or AiAssistantResponseKind.Unsupported
                ? "blocked"
                : response.Kind is AiAssistantResponseKind.Halls or AiAssistantResponseKind.HallDetails or AiAssistantResponseKind.Availability
                    ? "success"
                    : state.LastToolOutcome,
            CurrentTopic = currentTopic,
            TaskStatus = clarificationField is not null ? "blocked"
                : response.Kind is AiAssistantResponseKind.Error or AiAssistantResponseKind.Unsupported ? "blocked"
                : IsNextResult(message) && response.HallDetails is null && response.Halls is not { Count: > 0 } ? "exhausted"
                : "active",
            LastQuestionType = question == AiHallQuestion.None ? state.LastQuestionType : question.ToString(),
            ConversationStage = clarificationField is not null ? $"awaiting_{clarificationField}" : response.Kind.ToString(),
            LastSemanticPlan = preserveRankedSelection ? state.LastSemanticPlan : plan ?? state.LastSemanticPlan
        };
    }

    public static AiAssistantIntentDto? TryResume(AiConversationState? state, string message, DateOnly today)
    {
        if (state?.PendingClarification != "date" || state.ActiveHallId is null || state.ActiveHallName is null)
            return null;
        var date = AiRelativeDateResolver.Resolve(message, today)
            ?? new NaturalLanguageCriteriaExtractor().Extract(message, today, allowBareCapacity: false).Date;
        if (date is null)
            return null;
        return new AiAssistantIntentDto(
            AiIntentType.CheckHallAvailability, state.Region, null, date, state.Capacity, state.ActiveHallName);
    }

    public static AiAssistantIntentDto? TryResume(AiConversationState? state, string message, DateOnly today, string? region, int? capacity)
    {
        if (state?.PendingClarification is null)
            return null;
        var extractor = new NaturalLanguageCriteriaExtractor();
        var field = state.PendingClarification;
        var criteria = extractor.Extract(message, today, allowBareCapacity: field == "capacity");
        if (field == "capacity" && criteria.Capacity is { } guests)
            return new AiAssistantIntentDto(AiIntentType.SearchHalls, region ?? state.Region, null, null, guests, null);
        if (field == "region" && criteria.Region is { } requestedRegion)
            return new AiAssistantIntentDto(AiIntentType.SearchHalls, requestedRegion, null, null, capacity ?? state.Capacity, null);
        if (field == "date" && state.ActiveHallId is not null && state.ActiveHallName is not null)
            return TryResume(state, message, today);
        return null;
    }

    public static bool IsCollectionRequest(string message)
    {
        var text = AiText.Normalize(message);
        return System.Text.RegularExpressions.Regex.IsMatch(text,
            @"(?:قاعات|صالات|شو\s+عندكم|كل\s+(?:القاعات|الصالات))",
            System.Text.RegularExpressions.RegexOptions.CultureInvariant);
    }

    public static bool IsCollectionQuestion(string message)
    {
        var text = AiText.Normalize(message);
        var nounOnly = System.Text.RegularExpressions.Regex.IsMatch(text,
            @"^(?:(?:كل\s+)?(?:القاعات|قاعات|الصالات|صالات)|شو\s+عندكم)$",
            System.Text.RegularExpressions.RegexOptions.CultureInvariant);
        return (nounOnly || IsCollectionRequest(message)) && System.Text.RegularExpressions.Regex.IsMatch(text,
            @"(?:شو|ايش|احكيلي|وريني|فرجيني|اعرض|قلي|موجود|عندكم|what|show|list|browse)",
            System.Text.RegularExpressions.RegexOptions.CultureInvariant);
    }

    public static bool IsNextResult(string message)
    {
        return AiReferenceResolver.IsNextResult(message);
    }

    public static AiConversationState AdvanceSelection(AiConversationState? prior, AiHallRef selected, int index, AiSemanticPlan? plan = null)
    {
        var state = prior ?? new AiConversationState();
        return state with
        {
            ActiveGoal = "find_hall",
            ActiveIntent = nameof(AiIntentType.GetHallDetails),
            ActiveHallId = selected.HallId,
            ActiveHallName = selected.HallName,
            LastSelectedHallId = selected.HallId,
            SeenHallIds = (state.SeenHallIds ?? Array.Empty<Guid>()).Append(selected.HallId).Distinct().Take(10).ToArray(),
            SelectedResultIndex = index,
            ShownHallIds = prior?.ShownHallIds,
            Capacity = plan?.Capacity ?? prior?.Capacity,
            Region = plan?.Region ?? prior?.Region,
            LastSemanticPlan = plan ?? prior?.LastSemanticPlan,
            PendingClarification = null,
            MissingField = null,
            ConversationStage = "result_selected"
        };
    }

    public static AiConversationState AdvanceOrdinal(AiConversationState? prior, AiHallRef selected, int index, AiSemanticPlan? plan = null)
        => AdvanceSelection(prior, selected, index, plan) with { ConversationStage = "ordinal_selected" };

    public static AiConversationState WithCollectionResults(AiConversationState? prior, IReadOnlyList<AiHallRef> shown, AiSemanticPlan? plan = null)
        => (prior ?? new AiConversationState()) with
        {
            ActiveGoal = "find_hall",
            ActiveIntent = nameof(AiIntentType.SearchHalls),
            PendingIntent = null,
            PendingClarification = null,
            MissingField = null,
            ShownHallIds = shown.Select(hall => hall.HallId).Take(10).ToArray(),
            SeenHallIds = Array.Empty<Guid>(),
            ActiveHallId = null,
            ActiveHallName = null,
            LastSelectedHallId = null,
            SelectedResultIndex = -1,
            Region = plan?.Region ?? prior?.Region,
            Capacity = plan?.Capacity ?? prior?.Capacity,
            LastSemanticPlan = plan ?? prior?.LastSemanticPlan,
            ConversationStage = "results_shown"
        };
}
