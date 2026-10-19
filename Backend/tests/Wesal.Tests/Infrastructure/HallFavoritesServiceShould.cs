using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Favorites;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// The seeker's saved halls ("المفضلة"). The contract is that ownership is resolved only from
/// the authenticated session (so a caller never touches another user's favorites), the
/// operations are idempotent, and a missing hall is a 404 rather than a silent write.
/// Exercised against the real repositories on an in-memory database.
/// </summary>
public class HallFavoritesServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public HallFavoritesServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
        services.AddIdentityCore<ApplicationUser>(o =>
        {
            o.Password.RequireDigit = true;
            o.Password.RequireNonAlphanumeric = true;
            o.Password.RequiredLength = 8;
            o.User.RequireUniqueEmail = true;
        }).AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
        services.AddLogging();
        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
        var roleManager = _provider.GetRequiredService<RoleManager<ApplicationRole>>();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.RegisteredUser)).GetAwaiter().GetResult();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.HallOwner)).GetAwaiter().GetResult();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
    }

    [Fact]
    public async Task List_Guest_ThrowsUnauthorized()
    {
        var service = CreateService(new FakeCurrentUser(null, false));

        var exception = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.ListFavoriteHallIdsAsync());

        Assert.Contains("logged in", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Add_Guest_ThrowsUnauthorized()
    {
        var service = CreateService(new FakeCurrentUser(null, false));

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.AddAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task List_NoFavorites_ReturnsEmpty()
    {
        var user = await CreateUserAsync("empty@example.com", "+970599400001");
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        Assert.Empty(await service.ListFavoriteHallIdsAsync());
    }

    [Fact]
    public async Task Add_UnknownHall_ThrowsNotFound()
    {
        var user = await CreateUserAsync("seeker@example.com", "+970599400002");
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        await Assert.ThrowsAsync<NotFoundException>(() => service.AddAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task Add_DeletedHall_ThrowsNotFound()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599400003", ApplicationRoles.HallOwner);
        var user = await CreateUserAsync("seeker@example.com", "+970599400004");
        var hall = AddHall(owner.Id, "Deleted Hall", isDeleted: true);
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        await Assert.ThrowsAsync<NotFoundException>(() => service.AddAsync(hall.Id));
    }

    [Fact]
    public async Task Add_ThenList_ReturnsTheSavedHall()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599400005", ApplicationRoles.HallOwner);
        var user = await CreateUserAsync("seeker@example.com", "+970599400006");
        var hall = AddHall(owner.Id, "Grand Hall");
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        await service.AddAsync(hall.Id);

        Assert.Equal([hall.Id], await service.ListFavoriteHallIdsAsync());
    }

    [Fact]
    public async Task Add_Twice_IsIdempotent()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599400007", ApplicationRoles.HallOwner);
        var user = await CreateUserAsync("seeker@example.com", "+970599400008");
        var hall = AddHall(owner.Id, "Grand Hall");
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        await service.AddAsync(hall.Id);
        await service.AddAsync(hall.Id);

        Assert.Equal([hall.Id], await service.ListFavoriteHallIdsAsync());
        Assert.Equal(1, _context.HallFavorites.Count());
    }

    [Fact]
    public async Task Remove_DeletesTheFavoriteAndIsIdempotent()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599400009", ApplicationRoles.HallOwner);
        var user = await CreateUserAsync("seeker@example.com", "+970599400010");
        var hall = AddHall(owner.Id, "Grand Hall");
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        await service.AddAsync(hall.Id);
        await service.RemoveAsync(hall.Id);
        await service.RemoveAsync(hall.Id);

        Assert.Empty(await service.ListFavoriteHallIdsAsync());
    }

    [Fact]
    public async Task List_ReturnsOnlyTheCallersFavorites()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599400011", ApplicationRoles.HallOwner);
        var me = await CreateUserAsync("me@example.com", "+970599400012");
        var other = await CreateUserAsync("other@example.com", "+970599400013");
        var hall = AddHall(owner.Id, "Grand Hall");
        await CreateService(new FakeCurrentUser(me.Id, true)).AddAsync(hall.Id);
        await CreateService(new FakeCurrentUser(other.Id, true)).AddAsync(hall.Id);

        var mine = await CreateService(new FakeCurrentUser(me.Id, true)).ListFavoriteHallIdsAsync();

        Assert.Equal([hall.Id], mine);
        Assert.Equal(2, _context.HallFavorites.Count());
    }

    [Fact]
    public async Task List_ReturnsNewestSavedFirst()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599400014", ApplicationRoles.HallOwner);
        var user = await CreateUserAsync("seeker@example.com", "+970599400015");
        var first = AddHall(owner.Id, "First Hall");
        var second = AddHall(owner.Id, "Second Hall");
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        await service.AddAsync(first.Id);
        await service.AddAsync(second.Id);

        Assert.Equal([second.Id, first.Id], await service.ListFavoriteHallIdsAsync());
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    private HallFavoritesService CreateService(FakeCurrentUser currentUser)
        => new(new HallFavoriteRepository(_context), new HallRepository(_context), currentUser, TimeProvider.System);

    private async Task<ApplicationUser> CreateUserAsync(
        string email,
        string phone,
        string role = ApplicationRoles.RegisteredUser)
    {
        var user = new ApplicationUser { FullName = "Regular User", Email = email, UserName = email, PhoneNumber = phone };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, role);
        return user;
    }

    private Hall AddHall(string ownerId, string name, bool isDeleted = false)
    {
        var hall = new Hall
        {
            Name = name,
            Address = "Al-Rashid Street, Gaza",
            Region = HallRegion.Gaza,
            Capacity = 200,
            Price = 1500,
            ShowPrice = true,
            OwnerId = ownerId,
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            IsDeleted = isDeleted
        };

        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(string? userId, bool auth)
        {
            UserId = userId;
            IsAuthenticated = auth;
            Roles = userId is null ? [] : [ApplicationRoles.RegisteredUser];
        }

        public string? UserId { get; }

        public string? UserName => "test";

        public string? Email => "test@example.com";

        public bool IsAuthenticated { get; }

        public IReadOnlyList<string> Roles { get; }
    }
}
