using Microsoft.AspNetCore.Identity;
using Wesal.Domain.Enums;

namespace Wesal.Infrastructure.Identity;

public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;

    public Language PreferredLanguage { get; set; } = Language.Arabic;

    /// <summary>
    /// Relative storage URL of the owner-uploaded identity document (ID card). Required
    /// (backend-enforced) before a Hall Owner can create a hall. Stored OUTSIDE the
    /// public static-file area; only the owner and the Admin can read it.
    /// </summary>
    public string? IdentityDocumentUrl { get; set; }

    public DateTimeOffset? IdentityDocumentUploadedAt { get; set; }

    /// <summary>
    /// Optional profile picture URL of the user (Edit 22). Null when the user never set
    /// one; surfaced read-only on profile and comment responses whenever present.
    /// </summary>
    public string? ProfilePictureUrl { get; set; }

    /// <summary>
    /// True once the account has submitted whatever role-specific setup data its role
    /// requires (WESAL coordinator/photographer registration). Regular users and hall
    /// owners are created with this already true; coordinators and photographers are
    /// created false and the flag flips only when their setup submission commits.
    /// Existing rows were backfilled to true by the introducing migration, so no
    /// pre-existing account is retroactively treated as incomplete.
    /// </summary>
    public bool IsSetupComplete { get; set; } = true;

    /// <summary>
    /// The account-level approval state (WESAL coordinator/photographer registration).
    /// Defaults to <see cref="AccountApprovalStatus.Approved"/> so every pre-existing
    /// account remains valid; coordinator/photographer registrations explicitly start
    /// <see cref="AccountApprovalStatus.Pending"/> and are never auto-approved.
    /// </summary>
    public AccountApprovalStatus ApprovalStatus { get; set; } = AccountApprovalStatus.Approved;
}
