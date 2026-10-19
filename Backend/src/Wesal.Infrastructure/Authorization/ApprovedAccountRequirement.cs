using Microsoft.AspNetCore.Authorization;

namespace Wesal.Infrastructure.Authorization;

/// <summary>
/// The authorization requirement behind <c>ApplicationPolicies.RequireApprovedAccount</c>
/// (WESAL approval enforcement): the caller must not be an unapproved Event Coordinator
/// or Photographer. Enforced by <see cref="ApprovedAccountAuthorizationHandler"/> using
/// the same rule as the service-level <c>IAccountApprovalGuard</c>.
/// </summary>
public sealed class ApprovedAccountRequirement : IAuthorizationRequirement
{
}
