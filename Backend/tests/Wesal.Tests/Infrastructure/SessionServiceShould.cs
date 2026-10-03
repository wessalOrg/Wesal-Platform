using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Infrastructure.Sessions;

namespace Wesal.Tests.Infrastructure;

public class SessionServiceShould
{
    [Fact]
    public async Task GetSession_Guest_ReturnsUnauthenticatedState()
    {
        var service = CreateService(authenticated: false);

        var result = await service.GetSessionAsync();

        Assert.False(result.IsAuthenticated);
        Assert.Null(result.Role);
        Assert.Null(result.UserName);
    }

    [Fact]
    public async Task GetSession_RegisteredUser_ReturnsAuthenticatedState()
    {
        var service = CreateService(
            authenticated: true,
            userName: "mohammed",
            roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.GetSessionAsync();

        Assert.True(result.IsAuthenticated);
        Assert.Equal(ApplicationRoles.RegisteredUser, result.Role);
        Assert.Equal("mohammed", result.UserName);
    }

    [Fact]
    public async Task GetSession_HallOwner_ReturnsHallOwnerRole()
    {
        var service = CreateService(
            authenticated: true,
            userName: "ahmed",
            roles: [ApplicationRoles.HallOwner]);

        var result = await service.GetSessionAsync();

        Assert.True(result.IsAuthenticated);
        Assert.Equal(ApplicationRoles.HallOwner, result.Role);
        Assert.Equal("ahmed", result.UserName);
    }

    [Fact]
    public async Task GetSession_Admin_ReturnsAdminRole()
    {
        var service = CreateService(
            authenticated: true,
            userName: "admin",
            roles: [ApplicationRoles.Admin]);

        var result = await service.GetSessionAsync();

        Assert.True(result.IsAuthenticated);
        Assert.Equal(ApplicationRoles.Admin, result.Role);
        Assert.Equal("admin", result.UserName);
    }

    [Fact]
    public async Task GetSession_AdminWithMultipleRoles_ReturnsAdminAsPrimary()
    {
        var service = CreateService(
            authenticated: true,
            userName: "admin",
            roles: [ApplicationRoles.RegisteredUser, ApplicationRoles.Admin]);

        var result = await service.GetSessionAsync();

        Assert.True(result.IsAuthenticated);
        Assert.Equal(ApplicationRoles.Admin, result.Role);
    }

    [Fact]
    public async Task GetSession_HallOwnerWithRegisteredUser_ReturnsHallOwnerAsPrimary()
    {
        var service = CreateService(
            authenticated: true,
            userName: "owner",
            roles: [ApplicationRoles.RegisteredUser, ApplicationRoles.HallOwner]);

        var result = await service.GetSessionAsync();

        Assert.True(result.IsAuthenticated);
        Assert.Equal(ApplicationRoles.HallOwner, result.Role);
    }

    [Fact]
    public async Task GetSession_AuthenticatedWithNoRoles_ReturnsNullRole()
    {
        var service = CreateService(
            authenticated: true,
            userName: "user",
            roles: []);

        var result = await service.GetSessionAsync();

        Assert.True(result.IsAuthenticated);
        Assert.Null(result.Role);
        Assert.Equal("user", result.UserName);
    }

    [Fact]
    public async Task GetSession_Guest_DoesNotExposeSensitiveData()
    {
        var service = CreateService(authenticated: false);

        var result = await service.GetSessionAsync();

        var json = System.Text.Json.JsonSerializer.Serialize(result);
        Assert.DoesNotContain("password", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("token", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("hash", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("email", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetSession_Authenticated_DoesNotExposeSensitiveData()
    {
        var service = CreateService(
            authenticated: true,
            userName: "mohammed",
            roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.GetSessionAsync();

        var json = System.Text.Json.JsonSerializer.Serialize(result);
        Assert.DoesNotContain("password", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("token", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("hash", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("email", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("userId", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("securityStamp", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetSession_CaseInsensitiveRoleMatch()
    {
        var service = CreateService(
            authenticated: true,
            userName: "user",
            roles: ["admin"]);

        var result = await service.GetSessionAsync();

        Assert.Equal(ApplicationRoles.Admin, result.Role);
    }

    [Fact]
    public async Task GetSession_RespondsToCurrentUserState()
    {
        var service = CreateService(
            authenticated: true,
            userName: "user1",
            roles: [ApplicationRoles.RegisteredUser]);

        var result1 = await service.GetSessionAsync();
        Assert.True(result1.IsAuthenticated);

        var service2 = CreateService(authenticated: false);
        var result2 = await service2.GetSessionAsync();
        Assert.False(result2.IsAuthenticated);
    }

    [Fact]
    public async Task GetSession_Guest_ReportsNoOwnership()
    {
        var service = CreateService(authenticated: false);

        var result = await service.GetSessionAsync();

        Assert.False(result.IsHallOwner);
        Assert.False(result.OwnsHall);
    }

    [Fact]
    public async Task GetSession_HallOwnerWithHalls_ReportsOwnership()
    {
        var service = CreateService(
            authenticated: true,
            userName: "ahmed",
            roles: [ApplicationRoles.HallOwner],
            hallCount: 2);

        var result = await service.GetSessionAsync();

        Assert.True(result.IsHallOwner);
        Assert.True(result.OwnsHall);
    }

    [Fact]
    public async Task GetSession_SeekerWithoutHalls_ReportsNoOwnership()
    {
        var service = CreateService(
            authenticated: true,
            userName: "mohammed",
            roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.GetSessionAsync();

        Assert.False(result.IsHallOwner);
        Assert.False(result.OwnsHall);
    }

    private static SessionService CreateService(
        bool authenticated,
        string? userName = null,
        IReadOnlyList<string>? roles = null,
        int hallCount = 0)
    {
        var currentUser = new FakeCurrentUserService(authenticated, userName, roles ?? []);
        return new SessionService(currentUser, new FakeOwnerDashboardRepository(hallCount));
    }

    private sealed class FakeOwnerDashboardRepository(int hallCount) : IOwnerDashboardRepository
    {
        public Task<int> GetHallCountByOwnerAsync(string ownerId, CancellationToken cancellationToken = default)
            => Task.FromResult(hallCount);

        public Task<IReadOnlyList<Hall>> GetOwnedHallsAsync(string ownerId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([]);

        public Task<Hall?> GetOwnedHallWithDetailsAsync(Guid hallId, string ownerId, CancellationToken cancellationToken = default)
            => Task.FromResult<Hall?>(null);

        public Task<Hall?> GetOwnedHallForUpdateAsync(Guid hallId, string ownerId, CancellationToken cancellationToken = default)
            => Task.FromResult<Hall?>(null);

        public void AddHallImages(IEnumerable<HallImage> images)
        {
        }

        public void AddHallFeatures(IEnumerable<HallFeature> features)
        {
        }

        public Task<Hall?> GetOwnedHallAsync(Guid hallId, string ownerId, CancellationToken cancellationToken = default)
            => Task.FromResult<Hall?>(null);

        public Task<IReadOnlyList<OwnerBookingRequestDto>?> GetBookingRequestsAsync(Guid hallId, string ownerId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<OwnerBookingRequestDto>?>(null);

        public Task<IReadOnlyList<Booking>?> GetActiveBookingsInRangeAsync(Guid hallId, string ownerId, DateOnly fromDate, DateOnly toDate, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Booking>?>(null);
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
