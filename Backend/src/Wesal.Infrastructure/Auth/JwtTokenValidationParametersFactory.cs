using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Wesal.Infrastructure.Auth;

public static class JwtTokenValidationParametersFactory
{
    public static TokenValidationParameters Create(JwtSettings settings)
        => new()
        {
            ValidateIssuer = true,
            ValidIssuer = settings.Issuer,
            ValidateAudience = true,
            ValidAudience = settings.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.SecretKey)),
            ValidateLifetime = true,
            RequireExpirationTime = true,
            ClockSkew = TimeSpan.FromMinutes(settings.ClockSkewMinutes),
            NameClaimType = ApplicationClaimTypes.UserName,
            RoleClaimType = ApplicationClaimTypes.Role
        };
}
