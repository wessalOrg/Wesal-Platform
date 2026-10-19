namespace Wesal.Domain.Enums;

/// <summary>
/// The account-level approval state (WESAL coordinator/photographer registration).
///
/// Distinct from the hall-level <see cref="HallStatus"/>: this flag tracks whether the
/// PLATFORM account itself is approved, not a specific hall. The zero value is
/// <see cref="Approved"/> so every account that existed before this flag was introduced
/// remains valid with no data migration on the approval column; coordinator and
/// photographer accounts are explicitly moved to <see cref="Pending"/> on registration
/// and stay there until an administrator reviews them.
/// </summary>
public enum AccountApprovalStatus
{
    /// <summary>The account is in good standing (default for all pre-existing accounts).</summary>
    Approved = 0,

    /// <summary>The account submitted its role setup data and awaits administrative review.</summary>
    Pending = 1,

    /// <summary>An administrator rejected the account's setup submission.</summary>
    Rejected = 2
}
