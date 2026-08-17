using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
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
    public void GetSession_Admin_ReturnsAdminRole()
    {
        var service = CreateService(
            authenticated: true,
            userName: "admin",
            roles: [ApplicationRoles.Admin]);

        var result = service.GetSession();

        Assert.True(result.IsAuthenticated);
        Assert.Equal(ApplicationRoles.Admin, result.Role);
        Assert.Equal("admin", result.UserName);
    }

    [Fact]
    public void GetSession_AdminWithMultipleRoles_ReturnsAdminAsPrimary()
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
    public void GetSession_HallOwnerWithRegisteredUser_ReturnsHallOwnerAsPrimary()
    {
        var service = CreateService(
            authenticated: true,
            userName: "owner",
            roles: [ApplicationRoles.RegisteredUser, ApplicationRoles.HallOwner]);

        var result = service.GetSession();

        Assert.True(result.IsAuthenticated);
        Assert.Equal(ApplicationRoles.HallOwner, result.Role);
    }

    [Fact]
    public void GetSession_AuthenticatedWithNoRoles_ReturnsNullRole()
    {
        var service = CreateService(
            authenticated: true,
            userName: "user",
            roles: []);

        var result = service.GetSession();

        Assert.True(result.IsAuthenticated);
        Assert.Null(result.Role);
        Assert.Equal("user", result.UserName);
    }

    [Fact]
    public void GetSession_Guest_DoesNotExposeSensitiveData()
    {
        var service = CreateService(authenticated: false);

        var result = service.GetSession();

        var json = System.Text.Json.JsonSerializer.Serialize(result);
        Assert.DoesNotContain("password", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("token", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("hash", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("email", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void GetSession_Authenticated_DoesNotExposeSensitiveData()
    {
        var service = CreateService(
            authenticated: true,
            userName: "mohammed",
            roles: [ApplicationRoles.RegisteredUser]);

        var result = service.GetSession();

        var json = System.Text.Json.JsonSerializer.Serialize(result);
        Assert.DoesNotContain("password", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("token", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("hash", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("email", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("userId", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("securityStamp", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void GetSession_CaseInsensitiveRoleMatch()
    {
        var service = CreateService(
            authenticated: true,
            userName: "user",
            roles: ["admin"]);

        var result = service.GetSession();

        Assert.Equal(ApplicationRoles.Admin, result.Role);
    }

    [Fact]
    public void GetSession_RespondsToCurrentUserState()
    {
        var service = CreateService(
            authenticated: true,
            userName: "user1",
            roles: [ApplicationRoles.RegisteredUser]);

        var result1 = service.GetSession();
        Assert.True(result1.IsAuthenticated);

        var service2 = CreateService(authenticated: false);
        var result2 = service2.GetSession();
        Assert.False(result2.IsAuthenticated);
    }

    private static SessionService CreateService(
        bool authenticated,
        string? userName = null,
        IReadOnlyList<string>? roles = null)
    {
        var currentUser = new FakeCurrentUserService(authenticated, userName, roles ?? []);
        return new SessionService(currentUser);
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
