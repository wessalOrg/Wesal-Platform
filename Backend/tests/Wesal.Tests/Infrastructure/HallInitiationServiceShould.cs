using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence.Data;

namespace Wesal.Tests.Infrastructure;

public class HallInitiationServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public HallInitiationServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddIdentityCore<ApplicationUser>(o =>
        {
            o.Password.RequireDigit = true;
            o.Password.RequireLowercase = true;
            o.Password.RequireUppercase = true;
            o.Password.RequireNonAlphanumeric = true;
            o.Password.RequiredLength = 8;
            o.User.RequireUniqueEmail = true;
        }).AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
        services.AddLogging();
        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
        var roleManager = _provider.GetRequiredService<RoleManager<ApplicationRole>>();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.HallOwner)).GetAwaiter().GetResult();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
    }

    private async Task<ApplicationUser> CreateOwnerAsync(string email, string phone)
    {
        var user = new ApplicationUser { FullName = "Hall Owner", Email = email, UserName = email, PhoneNumber = phone };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, ApplicationRoles.HallOwner);
        return user;
    }

    private int HallCount()
        => _context.Halls.Count(hall => !hall.IsDeleted);

    private HallInitiationService CreateService(FakeCurrentUser currentUser)
        => new(_userManager, currentUser);

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(string? userId, bool auth, params string[] roles)
        {
            UserId = userId;
            IsAuthenticated = auth;
            Roles = roles;
        }

        public string? UserId { get; }
        public string? UserName => "test";
        public string? Email => "test@example.com";
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }

    [Fact]
    public async Task Initiate_HallOwner_ReturnsReady()
    {
        var user = await CreateOwnerAsync("owner1@example.com", "+970599111111");
        var service = CreateService(new FakeCurrentUser(user.Id, true, ApplicationRoles.HallOwner));

        var result = await service.InitiateAsync();

        Assert.Equal(HallInitiation.StatusReady, result.Status);
        Assert.Equal(HallInitiation.CodeReady, result.Code);
    }

    [Fact]
    public async Task Initiate_Unauthenticated_ThrowsUnauthorized()
    {
        var service = CreateService(new FakeCurrentUser(null, false));

        await Assert.ThrowsAsync<UnauthorizedException>(() => service.InitiateAsync());
    }

    [Fact]
    public async Task Initiate_ExpiredOrInvalidSession_IsRejectedAsUnauthenticated()
    {
        // A user without a live session context is treated exactly like a logged-out
        // visitor: the RequireHallOwner pipeline and this service reject it rather
        // than opening the Add Hall form.
        var service = CreateService(new FakeCurrentUser(null, false));

        await Assert.ThrowsAsync<UnauthorizedException>(() => service.InitiateAsync());
    }

    [Fact]
    public async Task Initiate_TokenForDeletedAccount_ThrowsNotFound()
    {
        var service = CreateService(new FakeCurrentUser("not-a-real-id", true, ApplicationRoles.HallOwner));

        await Assert.ThrowsAsync<NotFoundException>(() => service.InitiateAsync());
    }

    [Fact]
    public async Task Initiate_Success_CreatesNoHallRecord()
    {
        var user = await CreateOwnerAsync("owner2@example.com", "+970599222222");
        var service = CreateService(new FakeCurrentUser(user.Id, true, ApplicationRoles.HallOwner));

        await service.InitiateAsync();

        Assert.Equal(0, HallCount());
    }

    [Fact]
    public async Task Initiate_BlockedPaths_CreateNoHallRecord()
    {
        var unauthenticated = CreateService(new FakeCurrentUser(null, false));
        await Assert.ThrowsAsync<UnauthorizedException>(() => unauthenticated.InitiateAsync());

        var deletedAccount = CreateService(new FakeCurrentUser("gone-id", true, ApplicationRoles.HallOwner));
        await Assert.ThrowsAsync<NotFoundException>(() => deletedAccount.InitiateAsync());

        Assert.Equal(0, HallCount());
    }

    [Fact]
    public async Task Initiate_ResolvesOwnerOnlyFromSession()
    {
        // The initiation flow must never accept a client-supplied owner identity.
        // The contract takes only a cancellation token; the owner is resolved
        // exclusively from the authenticated session.
        var method = typeof(IHallInitiationService).GetMethod(nameof(IHallInitiationService.InitiateAsync));
        Assert.NotNull(method);

        var parameters = method!.GetParameters();
        var parameter = Assert.Single(parameters);
        Assert.Equal(typeof(CancellationToken), parameter.ParameterType);
    }

    [Fact]
    public void Initiate_Response_IsMinimalAndMachineReadable()
    {
        var result = HallInitiationResponse.Ready();

        var json = JsonSerializer.Serialize(result);

        Assert.Equal("{\"Status\":\"Ready\",\"Code\":\"AddHallReady\"}", json);
        Assert.DoesNotContain("OwnerId", json);
        Assert.DoesNotContain("UserId", json);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }
}