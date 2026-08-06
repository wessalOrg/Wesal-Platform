using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Wesal.Infrastructure.Auth;

namespace Wesal.Tests.Infrastructure;

public class TokenServiceShould
{
    private const string SecretKey = "test_signing_key_that_is_at_least_32_characters_long";

    [Fact]
    public void CreateToken_ReturnsNonEmptyJwt()
    {
        var service = CreateTokenService();

        var token = service.CreateToken(
            userId: "user-1",
            userName: "ahmad",
            email: "ahmad@example.com",
            roles: ["Admin"]);

        Assert.False(string.IsNullOrWhiteSpace(token));
        Assert.Equal(3, token.Split('.').Length);
    }

    [Fact]
    public void CreateToken_IncludesIdentityClaims()
    {
        var token = CreateTokenService().CreateToken("user-1", "ahmad", "ahmad@example.com", ["HallOwner"]);
        var claims = new JwtSecurityTokenHandler().ReadJwtToken(token).Claims.ToDictionary(c => c.Type, c => c.Value);

        Assert.Equal("user-1", claims[ApplicationClaimTypes.UserId]);
        Assert.Equal("ahmad", claims[ApplicationClaimTypes.UserName]);
        Assert.Equal("ahmad@example.com", claims[ApplicationClaimTypes.Email]);
        Assert.Contains(claims, c => c.Key == ApplicationClaimTypes.Role && c.Value == "HallOwner");
    }

    [Fact]
    public void CreateToken_ExpiresWithinConfiguredWindow()
    {
        var before = DateTime.UtcNow;
        var token = CreateTokenService().CreateToken("user-1", "ahmad", "ahmad@example.com", []);
        var after = DateTime.UtcNow;

        var expiresAt = new JwtSecurityTokenHandler().ReadJwtToken(token).ValidTo;

        Assert.True(expiresAt > before.AddMinutes(29));
        Assert.True(expiresAt <= after.AddMinutes(31));
    }

    [Fact]
    public void CreateToken_IsVerifiableWithSameKey()
    {
        var token = CreateTokenService().CreateToken("user-1", "ahmad", "ahmad@example.com", ["Admin"]);

        var parameters = new TokenValidationParameters
        {
            ValidIssuer = "WesalTests",
            ValidAudience = "WesalTests",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SecretKey)),
            NameClaimType = ApplicationClaimTypes.UserName,
            RoleClaimType = ApplicationClaimTypes.Role
        };

        new JwtSecurityTokenHandler().ValidateToken(token, parameters, out var validatedToken);

        Assert.NotNull(validatedToken);
    }

    private static TokenService CreateTokenService()
    {
        var settings = new JwtSettings
        {
            Issuer = "WesalTests",
            Audience = "WesalTests",
            SecretKey = SecretKey,
            ExpirationMinutes = 30,
            ClockSkewMinutes = 5
        };

        return new TokenService(Options.Create(settings));
    }
}
