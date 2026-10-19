namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// The account-level publishing gate (WESAL approval enforcement). An Event Coordinator
/// or Photographer whose approval status is not <c>Approved</c> must not create or
/// edit user-generated content, while every other account type is unaffected.
///
/// Enforced both as a reusable authorization policy
/// (<c>ApplicationPolicies.RequireApprovedAccount</c>) for route-level protection and
/// as a service-level guard inside the existing content-creation services, so the rule
/// cannot be bypassed by reaching a service entry point directly.
/// </summary>
public interface IAccountApprovalGuard
{
    /// <summary>
    /// Throws when the AUTHENTICATED caller is not permitted to publish content:
    /// an Event Coordinator or Photographer with a non-Approved approval status is
    /// refused with the project's standard 403 exception; every other authenticated
    /// account passes.
    /// </summary>
    Task EnsureCanPublishAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Same rule as <see cref="EnsureCanPublishAsync"/>, resolved for an explicit user
    /// id (used by the authorization policy handler).
    /// </summary>
    Task EnsureUserCanPublishAsync(string userId, CancellationToken cancellationToken = default);
}
