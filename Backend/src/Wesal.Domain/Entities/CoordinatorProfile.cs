using Wesal.Domain.Enums;

namespace Wesal.Domain.Entities;

/// <summary>
/// The Event Coordinator's one-time account setup submission (WESAL coordinator setup).
///
/// A coordinator answers whether they have a shop or work freelance
/// (<see cref="BusinessType"/>) and then supplies the branch's required data. The
/// branch-exclusive columns are nullable so the shop branch never carries freelance
/// data and vice versa; the shared columns (phone, identity document) are required on
/// every valid submission.
///
/// All photo/document columns store PRIVATE relative document URLs (never public media
/// URLs): the files live in the protected document store and are only ever streamed
/// through authenticated, authorization-checked endpoints. The personal ID document is
/// readable solely by administrators; no API response ever returns these URLs or keys.
/// </summary>
public class CoordinatorProfile
{
    public Guid Id { get; set; }

    /// <summary>The coordinator's user id. One setup submission per account (unique index).</summary>
    public string UserId { get; set; } = string.Empty;

    /// <summary>The mandatory shop-vs-freelance answer that selects the required branch data.</summary>
    public CoordinatorBusinessType BusinessType { get; set; }

    // --- Branch A: coordinator has a shop -------------------------------------------

    public string? ShopName { get; set; }

    public string? ShopLocation { get; set; }

    /// <summary>Private relative URL of the shop photo attachment.</summary>
    public string? ShopPhotoUrl { get; set; }

    // --- Branch B: coordinator works freelance --------------------------------------

    public string? OnlineStoreName { get; set; }

    /// <summary>Private relative URL of the first of exactly two required work photos.</summary>
    public string? WorkPhoto1Url { get; set; }

    /// <summary>Private relative URL of the second of exactly two required work photos.</summary>
    public string? WorkPhoto2Url { get; set; }

    // --- Shared by both branches -----------------------------------------------------

    /// <summary>Contact phone number supplied on the setup form (both branches).</summary>
    public string PhoneNumber { get; set; } = string.Empty;

    /// <summary>Private relative URL of the personal ID document (admin-only retrieval).</summary>
    public string IdentityDocumentUrl { get; set; } = string.Empty;

    public DateTimeOffset SubmittedAt { get; set; }

    /// <summary>Short public bio for the coordinator (max length enforced by the profile service).</summary>
    public string? Bio { get; set; }
}
