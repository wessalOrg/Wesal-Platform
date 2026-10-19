using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// The text fields of the Photographer setup submission (WESAL photographer setup).
///
/// The file travels alongside this form in <see cref="PhotographerSetupSubmission"/>;
/// the branch-dependent requirements are enforced by
/// <see cref="Validation.PhotographerSetupRequestValidator"/> and again by the setup
/// service, never trusted from client-side validation alone.
/// </summary>
public class PhotographerSetupRequest
{
    /// <summary>
    /// The mandatory "do you have a studio or a place for photography?" answer.
    /// Nullable only so an omitted answer is distinguishable from an answered one and
    /// can be rejected; it never silently defaults to either choice.
    /// </summary>
    public bool? HasStudio { get; init; }

    // --- Branch A (HasStudio = true) --------------------------------------------------

    public string? StudioName { get; init; }

    /// <summary>General location of the studio.</summary>
    public string? StudioLocation { get; init; }

    /// <summary>The studio's detailed geographic location (kept distinct from the general location).</summary>
    public string? DetailedStudioLocation { get; init; }

    // --- Branch B (HasStudio = false) -------------------------------------------------

    /// <summary>
    /// Administrator-only legal full name (no-studio branch). Persisted on the protected
    /// profile column only and never returned to the photographer or any other client.
    /// </summary>
    public string? FullName { get; init; }

    // --- Shared by both branches ------------------------------------------------------

    /// <summary>Contact phone number; the studio branch's studio phone.</summary>
    public string? PhoneNumber { get; init; }
}

/// <summary>
/// The full setup submission: the text form plus the required personal ID document.
/// Content bytes are validated (size, extension, MIME, signature) before anything is
/// written to the private document store.
/// </summary>
public class PhotographerSetupSubmission
{
    public PhotographerSetupRequest Form { get; init; } = new();

    /// <summary>Both branches: the photographer's personal ID document (admin-only retrieval).</summary>
    public OwnerDocumentUpload? IdentityDocument { get; init; }
}

/// <summary>
/// The result of a successful setup submission. Carries only minimal status
/// information — never the admin-only full name, private document URLs, or storage keys.
/// </summary>
public class PhotographerSetupResult
{
    public bool IsSetupComplete { get; init; }

    public AccountApprovalStatus ApprovalStatus { get; init; }

    public bool HasStudio { get; init; }

    public DateTimeOffset SubmittedAt { get; init; }
}
