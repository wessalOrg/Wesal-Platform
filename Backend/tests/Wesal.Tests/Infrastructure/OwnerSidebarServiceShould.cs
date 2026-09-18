using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class OwnerSidebarServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public OwnerSidebarServiceShould()
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

    private void AddHall(string ownerId, HallStatus status = HallStatus.Approved, bool isDeleted = false)
    {
        _context.Halls.Add(new Hall
        {
            Name = $"Hall {Guid.NewGuid():N}",
            Address = "Gaza",
            Region = HallRegion.Gaza,
            Capacity = 100,
            OwnerId = ownerId,
            Status = status,
            IsDeleted = isDeleted
        });
        _context.SaveChanges();
    }

    private OwnerSidebarService CreateService(FakeCurrentUser currentUser)
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
    public async Task GetSidebar_HallOwner_ReturnsManagementInterface()
    {
        var user = await CreateOwnerAsync("owner1@example.com", "+970599111111");
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        var result = await service.GetSidebarAsync();

        Assert.Equal(OwnerInterfaceTypes.HallOwnerManagement, result.InterfaceType);
    }

    [Fact]
    public async Task GetSidebar_HallOwner_ProfileSectionIsFirstAndOpenByDefault()
    {
        var user = await CreateOwnerAsync("owner2@example.com", "+970599222222");
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        var result = await service.GetSidebarAsync();

        var profile = Assert.Single(result.Sections, s => s.Key == OwnerSidebarSections.Profile);
        Assert.Equal("Profile", profile.Label);
        Assert.Equal(0, profile.Order);
        Assert.True(profile.IsDefault);
    }

    [Fact]
    public async Task GetSidebar_HallOwner_ReturnsMyHallsSectionAfterProfile()
    {
        var user = await CreateOwnerAsync("owner3@example.com", "+970599333333");
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        var result = await service.GetSidebarAsync();

        var profile = result.Sections.First();
        var halls = Assert.Single(result.Sections, s => s.Key == OwnerSidebarSections.MyHalls);
        Assert.Equal("My Halls", halls.Label);
        Assert.Equal(1, halls.Order);
        Assert.False(halls.IsDefault);
        Assert.True(profile.Order < halls.Order);
    }

    [Fact]
    public async Task GetSidebar_HallOwner_CountsOnlyOwnHalls()
    {
        var owner = await CreateOwnerAsync("owner4@example.com", "+970599444444");
        var other = await CreateOwnerAsync("other@example.com", "+970599555555");
        AddHall(owner.Id);
        AddHall(owner.Id);
        AddHall(other.Id);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetSidebarAsync();

        var halls = result.Sections.Single(s => s.Key == OwnerSidebarSections.MyHalls);
        Assert.Equal(2, halls.BadgeCount);
    }

    [Fact]
    public async Task GetSidebar_HallOwner_CountExcludesDeletedHalls()
    {
        var owner = await CreateOwnerAsync("owner5@example.com", "+970599666666");
        AddHall(owner.Id);
        AddHall(owner.Id, isDeleted: true);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetSidebarAsync();

        var halls = result.Sections.Single(s => s.Key == OwnerSidebarSections.MyHalls);
        Assert.Equal(1, halls.BadgeCount);
    }

    [Fact]
    public async Task GetSidebar_HallOwnerWithoutHalls_ReturnsZeroBadgeCount()
    {
        var user = await CreateOwnerAsync("owner6@example.com", "+970599777777");
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        var result = await service.GetSidebarAsync();

        var halls = result.Sections.Single(s => s.Key == OwnerSidebarSections.MyHalls);
        Assert.Equal(0, halls.BadgeCount);
    }

    [Fact]
    public async Task GetSidebar_Unauthenticated_ThrowsUnauthorized()
    {
        var service = CreateService(new FakeCurrentUser(null, false));

        await Assert.ThrowsAsync<UnauthorizedException>(() => service.GetSidebarAsync());
    }

    [Fact]
    public async Task GetSidebar_MissingUserAccount_ThrowsNotFound()
    {
        var service = CreateService(new FakeCurrentUser("not-a-real-id", true));

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetSidebarAsync());
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }
}