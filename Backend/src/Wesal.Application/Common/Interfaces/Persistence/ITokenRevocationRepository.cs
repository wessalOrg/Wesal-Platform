namespace Wesal.Application.Common.Interfaces.Persistence;

public interface ITokenRevocationRepository
{
    Task<bool> IsRevokedAsync(string jti, CancellationToken cancellationToken = default);

    Task<bool> UserExistsAsync(string userId, CancellationToken cancellationToken = default) => Task.FromResult(true);

    Task<bool> RevokeAsync(string jti, string userId, CancellationToken cancellationToken = default);
}
