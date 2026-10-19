using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// The text fields of the Event Coordinator setup submission (WESAL coordinator setup).
///
/// Files travel alongside this form in <see cref="CoordinatorSetupSubmission"/>; the
/// branch-dependent requirements are enforced by
/// <see cref="Validation.CoordinatorSetupRequestValidator"/> and again by the setup
/// service, never trusted from client-side validation alone.
/// </summary>
public class CoordinatorSetupRequest
{
    /// <summary>
    /// The mandatory "do you have a shop, or do you work freelance?" answer
    /// (<c>Shop</c> or <c>Freelance</c>).
    /// </summary>
    public CoordinatorBusinessType? BusinessType { get; init; }

    // --- Branch A (Shop) ------------------------------------------------------------

    public string? ShopName { get; init; }

    /// <summary>Detailed geographic location of the shop.</summary>
    public string? ShopLocation { get; init; }

    // --- Branch B (Freelance) -------------------------------------------------------

    public string? OnlineStoreName { get; init; }

    // --- Shared by both branches ----------------------------------------------------

    public string? PhoneNumber { get; init; }
}

/// <summary>
/// The full setup submission: the text form plus the branch's required attachments.
/// Content bytes are validated (size, extension, MIME, signature) before anything is
/// written to the private document store.
/// </summary>
public class CoordinatorSetupSubmission
{
    public CoordinatorSetupRequest Form { get; init; } = new();

    /// <summary>Shop-branch only: photo of the shop.</summary>
    public OwnerDocumentUpload? ShopPhoto { get; init; }

    /// <summary>Freelance branch only: exactly two work photos (gift or decoration work).</summary>
    public IReadOnlyList<OwnerDocumentUpload>? WorkPhotos { get; init; }

    /// <summary>Both branches: the coordinator's personal ID document (admin-only retrieval).</summary>
    public OwnerDocumentUpload? IdentityDocument { get; init; }
}

/// <summary>
/// The result of a successful setup submission. Carries only minimal status
/// information — never private document URLs or storage keys.
/// </summary>
public class CoordinatorSetupResult
{
    public bool IsSetupComplete { get; init; }

    public AccountApprovalStatus ApprovalStatus { get; init; }

    public CoordinatorBusinessType BusinessType { get; init; }

    public DateTimeOffset SubmittedAt { get; init; }
}
