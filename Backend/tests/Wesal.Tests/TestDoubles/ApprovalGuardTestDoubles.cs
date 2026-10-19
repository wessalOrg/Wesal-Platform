using Wesal.Application.Common.Interfaces;

namespace Wesal.Tests.TestDoubles;

/// <summary>
/// An approval guard that always allows publishing, for tests whose subject is NOT the
/// approval rule (the hall-owner authorization suite, ordinary comment/rating flows).
/// Tests whose subject IS the approval rule use the real
/// <c>Wesal.Infrastructure.Authorization.AccountApprovalGuard</c> instead.
/// </summary>
public sealed class PassThroughApprovalGuard : IAccountApprovalGuard
{
    public Task EnsureCanPublishAsync(CancellationToken cancellationToken = default)
        => Task.CompletedTask;

    public Task EnsureUserCanPublishAsync(string userId, CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}
