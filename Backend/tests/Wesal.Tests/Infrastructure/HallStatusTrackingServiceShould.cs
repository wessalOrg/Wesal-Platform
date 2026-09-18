using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class HallStatusTrackingServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public HallStatusTrackingServiceShould()
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

    private Hall AddHall(string ownerId, string name, HallStatus status = HallStatus.PendingReview, bool isDeleted = false)
    {
        var hall = new Hall
        {
            Name = name,
            Address = "Gaza",
            Region = HallRegion.Gaza,
            Capacity = 100,
            OwnerId = ownerId,
            Status = status,
            IsDeleted = isDeleted
        };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private HallStatusTrackingService CreateService(FakeCurrentUser currentUser)
        => new(_userManager, currentUser, new OwnerDashboardRepository(_context));

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(string? userId, bool auth)
        {
            UserId = userId;
            IsAuthenticated = auth;
            Roles = userId is null ? [] : [ApplicationRoles.HallOwner];
        }

        public string? UserId { get; }
        public string? UserName => "test";
        public string? Email => "test@example.com";
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }

    [Fact]
    public async Task GetOwnedHalls_HallOwner_ReturnsOwnHallsWithCurrentStatus()
    {
        var owner = await CreateOwnerAsync("owner1@example.com", "+970599111111");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.PendingReview);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetOwnedHallsAsync();

        var item = Assert.Single(result);
        Assert.Equal(hall.Id, item.HallId);
        Assert.Equal("Grand Hall", item.HallName);
        Assert.Equal(HallStatus.PendingReview, item.Status);
    }

    [Fact]
    public async Task GetOwnedHalls_ReturnsCurrentPersistedState_WithoutCaching()
    {
        var owner = await CreateOwnerAsync("owner2@example.com", "+970599222222");
        var hall = AddHall(owner.Id, "Sunset Hall", HallStatus.PendingReview);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var first = Assert.Single(await service.GetOwnedHallsAsync());
        Assert.Equal(HallStatus.PendingReview, first.Status);

        // Simulate an Admin approving in another session: the persisted record changes.
        hall.Status = HallStatus.Approved;
        _context.SaveChanges();

        var second = Assert.Single(await service.GetOwnedHallsAsync());
        Assert.Equal(HallStatus.Approved, second.Status);

        // Simulate an Admin rejecting in another session.
        hall.Status = HallStatus.Rejected;
        _context.SaveChanges();

        var third = Assert.Single(await service.GetOwnedHallsAsync());
        Assert.Equal(HallStatus.Rejected, third.Status);
    }

    [Fact]
    public async Task GetOwnedHalls_ReturnsOnlyOwnHalls_NeverAnotherOwnersHalls()
    {
        var owner = await CreateOwnerAsync("owner3@example.com", "+970599333333");
        var other = await CreateOwnerAsync("other@example.com", "+970599444444");
        var ownPending = AddHall(owner.Id, "Own Pending", HallStatus.PendingReview);
        var ownApproved = AddHall(owner.Id, "Own Approved", HallStatus.Approved);
        var ownRejected = AddHall(owner.Id, "Own Rejected", HallStatus.Rejected);
        AddHall(other.Id, "Other's Hall", HallStatus.Approved);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetOwnedHallsAsync();

        var ownIds = result.Select(item => item.HallId).OrderBy(id => id).ToArray();
        Assert.Equal(new[] { ownApproved.Id, ownPending.Id, ownRejected.Id }.OrderBy(id => id).ToArray(), ownIds);
        Assert.DoesNotContain(result, item => item.HallName == "Other's Hall");
    }

    [Fact]
    public async Task GetOwnedHalls_ExcludesDeletedHalls()
    {
        var owner = await CreateOwnerAsync("owner4@example.com", "+970599555555");
        AddHall(owner.Id, "Visible Hall", HallStatus.PendingReview);
        AddHall(owner.Id, "Deleted Hall", HallStatus.PendingReview, isDeleted: true);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetOwnedHallsAsync();

        var item = Assert.Single(result);
        Assert.Equal("Visible Hall", item.HallName);
    }

    [Fact]
    public async Task GetOwnedHalls_HallOwnerWithoutHalls_ReturnsEmptyList()
    {
        var owner = await CreateOwnerAsync("owner5@example.com", "+970599666666");
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetOwnedHallsAsync();

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetOwnedHalls_Unauthenticated_ThrowsUnauthorized()
    {
        var service = CreateService(new FakeCurrentUser(null, false));

        await Assert.ThrowsAsync<UnauthorizedException>(() => service.GetOwnedHallsAsync());
    }

    [Fact]
    public async Task GetOwnedHalls_MissingUserAccount_ThrowsNotFound()
    {
        var service = CreateService(new FakeCurrentUser("not-a-real-id", true));

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetOwnedHallsAsync());
    }

    [Fact]
    public async Task GetOwnedHalls_ResolvesOwnerOnlyFromSession()
    {
        // The tracking API must never accept a client-supplied owner identity: the
        // owner is resolved exclusively from the authenticated session, which prevents
        // one owner from enumerating another owner's halls.
        var method = typeof(IHallStatusTrackingService).GetMethod(nameof(IHallStatusTrackingService.GetOwnedHallsAsync));
        Assert.NotNull(method);

        var parameters = method!.GetParameters();
        var parameter = Assert.Single(parameters);
        Assert.Equal(typeof(CancellationToken), parameter.ParameterType);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }
}