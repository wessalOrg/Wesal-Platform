using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IRegistrationService
{
    Task<RegisterResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);
}