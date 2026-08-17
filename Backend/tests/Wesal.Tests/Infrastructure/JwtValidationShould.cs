using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Wesal.Infrastructure.Auth;

namespace Wesal.Tests.Infrastructure;

public class JwtValidationShould
{
    private const string SecretKey = "test_signing_key_that_is_at_least_32_characters_long";

    private static JwtSettings Settings => new()
    {
        Issuer = "WesalTests",
        Audience = "WesalTests",
        SecretKey = SecretKey,
        ExpirationMinutes = 30,
        ClockSkewMinutes = 5
    };

    [Fact]
    public void ValidToken_AuthenticatesAndPreservesIdentityClaims()
    {
        var token = CreateToken(expires: DateTime.UtcNow.AddMinutes(30), roles: ["Admin"]);

        var principal = Validate(token, Settings);

        Assert.True(principal.Identity?.IsAuthenticated);
        Assert.Equal("ahmad", principal.Identity?.Name);
        Assert.Equal("user-1", principal.FindFirst(ApplicationClaimTypes.UserId)?.Value);
        Assert.Equal("ahmad@example.com", principal.FindFirst(ApplicationClaimTypes.Email)?.Value);
        Assert.True(principal.IsInRole("Admin"));
    }

    [Fact]
    public void ExpiredToken_IsRejected()
    {
        var token = CreateToken(expires: DateTime.UtcNow.AddMinutes(-10), roles: ["RegisteredUser"]);

        Assert.Throws<SecurityTokenExpiredException>(() => Validate(token, Settings));
    }

    [Fact]
    public void TokenWithoutExpiration_IsRejected()
    {
        var token = CreateToken(expires: null, roles: ["RegisteredUser"]);

        Assert.Throws<SecurityTokenNoExpirationException>(() => Validate(token, Settings));
    }

    [Fact]
    public void TokenSignedWithDifferentKey_IsRejected()
    {
        var token = CreateToken(
            expires: DateTime.UtcNow.AddMinutes(30),
            roles: ["RegisteredUser"],
            secret: "another_test_key_that_is_also_thirty_two_chars");

        Assert.Throws<SecurityTokenSignatureKeyNotFoundException>(() => Validate(token, Settings));
    }

    [Fact]
    public void TokenWithWrongIssuer_IsRejected()
    {
        var token = CreateToken(
            expires: DateTime.UtcNow.AddMinutes(30),
            roles: ["RegisteredUser"],
            issuer: "OtherIssuer");

        Assert.Throws<SecurityTokenInvalidIssuerException>(() => Validate(token, Settings));
    }

    [Fact]
    public void TokenWithWrongAudience_IsRejected()
    {
        var token = CreateToken(
            expires: DateTime.UtcNow.AddMinutes(30),
            roles: ["RegisteredUser"],
            audience: "OtherAudience");

        Assert.Throws<SecurityTokenInvalidAudienceException>(() => Validate(token, Settings));
    }

    private static ClaimsPrincipal Validate(string token, JwtSettings settings)
    {
        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
        return handler.ValidateToken(token, JwtTokenValidationParametersFactory.Create(settings), out _);
    }

    private static string CreateToken(
        DateTime? expires,
        string[] roles,
        string secret = SecretKey,
        string issuer = "WesalTests",
        string audience = "WesalTests")
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ApplicationClaimTypes.UserId, "user-1"),
            new(ApplicationClaimTypes.UserName, "ahmad"),
            new(ApplicationClaimTypes.Email, "ahmad@example.com")
        };

        claims.AddRange(roles.Select(role => new Claim(ApplicationClaimTypes.Role, role)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: DateTime.UtcNow.AddMinutes(-30),
            expires: expires,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}