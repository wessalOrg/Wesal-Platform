using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface ILoginService
{
    Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
}