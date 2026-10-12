namespace Wesal.Application.Common.Models;

/// <summary>
/// A bounded, typed interpretation of one Mabrouk turn. It contains intent only;
/// identifiers, permissions, prices, and availability must still be resolved by
/// trusted application services before they can be returned to the user.
/// </summary>
public sealed record AiSemanticPlan(
    AiSemanticGoal Goal,
    AiContinuationType ContinuationType,
    AiHallReference HallReference,
    AiResultSetReference? ResultSetReference,
    AiSelectedResultReference? SelectedResultReference,
    AiComparisonIntent ComparisonIntent,
    IReadOnlyList<AiRequestedFact> RequestedFacts,
    string? Region,
    string? Area,
    DateOnly? Date,
    AiDateRange? DateRange,
    AiMonth? Month,
    int? Capacity,
    AiPriceBudget PriceBudget,
    AiPriceSortPreference SortPreference,
    bool AvailabilityIntent,
    string? NavigationIntent,
    IReadOnlyList<AiSemanticGoal> CompoundGoals,
    AiClarificationRequirement? ClarificationRequirement,
    AiPlanConfidence Confidence,
    string Language,
    IReadOnlyList<AiSelectedResultReference>? SelectedResultReferences = null);

public enum AiSemanticGoal
{
    FindHall,
    CompareHalls,
    HallDetails,
    CheckAvailability,
    PlatformKnowledge,
    OwnerWorkflow,
    BookingHelp,
    Navigate,
    Unknown
}

public enum AiContinuationType
{
    NewRequest,
    RefineSearch,
    ResultFollowUp,
    ContextualFollowUp,
    ClarificationAnswer
}

public enum AiHallReferenceKind
{
    None,
    ExplicitName,
    ActiveHall,
    PagePinnedHall,
    ResultSetSelection
}

public sealed record AiHallReference(AiHallReferenceKind Kind, string? Name = null);

public enum AiResultSetReferenceKind
{
    LastShown
}

public sealed record AiResultSetReference(AiResultSetReferenceKind Kind);

/// <summary>Zero-based result position resolved only against server-held result ids.</summary>
public sealed record AiSelectedResultReference(int Index);

public enum AiComparisonIntent
{
    None,
    Cheapest,
    MostExpensive,
    Largest,
    Smallest,
    BestBudgetFit,
    CompareSelected
}

public enum AiRequestedFact
{
    Price,
    Capacity,
    Location,
    Area,
    Availability,
    Contact,
    Photos,
    Services,
    Rating,
    Name
}

public enum AiPriceSortPreference
{
    Relevance,
    LowestPrice,
    HighestPrice,
    ClosestToTarget
}

public enum AiPlanConfidence
{
    Low,
    Medium,
    High
}

public sealed record AiPriceBudget(decimal? MinimumPrice = null, decimal? MaximumPrice = null, decimal? AroundPrice = null)
{
    public bool IsSpecified => MinimumPrice.HasValue || MaximumPrice.HasValue || AroundPrice.HasValue;
}

public sealed record AiDateRange(DateOnly Start, DateOnly End);

public sealed record AiMonth(int Year, int Month);

public sealed record AiClarificationRequirement(string Field, string Question);
