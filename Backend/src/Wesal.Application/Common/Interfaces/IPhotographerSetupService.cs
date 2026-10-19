using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// The Photographer's account setup submission (WESAL photographer setup).
///
/// The submission always applies to the AUTHENTICATED caller's own account — there is
/// no target-user parameter, so a photographer can never submit setup data for another
/// account. A successful submission persists the branch data, marks the account setup
/// complete, moves the account to <c>Pending</c> approval, and durably records the
/// "request received" notification, all in one database transaction.
/// </summary>
public interface IPhotographerSetupService
{
    Task<PhotographerSetupResult> SubmitSetupAsync(
        PhotographerSetupSubmission submission,
        CancellationToken cancellationToken = default);
}
