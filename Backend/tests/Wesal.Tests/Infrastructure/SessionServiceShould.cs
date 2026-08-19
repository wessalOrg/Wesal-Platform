using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;
using Wesal.Infrastructure.Sessions;

namespace Wesal.Tests.Infrastructure;

public class SessionServiceShould
{
    [Fact]
    public void GetSession_Guest_ReturnsUnauthenticatedState()
    {
        var service = CreateService(authenticated: false);

        var result = service.GetSession();

        Assert.False(result.IsAuthenticated);
        Assert.Null(result.Role);
        Assert.Null(result.UserName);
    }

    [Fact]
    public void GetSession_RegisteredUser_ReturnsAuthenticatedState()
    {
        var service = CreateService(
            authenticated: true,
            userName: "mohammed",
            roles: [ApplicationRoles.RegisteredUser]);

        var result = service.GetSession();

        Assert.True(result.IsAuthenticated);
        Assert.Equal(ApplicationRoles.RegisteredUser, result.Role);
        Assert.Equal("mohammed", result.UserName);
    }

    [Fact]
    public void GetSession_HallOwner_ReturnsHallOwnerRole()
    {
        var service = CreateService(
            authenticated: true,
            userName: "ahmed",
            roles: [ApplicationRoles.HallOwner]);

        var result = service.GetSession();

        Assert.True(result.IsAuthenticated);
        Assert.Equal(ApplicationRoles.HallOwner, result.Role);
        Assert.Equal("ahmed", result.UserName);
    }

    [Fact]
    public void GetSession_Admin_ReturnsAdminAsPrimary()
    {
        var service = CreateService(
            authenticated: true,
            userName: "admin",
            roles: [ApplicationRoles.RegisteredUser, ApplicationRoles.Admin]);

        var result = service.GetSession();

        Assert.True(result.IsAuthenticated);
        Assert.Equal(ApplicationRoles.Admin, result.Role);
    }

    [Fact]
    public void GetSession_Guest_DoesNotExposeSensitiveData()
    {
        var json = System.Text.Json.JsonSerializer.Serialize(CreateService(authenticated: false).GetSession());

        Assert.DoesNotContain("password", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("token", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("email", json, StringComparison.OrdinalIgnoreCase);
    }

    private static SessionService CreateService(
        bool authenticated,
        string? userName = null,
        IReadOnlyList<string>? roles = null)
    {
        return new SessionService(new FakeCurrentUserService(authenticated, userName, roles ?? []));
    }

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        public FakeCurrentUserService(bool authenticated, string? userName, IReadOnlyList<string> roles)
        {
            IsAuthenticated = authenticated;
            UserName = userName;
            Roles = roles;
        }

        public string? UserId => IsAuthenticated ? "user-1" : null;
        public string? UserName { get; }
        public string? Email => null;
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }
}
