namespace Wesal.Application.Common.Interfaces.Persistence;

public interface ITokenRevocationRepository
{
    Task<bool> IsRevokedAsync(string jti, CancellationToken cancellationToken = default);

    Task<bool> RevokeAsync(string jti, string userId, CancellationToken cancellationToken = default);
}