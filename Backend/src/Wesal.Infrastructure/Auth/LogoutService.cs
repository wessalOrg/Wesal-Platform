using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Auth;

public sealed class LogoutService : ILogoutService
{
    private const string LogoutSuccessMessage = "You have been logged out successfully.";

    private readonly ITokenRevocationRepository _tokenRevocationRepository;

    public LogoutService(ITokenRevocationRepository tokenRevocationRepository)
    {
        _tokenRevocationRepository = tokenRevocationRepository;
    }

    public async Task<LogoutResponse> LogoutAsync(
        string jti,
        string userId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (string.IsNullOrWhiteSpace(jti))
        {
            throw new UnauthorizedException("You are not authenticated.");
        }

        await _tokenRevocationRepository.RevokeAsync(jti, userId, cancellationToken);

        return new LogoutResponse
        {
            Message = LogoutSuccessMessage
        };
    }
}