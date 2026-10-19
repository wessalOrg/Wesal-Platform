namespace Wesal.Domain.Entities;

/// <summary>
/// The Photographer's one-time account setup submission (WESAL photographer setup).
///
/// A photographer answers the mandatory "do you have a studio or a place for
/// photography?" question (<see cref="HasStudio"/>) and then supplies the branch's
/// required data. The studio branch carries the studio name, the general studio
/// location, and the detailed geographic location; the no-studio branch carries an
/// administrator-only legal full name. The branch-exclusive columns are nullable so
/// the studio branch never carries no-studio data and vice versa; the shared columns
/// (phone, identity document) are required on every valid submission.
///
/// <see cref="FullName"/> is STRICTLY ADMINISTRATOR-ONLY: it is the verification name
/// of a photographer without a studio and must never appear in any client-facing
/// response, log, or public projection — only in this protected database column and
/// (later, Tasks 5/6) the administrator review surface.
///
/// All document columns store PRIVATE relative document URLs (never public media
/// URLs): the files live in the protected document store and are only ever streamed
/// through authenticated, authorization-checked endpoints. The personal ID document is
/// readable solely by administrators; no API response ever returns these URLs or keys.
/// </summary>
public class PhotographerProfile
{
    public Guid Id { get; set; }

    /// <summary>The photographer's user id. One setup submission per account (unique index).</summary>
    public string UserId { get; set; } = string.Empty;

    /// <summary>
    /// The mandatory "do you have a studio or a place for photography?" answer that
    /// selects the required branch data.
    /// </summary>
    public bool HasStudio { get; set; }

    // --- Branch A: photographer has a studio ----------------------------------------

    public string? StudioName { get; set; }

    /// <summary>General location of the studio.</summary>
    public string? StudioLocation { get; set; }

    /// <summary>The studio's detailed geographic location (kept distinct from <see cref="StudioLocation"/>).</summary>
    public string? DetailedStudioLocation { get; set; }

    // --- Branch B: photographer has no studio ---------------------------------------

    /// <summary>
    /// Administrator-only legal full name of a photographer without a studio. Never
    /// returned to any client-facing response.
    /// </summary>
    public string? FullName { get; set; }

    // --- Shared by both branches -----------------------------------------------------

    /// <summary>Contact phone number supplied on the setup form (both branches; the studio branch's studio phone).</summary>
    public string PhoneNumber { get; set; } = string.Empty;

    /// <summary>Private relative URL of the personal ID document (admin-only retrieval).</summary>
    public string IdentityDocumentUrl { get; set; } = string.Empty;

    public DateTimeOffset SubmittedAt { get; set; }

    /// <summary>Short public bio for the photographer (max length enforced by the profile service).</summary>
    public string? Bio { get; set; }
}
