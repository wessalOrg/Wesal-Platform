using Wesal.Application.Common.Models;

namespace Wesal.Application.Ai;

/// <summary>
/// Compiles model interpretation, trusted request context, and explicit deterministic
/// criteria into the only plan that downstream read tools may execute. Numeric values,
/// dates, hall ids, and navigation URLs are always sourced from trusted code.
/// </summary>
public static class AiSemanticPlanResolver
{
    private static readonly NaturalLanguageCriteriaExtractor CriteriaExtractor = new();

    public static AiSemanticPlan Resolve(
        string message,
        string? language,
        DateOnly today,
        AiConversationContext? context,
        AiTurnContext turn,
        AiAssistantIntentDto? interpretation = null)
    {
        var pendingCapacity = string.Equals(context?.State?.PendingClarification, "capacity", StringComparison.Ordinal);
        var criteria = CriteriaExtractor.Extract(message, today, pendingCapacity);
        var dates = AiDateRangeResolver.Resolve(message, today);
        var (priceBudget, sortPreference) = AiPriceBudgetExtractor.Extract(message);
        var priorPlanBudget = context?.State?.LastSemanticPlan?.PriceBudget;
        var priorIntentBudget = context?.LastIntent is { Intent: AiIntentType.SearchHalls } priorSearch
            ? new AiPriceBudget(priorSearch.MinimumPrice, priorSearch.MaximumPrice, priorSearch.AroundPrice)
            : null;
        var priorBudget = priorPlanBudget?.IsSpecified == true ? priorPlanBudget : priorIntentBudget;
        var amendedBudget = AiPriceBudgetExtractor.ApplyConversationalAmendment(message, priceBudget, priorBudget);
        if (amendedBudget != priceBudget)
        {
            priceBudget = amendedBudget;
            sortPreference = priceBudget.AroundPrice.HasValue
                ? AiPriceSortPreference.ClosestToTarget
                : priceBudget.MaximumPrice.HasValue
                    ? AiPriceSortPreference.LowestPrice
                    : sortPreference;
        }
        var question = AiHallQuestionClassifier.Classify(message);
        var comparison = ResolveComparison(message, priceBudget);
        var priorPlan = context?.State?.LastSemanticPlan;
        var hasResults = (context?.LastHalls is { Count: > 0 } || context?.State?.ShownHallIds is { Count: > 0 })
            && (context?.LastIntent?.Intent == AiIntentType.SearchHalls
                || string.Equals(context?.State?.ActiveGoal, "find_hall", StringComparison.Ordinal));
        var isRecommendationFollowUp = comparison == AiComparisonIntent.MostSuitable
            && hasResults
            && priorPlan is not null;
        if (isRecommendationFollowUp && !priceBudget.IsSpecified)
        {
            priceBudget = priorPlan!.PriceBudget;
            sortPreference = priorPlan.SortPreference;
        }
        var explicitName = AiReferenceResolver.TryGetExplicitHallName(message);
        var ordinal = AiReferenceResolver.TryGetOrdinal(message);
        var hasActiveHall = turn.Hall is not null || context?.State?.ActiveHallId is not null;
        var comparisonOrdinals = AiReferenceResolver.GetOrdinals(message);
        var hasConcreteSearchFilters = HasConcreteSearchFilters(criteria)
            || isRecommendationFollowUp && (priorPlan!.Capacity.HasValue
                || !string.IsNullOrWhiteSpace(priorPlan.Region)
                || !string.IsNullOrWhiteSpace(priorPlan.Area)
                || priorPlan.PriceBudget.IsSpecified);
        var priorArea = context?.State?.LastSemanticPlan?.Area ?? context?.LastIntent?.Area;
        var clearedArea = !string.IsNullOrWhiteSpace(priorArea) && NegatesArea(message, priorArea) ? priorArea : null;
        var resultReference = ordinal.HasValue || comparison != AiComparisonIntent.None && hasResults
            && (!hasConcreteSearchFilters || comparison == AiComparisonIntent.MostSuitable);

        var hallReference = explicitName is not null
            ? new AiHallReference(AiHallReferenceKind.ExplicitName, Limit(explicitName, 120))
            : ordinal.HasValue
                ? new AiHallReference(AiHallReferenceKind.ResultSetSelection)
                : turn.HallSource is "pinned" or "page"
                    ? new AiHallReference(AiHallReferenceKind.PagePinnedHall, Limit(turn.Hall?.HallName, 120))
                    : hasActiveHall
                        ? new AiHallReference(AiHallReferenceKind.ActiveHall, Limit(turn.Hall?.HallName ?? context?.State?.ActiveHallName, 120))
                        : new AiHallReference(AiHallReferenceKind.None);

        var intentGoal = MapIntent(interpretation?.Intent ?? AiIntentType.Unknown);
        var goal = comparison != AiComparisonIntent.None
            ? comparison == AiComparisonIntent.CompareSelected
                ? AiSemanticGoal.CompareHalls
                : HasConcreteSearchFilters(criteria)
                    ? AiSemanticGoal.FindHall
                    : hasResults ? AiSemanticGoal.CompareHalls : AiSemanticGoal.FindHall
            : ResolveGoal(message, criteria, question, comparison, hallReference, intentGoal);
        if (comparison == AiComparisonIntent.None && priceBudget.IsSpecified
            && context?.LastIntent?.Intent == AiIntentType.SearchHalls)
            goal = AiSemanticGoal.FindHall;
        if (context?.State?.PendingClarification == "date")
            goal = AiSemanticGoal.CheckAvailability;
        else if (context?.State?.PendingClarification == "capacity" && criteria.Capacity.HasValue)
            goal = AiSemanticGoal.FindHall;
        var continuation = context?.State?.PendingClarification is not null
            ? AiContinuationType.ClarificationAnswer
            : resultReference
                ? AiContinuationType.ResultFollowUp
                : context?.LastIntent?.Intent == AiIntentType.SearchHalls && (HasSearchCriteria(criteria) || priceBudget.IsSpecified)
                    ? AiContinuationType.RefineSearch
                    : hasActiveHall && question != AiHallQuestion.None
                        ? AiContinuationType.ContextualFollowUp
                        : AiContinuationType.NewRequest;

        var requestedFacts = RequestedFacts(question, criteria.Area is not null);
        var resolvedDate = dates?.Date ?? criteria.Date;
        var range = dates?.Range;
        var month = dates?.Month;
        var confidence = goal == AiSemanticGoal.Unknown
            ? AiPlanConfidence.Low
            : hallReference.Kind != AiHallReferenceKind.None || HasSearchCriteria(criteria) || comparison != AiComparisonIntent.None
                ? AiPlanConfidence.High
                : context?.State?.PendingClarification is not null || hasActiveHall
                    ? AiPlanConfidence.Medium
                    : AiPlanConfidence.Medium;

        AiClarificationRequirement? clarification = null;
        if (goal == AiSemanticGoal.CheckAvailability && resolvedDate is null && range is null)
            clarification = new AiClarificationRequirement("date", language == "en" ? "Which date or month should I check?" : "لأي تاريخ أو شهر بتحب أفحص التوفر؟");
        else if (goal is AiSemanticGoal.HallDetails or AiSemanticGoal.CheckAvailability
            && hallReference.Kind == AiHallReferenceKind.None)
            clarification = new AiClarificationRequirement("hall", language == "en" ? "Which hall do you mean?" : "أي قاعة تقصد؟");
        else if (goal == AiSemanticGoal.FindHall && !HasSearchCriteria(criteria)
            && ContainsAny(message, "قاعة", "قاعه", "صالة", "صاله", "hall", "wedding hall"))
            clarification = new AiClarificationRequirement("capacity", language == "en" ? "About how many guests are you expecting?" : "كم ضيف تقريباً متوقع؟");

        var compoundGoals = new List<AiSemanticGoal>();
        if (goal != AiSemanticGoal.Unknown)
            compoundGoals.Add(goal);
        if (question == AiHallQuestion.Availability && goal != AiSemanticGoal.CheckAvailability)
            compoundGoals.Add(AiSemanticGoal.CheckAvailability);
        if (question == AiHallQuestion.Price && goal == AiSemanticGoal.FindHall)
            compoundGoals.Add(AiSemanticGoal.HallDetails);

        var plan = new AiSemanticPlan(
            goal,
            continuation,
            hallReference,
            resultReference && hasResults ? new AiResultSetReference(AiResultSetReferenceKind.LastShown) : null,
            ordinal is { } index ? new AiSelectedResultReference(index) : null,
            comparison,
            requestedFacts,
            criteria.Region ?? (isRecommendationFollowUp ? priorPlan!.Region : null),
            Limit(clearedArea is null ? criteria.Area ?? (isRecommendationFollowUp ? priorPlan!.Area : null) : null, 80),
            resolvedDate,
            range,
            month,
            criteria.Capacity ?? (isRecommendationFollowUp ? priorPlan!.Capacity : null),
            priceBudget,
            sortPreference,
            question == AiHallQuestion.Availability || resolvedDate.HasValue || range is not null,
            IsNavigationRequest(message) ? "halls" : null,
            compoundGoals.Distinct().Take(8).ToArray(),
            clarification,
            confidence,
            language?.StartsWith("en", StringComparison.OrdinalIgnoreCase) == true ? "en" : "ar",
            comparisonOrdinals.Select(index => new AiSelectedResultReference(index)).ToArray(),
            ClearAreaPreference: clearedArea is not null,
            ClearedArea: Limit(clearedArea, 80));

        return Validate(plan, message, today, context);
    }

    public static AiAssistantIntentDto ToLegacyIntent(AiSemanticPlan plan)
    {
        var intent = plan.Goal switch
        {
            AiSemanticGoal.FindHall or AiSemanticGoal.CompareHalls => AiIntentType.SearchHalls,
            AiSemanticGoal.HallDetails => AiIntentType.GetHallDetails,
            AiSemanticGoal.CheckAvailability => AiIntentType.CheckHallAvailability,
            AiSemanticGoal.PlatformKnowledge or AiSemanticGoal.OwnerWorkflow or AiSemanticGoal.BookingHelp => AiIntentType.HowTo,
            AiSemanticGoal.Navigate => AiIntentType.HowTo,
            _ => AiIntentType.Unknown
        };

        return new AiAssistantIntentDto(
            intent,
            plan.Region,
            plan.Area,
            plan.Date,
            plan.Capacity,
            plan.HallReference.Name,
            plan.PriceBudget.MaximumPrice,
            plan.SortPreference is AiPriceSortPreference.LowestPrice or AiPriceSortPreference.HighestPrice,
            plan.PriceBudget.MinimumPrice,
            plan.PriceBudget.AroundPrice,
            plan.SortPreference,
            plan);
    }

    private static AiSemanticPlan Validate(AiSemanticPlan plan, string message, DateOnly today, AiConversationContext? context)
    {
        var criteria = CriteriaExtractor.Extract(message, today,
            string.Equals(context?.State?.PendingClarification, "capacity", StringComparison.Ordinal));
        var prices = AiPriceBudgetExtractor.Extract(message);
        var priorBudget = context?.State?.LastSemanticPlan?.PriceBudget is { IsSpecified: true } remembered
            ? remembered
            : context?.LastIntent is { Intent: AiIntentType.SearchHalls } priorSearch
                ? new AiPriceBudget(priorSearch.MinimumPrice, priorSearch.MaximumPrice, priorSearch.AroundPrice)
                : null;
        var validatedBudget = AiPriceBudgetExtractor.ApplyConversationalAmendment(message, prices.Budget, priorBudget);
        var validatedSort = validatedBudget != prices.Budget
            ? validatedBudget.AroundPrice.HasValue ? AiPriceSortPreference.ClosestToTarget
                : validatedBudget.MaximumPrice.HasValue ? AiPriceSortPreference.LowestPrice : prices.SortPreference
            : prices.SortPreference;
        var currentMessageArea = criteria.Area;
        var name = AiReferenceResolver.TryGetExplicitHallName(message);
        var ordinal = AiReferenceResolver.TryGetOrdinal(message);
        var dates = AiDateRangeResolver.Resolve(message, today);
        var preserveRecommendationContext = plan.ComparisonIntent == AiComparisonIntent.MostSuitable
            && plan.ResultSetReference is not null
            && context?.State?.LastSemanticPlan is not null;

        // Never preserve a planner-supplied entity, number, region or calendar value
        // unless deterministic parsing found it in the current turn.
        return plan with
        {
            HallReference = name is not null
                ? new AiHallReference(AiHallReferenceKind.ExplicitName, Limit(name, 120))
                : ordinal.HasValue
                    ? new AiHallReference(AiHallReferenceKind.ResultSetSelection)
                    : plan.HallReference,
            SelectedResultReference = ordinal is { } selected ? new AiSelectedResultReference(selected) : null,
            Region = criteria.Region ?? (preserveRecommendationContext ? context!.State!.LastSemanticPlan!.Region : null),
            Area = plan.ClearAreaPreference ? null : Limit(currentMessageArea ?? (preserveRecommendationContext ? context!.State!.LastSemanticPlan!.Area : null), 80),
            Date = dates?.Date ?? criteria.Date,
            DateRange = dates?.Range is { } dateRange && dateRange.End.DayNumber - dateRange.Start.DayNumber <= 30 ? dateRange : null,
            Month = dates?.Month,
            Capacity = criteria.Capacity is > 0 and < 10000 ? criteria.Capacity : preserveRecommendationContext ? context!.State!.LastSemanticPlan!.Capacity : null,
            PriceBudget = validatedBudget.IsSpecified || !preserveRecommendationContext ? validatedBudget : context!.State!.LastSemanticPlan!.PriceBudget,
            SortPreference = validatedBudget.IsSpecified || !preserveRecommendationContext ? validatedSort : context!.State!.LastSemanticPlan!.SortPreference,
            RequestedFacts = plan.RequestedFacts.Distinct().Take(8).ToArray(),
            CompoundGoals = plan.CompoundGoals.Distinct().Take(8).ToArray(),
            NavigationIntent = IsNavigationRequest(message) ? "halls" : null,
            ClarificationRequirement = plan.ClarificationRequirement is { Field.Length: <= 40, Question.Length: <= 180 }
                ? plan.ClarificationRequirement
                : null,
            Language = plan.Language == "en" ? "en" : "ar"
        };
    }

    private static AiSemanticGoal ResolveGoal(
        string message,
        ExtractedCriteriaDto criteria,
        AiHallQuestion question,
        AiComparisonIntent comparison,
        AiHallReference hallReference,
        AiSemanticGoal modelIntent)
    {
        if (IsBrandKnowledgeQuestion(message))
            return AiSemanticGoal.PlatformKnowledge;

        if (comparison != AiComparisonIntent.None)
            return AiSemanticGoal.CompareHalls;
        if (HasSearchCriteria(criteria) && hallReference.Kind == AiHallReferenceKind.None)
            return AiSemanticGoal.FindHall;
        if (question == AiHallQuestion.Availability)
            return AiSemanticGoal.CheckAvailability;
        if (question != AiHallQuestion.None && hallReference.Kind != AiHallReferenceKind.None)
            return question == AiHallQuestion.BookingHowTo ? AiSemanticGoal.BookingHelp : AiSemanticGoal.HallDetails;
        if (HasSearchCriteria(criteria) || AiIntentFallbackClassifierSearchVocabulary(message))
            return AiSemanticGoal.FindHall;
        if (ContainsAny(message, "اضيف قاعتي", "أضيف قاعتي", "اضافة قاعة", "أضيف صالتي", "add my hall", "list my hall"))
            return AiSemanticGoal.OwnerWorkflow;
        if (question == AiHallQuestion.BookingHowTo)
            return AiSemanticGoal.BookingHelp;
        if (IsNavigationRequest(message))
            return AiSemanticGoal.Navigate;
        return modelIntent;
    }

    private static AiSemanticGoal MapIntent(AiIntentType intent) => intent switch
    {
        AiIntentType.SearchHalls or AiIntentType.GetFeaturedHalls => AiSemanticGoal.FindHall,
        AiIntentType.GetHallDetails => AiSemanticGoal.HallDetails,
        AiIntentType.CheckHallAvailability => AiSemanticGoal.CheckAvailability,
        AiIntentType.HowTo => AiSemanticGoal.PlatformKnowledge,
        _ => AiSemanticGoal.Unknown
    };

    private static AiComparisonIntent ResolveComparison(string message, AiPriceBudget budget)
    {
        var folded = AiText.Normalize(message);
        if (ContainsAny(folded, "قارن", "compare")) return AiComparisonIntent.CompareSelected;
        if (ContainsAny(folded, "انسب", "الانسب", "انسب وحدة", "انسب قاعة", "افضل وحدة", "افضل قاعة", "most suitable", "best fit", "best for me", "best hall", "best one")) return AiComparisonIntent.MostSuitable;
        if (ContainsAny(folded, "اغلي", "most expensive", "highest price")) return AiComparisonIntent.MostExpensive;
        if (ContainsAny(folded, "ارخص", "اقل سعر", "cheapest", "lowest price")) return AiComparisonIntent.Cheapest;
        if (ContainsAny(folded, "اكبر", "اعلى سعه", "largest", "biggest")) return AiComparisonIntent.Largest;
        if (ContainsAny(folded, "اصغر", "اقل سعه", "smallest")) return AiComparisonIntent.Smallest;
        if (budget.AroundPrice.HasValue) return AiComparisonIntent.BestBudgetFit;
        return AiComparisonIntent.None;
    }

    private static IReadOnlyList<AiRequestedFact> RequestedFacts(AiHallQuestion question, bool area)
    {
        var facts = question switch
        {
            AiHallQuestion.Price => new[] { AiRequestedFact.Price },
            AiHallQuestion.Capacity => new[] { AiRequestedFact.Capacity },
            AiHallQuestion.Location => new[] { AiRequestedFact.Location, AiRequestedFact.Area },
            AiHallQuestion.Services => new[] { AiRequestedFact.Services },
            AiHallQuestion.Photos => new[] { AiRequestedFact.Photos },
            AiHallQuestion.Availability => new[] { AiRequestedFact.Availability },
            AiHallQuestion.ContactOwner => new[] { AiRequestedFact.Contact },
            _ => Array.Empty<AiRequestedFact>()
        };
        return area ? facts.Append(AiRequestedFact.Area).Distinct().ToArray() : facts;
    }

    private static bool HasSearchCriteria(ExtractedCriteriaDto criteria)
        => criteria.Region is not null || criteria.Area is not null || criteria.Date.HasValue
            || criteria.Capacity.HasValue || criteria.MinimumPrice.HasValue || criteria.MaximumPrice.HasValue
            || criteria.AroundPrice.HasValue || criteria.SortByPrice;

    private static bool HasConcreteSearchFilters(ExtractedCriteriaDto criteria)
        => criteria.Region is not null || criteria.Area is not null || criteria.Date.HasValue
            || criteria.Capacity.HasValue || criteria.MinimumPrice.HasValue || criteria.MaximumPrice.HasValue
            || criteria.AroundPrice.HasValue;

    private static bool AiIntentFallbackClassifierSearchVocabulary(string message)
        => ContainsAny(message, "قاعة", "صالة", "صالات", "قاعات", "hall", "halls", "دورلي", "ابحث", "بدي صالة", "find me", "search for");

    private static bool IsBrandKnowledgeQuestion(string message)
    {
        var folded = AiText.Normalize(message);
        var mentionsBrand = ContainsAny(folded, "وصال", "مبروك", "wesal", "mabrook", "mabrouk");
        var includesHallSearch = ContainsAny(folded,
            "قاعه", "قاعات", "صاله", "صالات", "hall", "halls", "دورلي", "ابحث", "وريني", "فرجيني", "اعرض",
            "بدي", "عايز", "اريد", "ابغى", "متاح", "فاضي", "شخص", "ضيف", "capacity", "guests", "find me", "search for");
        return mentionsBrand && !includesHallSearch;
    }

    private static bool IsNavigationRequest(string message)
        => ContainsAny(message, "وديني", "خذني", "افتح صفحة", "روح على", "navigate to", "take me to", "go to");

    private static bool ContainsAny(string message, params string[] phrases)
    {
        var folded = AiText.Normalize(message);
        return phrases.Any(phrase => folded.Contains(AiText.Normalize(phrase), StringComparison.OrdinalIgnoreCase));
    }

    private static bool NegatesArea(string message, string area)
    {
        var folded = AiText.Normalize(message);
        var normalizedArea = AiText.Normalize(area);
        if (normalizedArea.Length == 0)
            return false;
        var areaToken = normalizedArea.Split(' ', StringSplitOptions.RemoveEmptyEntries).LastOrDefault() ?? normalizedArea;
        var forms = new[] { normalizedArea, areaToken,
                areaToken.StartsWith("ال", StringComparison.Ordinal) ? areaToken[2..] : areaToken }
            .Distinct(StringComparer.Ordinal);
        return forms.Any(form => ContainsAny(folded,
            $"مش {form}", $"مش في {form}", $"مش ب{form}", $"مش بال{form}",
            $"not {form}", $"not in {form}"));
    }

    private static string? Limit(string? value, int length)
        => string.IsNullOrWhiteSpace(value) ? null : new string(value.Where(c => !char.IsControl(c)).Take(length).ToArray()).Trim();
}
