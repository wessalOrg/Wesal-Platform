using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces.Persistence;

namespace Wesal.Infrastructure.Auth;

/// <summary>
/// Session-revocation gate for JWT bearer authentication (production hardening).
///
/// Runs on every validated token: rejects tokens without a revocable session id
/// and tokens invalidated by logout. Fail-closed by design: when the revocation
/// store itself cannot be consulted (transient dependency failure), the request
/// is rejected instead of being authorized blindly, so a revoked session can
/// never come back to life because the database blinked. Cancellation (the
/// client is already gone) still passes through untouched.
/// </summary>
public static class TokenRevocationValidation
{
    public static async Task OnTokenValidatedAsync(TokenValidatedContext context)
    {
        var jti = context.Principal?.FindFirstValue(JwtRegisteredClaimNames.Jti);

        if (string.IsNullOrWhiteSpace(jti))
        {
            context.Fail("The authentication token does not carry a revocable session identifier.");
            return;
        }

        try
        {
            var tokenRevocationRepository = context.HttpContext.RequestServices
                .GetRequiredService<ITokenRevocationRepository>();

            if (await tokenRevocationRepository.IsRevokedAsync(jti, context.HttpContext.RequestAborted))
            {
                context.Fail("The authentication token has been invalidated by logout.");
            }
        }
        catch (OperationCanceledException)
        {
            // The client is gone; there is nothing left to authorize or reject.
        }
        catch (Exception)
        {
            // Fail closed: an unverifiable session must not be authorized.
            context.Fail("The authentication token revocation status could not be verified.");
        }
    }
}
