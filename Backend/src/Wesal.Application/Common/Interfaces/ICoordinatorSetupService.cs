namespace Wesal.Application.Common.Interfaces;

using Wesal.Application.Common.Models;

/// <summary>
/// The Event Coordinator's account setup submission (WESAL coordinator setup).
/// </summary>
public interface ICoordinatorSetupService
{
    Task<CoordinatorSetupResult> SubmitSetupAsync(
        CoordinatorSetupSubmission submission,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Resubmits coordinator setup after rejection. Allowed only when current status is Rejected.
    /// Re-runs the same validators and attachment rules; updates the existing profile row.
    /// </summary>
    Task<CoordinatorSetupResult> ResubmitSetupAsync(
        CoordinatorSetupSubmission submission,
        CancellationToken cancellationToken = default);
}