using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Authorization;

/// <summary>
/// Enforces <see cref="ApprovedAccountRequirement"/> at the endpoint level (WESAL
/// approval enforcement). Resolves the shared service-level approval guard so the route
/// policy and the in-service checks can never drift apart: an unapproved Event
/// Coordinator or Photographer fails authorization with the same rule the content
/// services apply. Every other authenticated account passes unchanged.
/// </summary>
public sealed class ApprovedAccountAuthorizationHandler : AuthorizationHandler<ApprovedAccountRequirement>
{
    private readonly IAccountApprovalGuard _approvalGuard;

    public ApprovedAccountAuthorizationHandler(IAccountApprovalGuard approvalGuard)
    {
        _approvalGuard = approvalGuard;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ApprovedAccountRequirement requirement)
    {
        if (context.Resource is not HttpContext httpContext)
        {
            // Fail closed: the approval state lives in the request's authenticated
            // principal and database; outside an HTTP request it cannot be verified.
            context.Fail();
            return;
        }

        try
        {
            await _approvalGuard.EnsureCanPublishAsync(httpContext.RequestAborted);
            context.Succeed(requirement);
        }
        catch (Exception ex) when (ex is ForbiddenException or UnauthorizedException)
        {
            context.Fail();
        }
    }
}
