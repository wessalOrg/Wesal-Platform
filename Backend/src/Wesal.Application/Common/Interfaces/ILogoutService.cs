using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface ILogoutService
{
    Task<LogoutResponse> LogoutAsync(string jti, string userId, CancellationToken cancellationToken = default);
}