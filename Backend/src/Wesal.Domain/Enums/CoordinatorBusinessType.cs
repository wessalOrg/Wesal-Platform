namespace Wesal.Domain.Enums;

/// <summary>
/// The mandatory answer to "do you have a shop, or do you work freelance?" on the
/// Event Coordinator setup form (WESAL coordinator setup).
///
/// There is deliberately no zero/unspecified member: the question must be answered with
/// an explicit branch, and a submission carrying an unknown value is rejected by the
/// setup validator rather than silently defaulting to one of the branches.
/// </summary>
public enum CoordinatorBusinessType
{
    /// <summary>The coordinator operates a physical shop.</summary>
    Shop = 1,

    /// <summary>The coordinator works freelance and has no shop.</summary>
    Freelance = 2
}
