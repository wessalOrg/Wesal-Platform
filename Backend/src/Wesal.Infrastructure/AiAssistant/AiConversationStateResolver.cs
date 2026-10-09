using Wesal.Application.Ai;
using Wesal.Application.Ai.Navigation;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>Deterministically advances the small, bounded task state after each answer.</summary>
public static class AiConversationStateResolver
{
    public static AiConversationState Advance(AiConversationState? prior, string message, AiAssistantResponse response)
    {
        var state = prior ?? new AiConversationState();
        var intent = response.Intent;
        var halls = response.Halls?.Select(h => h.HallId).Take(10).ToArray() ?? [];
        var question = AiHallQuestionClassifier.Classify(message);
        var topicSwitch = intent?.Intent == AiIntentType.HowTo && !string.IsNullOrWhiteSpace(message)
            && (message.Contains("مطور", StringComparison.Ordinal) || message.Contains("اضيف", StringComparison.Ordinal) || message.Contains("أضيف", StringComparison.Ordinal));
        var task = topicSwitch ? "knowledge" : intent?.Intent switch
        {
            AiIntentType.SearchHalls => "find_hall",
            AiIntentType.GetHallDetails => "hall_details",
            AiIntentType.CheckHallAvailability => "check_availability",
            AiIntentType.HowTo => state.ActiveGoal,
            _ => state.ActiveGoal
        };

        var activeHallId = response.Availability?.HallId ?? response.HallDetails?.HallId
            ?? (response.Halls is { Count: 1 } ? response.Halls[0].HallId : state.ActiveHallId);
        var activeHallName = response.Availability?.HallName ?? response.HallDetails?.HallName
            ?? (response.Halls is { Count: 1 } ? response.Halls[0].HallName : state.ActiveHallName);
        var selectedIndex = activeHallId is { } id && halls.Length > 0
            ? Array.IndexOf(halls, id) is var index && index >= 0 ? index : state.SelectedResultIndex
            : state.SelectedResultIndex;

        var pendingDate = response.Kind == AiAssistantResponseKind.Clarification
            && intent?.Intent == AiIntentType.CheckHallAvailability;
        var date = intent?.Date ?? state.ResolvedDate;
        var requested = new List<string>();
        if (question == AiHallQuestion.Price || message.Contains("بكم", StringComparison.Ordinal)) requested.Add("price");
        if (question == AiHallQuestion.Availability || message.Contains("متى", StringComparison.Ordinal)) requested.Add("availability");
        if (question == AiHallQuestion.Location) requested.Add("location");
        if (question == AiHallQuestion.Capacity) requested.Add("capacity");

        var navigation = response.Actions?.FirstOrDefault(a => a.Type == AiAssistantActionTypes.Navigate)?.PageKey;
        return state with
        {
            ActiveGoal = task,
            ActiveIntent = intent?.Intent.ToString() ?? state.ActiveIntent,
            PendingIntent = pendingDate ? nameof(AiIntentType.CheckHallAvailability) : null,
            PendingClarification = pendingDate ? "date" : null,
            MissingField = pendingDate ? "date" : null,
            ActiveHallId = topicSwitch ? null : activeHallId,
            ActiveHallName = topicSwitch ? null : activeHallName,
            ShownHallIds = halls.Length > 0 ? halls : state.ShownHallIds,
            SelectedResultIndex = selectedIndex,
            Region = intent?.Region ?? state.Region,
            Capacity = intent?.Capacity ?? state.Capacity,
            RequestedFacts = requested.Count > 0 ? requested : state.RequestedFacts,
            ResolvedDate = date,
            LastNavigationTarget = navigation ?? state.LastNavigationTarget,
            LastQuestionType = question == AiHallQuestion.None ? state.LastQuestionType : question.ToString(),
            ConversationStage = pendingDate ? "awaiting_date" : response.Kind.ToString()
        };
    }

    public static AiAssistantIntentDto? TryResume(AiConversationState? state, string message, DateOnly today)
    {
        if (state?.PendingClarification != "date" || state.ActiveHallId is null || state.ActiveHallName is null)
            return null;
        var date = AiRelativeDateResolver.Resolve(message, today) ?? new NaturalLanguageCriteriaExtractor().Extract(message).Date;
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
        var criteria = extractor.Extract(message);
        var field = state.PendingClarification;
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

    public static AiConversationState AdvanceSelection(AiConversationState? prior, AiHallRef selected, int index)
        => (prior ?? new AiConversationState()) with
        {
            ActiveGoal = "find_hall",
            ActiveIntent = nameof(AiIntentType.GetHallDetails),
            ActiveHallId = selected.HallId,
            ActiveHallName = selected.HallName,
            SelectedResultIndex = index,
            ShownHallIds = prior?.ShownHallIds,
            Region = prior?.Region,
            Capacity = prior?.Capacity,
            PendingClarification = null,
            MissingField = null,
            ConversationStage = "result_selected"
        };

    public static AiConversationState AdvanceOrdinal(AiConversationState? prior, AiHallRef selected, int index)
        => AdvanceSelection(prior, selected, index) with { ConversationStage = "ordinal_selected" };

    public static AiConversationState WithCollectionResults(AiConversationState? prior, IReadOnlyList<AiHallRef> shown)
        => (prior ?? new AiConversationState()) with
        {
            ActiveGoal = "find_hall",
            ActiveIntent = nameof(AiIntentType.SearchHalls),
            PendingIntent = null,
            PendingClarification = null,
            MissingField = null,
            ShownHallIds = shown.Select(hall => hall.HallId).Take(10).ToArray(),
            SelectedResultIndex = -1,
            ConversationStage = "results_shown"
        };
}
