namespace Wesal.Application.Common.Interfaces;

using Wesal.Application.Common.Models;

/// <summary>
/// The Photographer's account setup submission (WESAL photographer setup).
/// </summary>
public interface IPhotographerSetupService
{
    Task<PhotographerSetupResult> SubmitSetupAsync(
        PhotographerSetupSubmission submission,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Resubmits photographer setup after rejection or needs changes. Allowed only when current status is Rejected or NeedsChanges.
    /// Re-runs the same validators and attachment rules; updates the existing profile row.
    /// </summary>
    Task<PhotographerSetupResult> ResubmitSetupAsync(
        PhotographerSetupSubmission submission,
        CancellationToken cancellationToken = default);
}