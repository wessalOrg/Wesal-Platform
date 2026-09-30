using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Infrastructure.Auth;

namespace Wesal.Tests.Api;

/// <summary>
/// Session-revocation authentication guard (production hardening, Phase 7).
/// A revoked token must stay rejected, and an unverifiable revocation check
/// (transient dependency failure) must fail closed instead of authorizing blindly.
/// </summary>
public sealed class TokenRevocationValidationShould
{
    private const string TestKey = "test-secret-key-that-is-long-enough-32";

    private sealed class FakeRevocationRepository : ITokenRevocationRepository
    {
        private readonly Func<string, Task<bool>> _isRevoked;

        public FakeRevocationRepository(Func<string, Task<bool>> isRevoked) => _isRevoked = isRevoked;

        public Task<bool> IsRevokedAsync(string jti, CancellationToken cancellationToken = default)
            => _isRevoked(jti);

        public Task<bool> RevokeAsync(string jti, string userId, CancellationToken cancellationToken = default)
            => Task.FromResult(false);
    }

    private static (WebApplication App, HttpClient Client) BuildApp(Func<string, Task<bool>> isRevoked)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddScoped<ITokenRevocationRepository>(_ => new FakeRevocationRepository(isRevoked));
        builder.Services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = TokenRevocationValidation.OnTokenValidatedAsync
                };
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestKey)),
                    ValidateLifetime = false,
                    NameClaimType = "name",
                    RoleClaimType = "role"
                };
            });
        builder.Services.AddAuthorization();
        var app = builder.Build();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapGet("/secure", () => Results.Ok("ok")).RequireAuthorization();
        app.StartAsync().GetAwaiter().GetResult();
        return (app, app.GetTestClient());
    }

    private static string MintToken(string? jti)
    {
        var claims = new List<Claim>
        {
            new("sub", "user-1"),
            new("role", "HallOwner")
        };
        if (jti is not null)
        {
            claims.Add(new(JwtRegisteredClaimNames.Jti, jti));
        }

        var handler = new JwtSecurityTokenHandler();
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddHours(1),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestKey)),
                SecurityAlgorithms.HmacSha256)
        };
        return handler.CreateEncodedJwt(descriptor);
    }

    private static async Task<int> GetSecureAsync(HttpClient client, string token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/secure");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        return (int)(await client.SendAsync(request)).StatusCode;
    }

    [Fact]
    public async Task ActiveToken_NotRevoked_Returns200()
    {
        var (app, client) = BuildApp(_ => Task.FromResult(false));
        await using var _ = app;

        Assert.Equal(200, await GetSecureAsync(client, MintToken("active-jti")));
    }

    [Fact]
    public async Task RevokedToken_Returns401()
    {
        var (app, client) = BuildApp(jti => Task.FromResult(jti == "revoked-jti"));
        await using var _ = app;

        Assert.Equal(401, await GetSecureAsync(client, MintToken("revoked-jti")));
    }

    [Fact]
    public async Task TokenWithoutJti_Returns401()
    {
        var (app, client) = BuildApp(_ => Task.FromResult(false));
        await using var _ = app;

        Assert.Equal(401, await GetSecureAsync(client, MintToken(null)));
    }

    [Fact]
    public async Task RevocationStoreFailure_FailsClosedWith401()
    {
        // Simulates a transient revocation-DB outage for a live session: the
        // request must be rejected, never authorized blindly.
        var (app, client) = BuildApp(_ => Task.FromException<bool>(
            new InvalidOperationException("revocation store unavailable")));
        await using var _ = app;

        Assert.Equal(401, await GetSecureAsync(client, MintToken("active-jti")));
    }
}
