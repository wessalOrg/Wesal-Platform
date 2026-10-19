using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public class ProfileResponse
{
    /// <summary>
    /// The authenticated caller's own identity id (WESAL-TASK-9, Edit 9).
    ///
    /// This is the caller's own subject id, already present in their own access token;
    /// returning it is not a cross-user disclosure. It is required because the web
    /// client maps the payload as <c>id: String(data.id ?? data.userId ?? "self")</c>
    /// and then persists that value into stored auth state. Without a real id here the
    /// client fell back to the truthy sentinel string "self" and overwrote the signed-in
    /// user's stored id, corrupting the identity (and the session key derived from it)
    /// for every user whose profile loaded.
    /// </summary>
    public string Id { get; init; } = string.Empty;

    public string FullName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string PhoneNumber { get; init; } = string.Empty;
    public string ConcurrencyStamp { get; init; } = string.Empty;

    /// <summary>
    /// The user's profile picture URL when one is set (Edit 22); null otherwise.
    /// </summary>
    public string? ProfilePictureUrl { get; init; }

    /// <summary>
    /// True when the Hall Owner has uploaded an identity document. The document is
    /// mandatory before the owner can create a hall, so the profile UI can show the
    /// completion state (US-OWNER-30).
    /// </summary>
    public bool IsIdentityDocumentUploaded { get; init; }

    /// <summary>
    /// False while an Event Coordinator or Photographer still owes their role-specific
    /// setup submission; true for completed accounts (including every pre-existing
    /// regular user and hall owner). The client uses this to decide whether to route
    /// the user into the setup step after login.
    /// </summary>
    public bool IsSetupComplete { get; init; } = true;

    /// <summary>
    /// The account-level approval state. Exposed as its string name so the client can
    /// show "awaiting review" without mirroring the numeric enum.
    /// </summary>
    public string ApprovalStatus { get; init; } = nameof(AccountApprovalStatus.Approved);
}

public class UpdateProfileRequest
{
    public string FullName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string PhoneNumber { get; init; } = string.Empty;
    public string? ConcurrencyStamp { get; init; }
}

public class ChangePasswordRequest
{
    public string CurrentPassword { get; init; } = string.Empty;
    public string NewPassword { get; init; } = string.Empty;
    public string ConfirmPassword { get; init; } = string.Empty;
}

public class ChangePasswordResponse
{
    public string Message { get; init; } = string.Empty;
}

public sealed class PublicProfessionalProfileResponse
{
    public string UserId { get; init; } = string.Empty;
    public string? Role { get; init; }
    public string? ApprovalStatus { get; init; }
    public bool IsPubliclyAvailable { get; init; }
    public string? DisplayName { get; init; }
    public string? ShopName { get; init; }
    public string? OnlineStoreName { get; init; }
    public string? PhoneNumber { get; init; }
    public string? ShopLocation { get; init; }
    public string? StudioName { get; init; }
    public string? StudioLocation { get; init; }
    public string? DetailedStudioLocation { get; init; }
    public string? Bio { get; init; }
    public string? ProfilePictureUrl { get; init; }
    // Latest publicly visible posts and active offers, with dedicated paged endpoints for full lists.
    public IReadOnlyList<PublicProfileContentDto> Posts { get; init; } = [];
    public IReadOnlyList<PublicProfileContentDto> Offers { get; init; } = [];
}

public sealed class PublicProfileContentDto
{
    public Guid Id { get; init; }
    public int SaveCount { get; init; }
    public string? OwnerUserId { get; init; }
    public string? Content { get; init; }
    public decimal? Price { get; init; }
    public decimal? OldPrice { get; init; }
    public decimal? OfferPrice { get; init; }
    public DateTimeOffset? StartsAt { get; init; }
    public DateTimeOffset? EndsAt { get; init; }
    public DateTimeOffset? StoppedAt { get; init; }
    public DateTimeOffset? CreatedAt { get; init; }
    public DateTimeOffset? UpdatedAt { get; init; }
    public IReadOnlyList<PublicProfileImageDto> Images { get; init; } = [];
}

public sealed class UpdatePublicBioRequest
{
    public string? Bio { get; init; }
}
