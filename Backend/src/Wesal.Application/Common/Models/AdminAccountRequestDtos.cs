using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

// --- WESAL Tasks 5/6: Administrator review of coordinator and photographer
// --- account requests ---

/// <summary>
/// One coordinator account request in the Administrator's list (WESAL Task 5,
/// requirement 5.1). Carries no document URLs or storage keys — the detail response and
/// the authenticated document endpoints are how an Administrator sees images.
/// </summary>
public class AdminCoordinatorRequestDto
{
    public string UserId { get; init; } = string.Empty;

    public string FullName { get; init; } = string.Empty;

    public string Email { get; init; } = string.Empty;

    public AccountApprovalStatus ApprovalStatus { get; init; }

    /// <summary>The shop-vs-freelance answer that selects which setup branch applies.</summary>
    public CoordinatorBusinessType BusinessType { get; init; }

    /// <summary>Shop name (shop branch) or online store name (freelance branch).</summary>
    public string? DisplayName { get; init; }

    public DateTimeOffset SubmittedAt { get; init; }
}

/// <summary>
/// The full coordinator setup submission for the Administrator's detail view
/// (WESAL Task 5, requirement 5.2): every setup field plus an authenticated endpoint for
/// every image. The *Url properties are ENDPOINT PATHS served by this API with the
/// Administrator policy — never private storage keys and never public media URLs.
/// </summary>
public class AdminCoordinatorRequestDetailDto
{
    public string UserId { get; init; } = string.Empty;

    public string FullName { get; init; } = string.Empty;

    public string Email { get; init; } = string.Empty;

    public string? UserPhoneNumber { get; init; }

    public AccountApprovalStatus ApprovalStatus { get; init; }

    public bool IsSetupComplete { get; init; }

    // --- Setup form fields (all of them, requirement 5.2) ---

    public CoordinatorBusinessType BusinessType { get; init; }

    public string? ShopName { get; init; }

    public string? ShopLocation { get; init; }

    public string? OnlineStoreName { get; init; }

    /// <summary>The contact phone number submitted on the setup form.</summary>
    public string SetupPhoneNumber { get; init; } = string.Empty;

    public DateTimeOffset SubmittedAt { get; init; }

    // --- Images: authenticated Administrator endpoints (requirement 5.2) ---

    /// <summary>Streams the coordinator's personal ID document.</summary>
    public string? IdentityDocumentUrl { get; init; }

    /// <summary>Shop branch only; null when the branch does not apply or no photo was uploaded.</summary>
    public string? ShopPhotoUrl { get; init; }

    /// <summary>Freelance branch only; null when the branch does not apply or no photo was uploaded.</summary>
    public string? WorkPhoto1Url { get; init; }

    /// <summary>Freelance branch only; null when the branch does not apply or no photo was uploaded.</summary>
    public string? WorkPhoto2Url { get; init; }
}

/// <summary>
/// One photographer account request in the Administrator's list (WESAL Task 6,
/// requirement 6.1).
/// </summary>
public class AdminPhotographerRequestDto
{
    public string UserId { get; init; } = string.Empty;

    public string FullName { get; init; } = string.Empty;

    public string Email { get; init; } = string.Empty;

    public AccountApprovalStatus ApprovalStatus { get; init; }

    public bool HasStudio { get; init; }

    /// <summary>Studio name (studio branch); null for the no-studio branch.</summary>
    public string? DisplayName { get; init; }

    public DateTimeOffset SubmittedAt { get; init; }
}

/// <summary>
/// The full photographer setup submission for the Administrator's detail view
/// (WESAL Task 6, requirement 6.2), including <see cref="LegalFullName"/> — the
/// administrator-only verification name, which must never reach any client-facing
/// response other than this Administrator-policy surface.
/// </summary>
public class AdminPhotographerRequestDetailDto
{
    public string UserId { get; init; } = string.Empty;

    /// <summary>The account's display name.</summary>
    public string FullName { get; init; } = string.Empty;

    public string Email { get; init; } = string.Empty;

    public string? UserPhoneNumber { get; init; }

    public AccountApprovalStatus ApprovalStatus { get; init; }

    public bool IsSetupComplete { get; init; }

    // --- Setup form fields (all of them, requirement 6.2) ---

    public bool HasStudio { get; init; }

    public string? StudioName { get; init; }

    public string? StudioLocation { get; init; }

    public string? DetailedStudioLocation { get; init; }

    /// <summary>
    /// Administrator-only legal full name of a no-studio photographer (requirement 6.2).
    /// Null on the studio branch.
    /// </summary>
    public string? LegalFullName { get; init; }

    /// <summary>The contact phone number submitted on the setup form.</summary>
    public string SetupPhoneNumber { get; init; } = string.Empty;

    public DateTimeOffset SubmittedAt { get; init; }

    // --- Images: authenticated Administrator endpoint (requirement 6.2) ---

    /// <summary>Streams the photographer's personal ID document.</summary>
    public string? IdentityDocumentUrl { get; init; }
}

/// <summary>
/// The mandatory reason an Administrator writes when rejecting an account request
/// (WESAL Task 5, requirement 5.5; Task 6, requirement 6.4). Delivered to the user
/// inside the rejection notification and posted into the Admin conversation.
/// </summary>
public class AdminRejectAccountRequestDto
{
    /// <summary>Rejection reason; required, trimmed, bounded by the message column.</summary>
    public string? Reason { get; init; }
}

/// <summary>
/// The mandatory notes an Administrator writes when asking a photographer to edit their
/// submission (WESAL Task 6, requirement 6.5). Posted into the Admin conversation; the
/// "request needs editing" notification points at that conversation rather than
/// repeating the notes (requirement 15.6).
/// </summary>
public class AdminRequestChangesDto
{
    /// <summary>What the photographer must edit; required, trimmed, bounded.</summary>
    public string? Notes { get; init; }
}

/// <summary>
/// The outcome of an approve / reject / request-changes decision on an account request.
/// </summary>
public class AdminAccountRequestDecisionResultDto
{
    public string UserId { get; init; } = string.Empty;

    /// <summary>The account's approval status after the decision.</summary>
    public AccountApprovalStatus Status { get; init; }

    /// <summary>
    /// True when the durable notification row was committed AND the best-effort realtime
    /// push that mirrors it succeeded. False means the row exists but the push failed
    /// (or was skipped); the decision itself was still committed either way.
    /// </summary>
    public bool NotificationDelivered { get; init; }
}

/// <summary>
/// The resolved Admin↔user request conversation (WESAL Tasks 5/6, "contact coordinator /
/// photographer"). Opening a thread never posts a placeholder message, so this carries
/// only what a client needs to navigate to it.
/// </summary>
public class AdminUserConversationDto
{
    /// <summary>The thread to open. The same id for a given user on every call.</summary>
    public Guid ConversationId { get; init; }

    /// <summary>The coordinator/photographer this thread belongs to.</summary>
    public string UserId { get; init; } = string.Empty;

    /// <summary>True when the thread already existed, false when this call created it.</summary>
    public bool IsExisting { get; init; }
}
