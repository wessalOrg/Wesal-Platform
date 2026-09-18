using Wesal.Application.Common.Interfaces;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Email test double that always reports a successful send without delivering
/// anything. Used by tests that construct <see cref="Wesal.Infrastructure.Auth.AuthService"/>
/// only to exercise registration.
/// </summary>
public sealed class NullEmailService : IEmailService
{
    public static NullEmailService Instance { get; } = new();

    public Task<bool> TrySendAsync(
        string to,
        string subject,
        string body,
        CancellationToken cancellationToken = default)
        => Task.FromResult(true);
}