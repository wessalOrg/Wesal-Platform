using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
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

public class OwnerHallServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    private static readonly decimal UpdatedPrice = 1750m;

    public OwnerHallServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
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

    private Hall AddHall(
        string ownerId,
        string name,
        HallStatus status = HallStatus.Approved,
        bool isDeleted = false,
        bool withDetails = false)
    {
        var hall = new Hall
        {
            Name = name,
            Address = "Al-Rashid Street, Gaza",
            Region = HallRegion.Gaza,
            Capacity = 200,
            Price = 1500,
            ShowPrice = true,
            ContactPhone = "+970599111111",
            Description = "Spacious hall",
            MainImageUrl = "https://cdn.example.com/main.jpg",
            OwnerId = ownerId,
            Status = status,
            PaymentStatus = HallPaymentStatus.Paid,
            IsDeleted = isDeleted
        };

        if (withDetails)
        {
            hall.Images.Add(new HallImage { HallId = hall.Id, Url = "https://cdn.example.com/old-1.jpg", DisplayOrder = 0 });
            hall.Images.Add(new HallImage { HallId = hall.Id, Url = "https://cdn.example.com/old-2.jpg", DisplayOrder = 1 });
            hall.BookingPeriods.Add(new HallBookingPeriod
            {
                HallId = hall.Id,
                Type = BookingPeriodType.FirstPeriod,
                StartTime = new TimeOnly(9, 0),
                EndTime = new TimeOnly(15, 0)
            });
            hall.BookingPeriods.Add(new HallBookingPeriod
            {
                HallId = hall.Id,
                Type = BookingPeriodType.SecondPeriod,
                StartTime = new TimeOnly(16, 0),
                EndTime = new TimeOnly(23, 0)
            });
        }

        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private OwnerHallService CreateService(FakeCurrentUser currentUser)
        => new(
            _userManager,
            currentUser,
            new OwnerDashboardRepository(_context),
            new UnitOfWork(_context));

    private static UpdateOwnerHallRequest CreateUpdateRequest() => new()
    {
        Name = "Grand Hall Updated",
        Address = "Omar Al-Mukhtar Street, Gaza",
        Region = HallRegion.SouthGaza,
        Capacity = 250,
        Price = UpdatedPrice,
        ShowPrice = false,
        ContactPhone = "+970599222222",
        Description = "Renovated hall",
        Photos =
        [
            new UpdateOwnerHallPhotoDto { Url = "https://cdn.example.com/new-1.jpg", DisplayOrder = 0 },
            new UpdateOwnerHallPhotoDto { Url = "https://cdn.example.com/new-2.jpg", DisplayOrder = 1 }
        ],
        BookingPeriods =
        [
            new UpdateOwnerHallBookingPeriodDto { Type = BookingPeriodType.FirstPeriod, StartTime = new TimeOnly(8, 0), EndTime = new TimeOnly(14, 0) },
            new UpdateOwnerHallBookingPeriodDto { Type = BookingPeriodType.SecondPeriod, StartTime = new TimeOnly(15, 0), EndTime = new TimeOnly(22, 0) }
        ]
    };

    private async Task<OwnerHallDetailsDto> GetDetailsAsync(Guid hallId, FakeCurrentUser currentUser)
        => await CreateService(currentUser).GetOwnedHallDetailsAsync(hallId);

    [Fact]
    public async Task GetOwnedHallDetails_ReturnsFullDetails()
    {
        var owner = await CreateOwnerAsync("owner1@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", withDetails: true);

        var details = await GetDetailsAsync(hall.Id, new FakeCurrentUser(owner.Id, true));

        Assert.Equal(hall.Id, details.HallId);
        Assert.Equal("Grand Hall", details.HallName);
        Assert.Equal("+970599111111", details.ContactPhone);
        Assert.Equal(HallRegion.Gaza, details.Region);
        Assert.Equal("Gaza", details.RegionDisplayName);
        Assert.Equal("Al-Rashid Street, Gaza", details.Address);
        Assert.Equal("Spacious hall", details.Description);
        Assert.Equal(200, details.Capacity);
        Assert.Equal(1500m, details.Price);
        Assert.True(details.ShowPrice);
        Assert.Equal(HallStatus.Approved, details.Status);
        Assert.True(details.IsEditable);
        Assert.Contains(details.Photos, photo => photo.Url == "https://cdn.example.com/old-1.jpg");
        Assert.Contains(details.Photos, photo => photo.Url == "https://cdn.example.com/old-2.jpg");
        Assert.Equal(2, details.BookingPeriods.Count);
        Assert.Contains(details.BookingPeriods, period => period.Type == BookingPeriodType.FirstPeriod);
        Assert.Contains(details.BookingPeriods, period => period.Type == BookingPeriodType.SecondPeriod);
    }

    [Fact]
    public async Task GetOwnedHallDetails_AnotherOwnersHall_ThrowsNotFound()
    {
        var owner = await CreateOwnerAsync("owner2@example.com", "+970599100002");
        var other = await CreateOwnerAsync("other@example.com", "+970599100003");
        var hall = AddHall(other.Id, "Other's Hall", withDetails: true);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            GetDetailsAsync(hall.Id, new FakeCurrentUser(owner.Id, true)));
    }

    [Fact]
    public async Task GetOwnedHallDetails_DeletedHall_ThrowsNotFound()
    {
        var owner = await CreateOwnerAsync("owner3@example.com", "+970599100004");
        var hall = AddHall(owner.Id, "Deleted Hall", isDeleted: true);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            GetDetailsAsync(hall.Id, new FakeCurrentUser(owner.Id, true)));
    }

    [Fact]
    public async Task GetOwnedHallDetails_Unauthenticated_ThrowsUnauthorized()
    {
        var service = CreateService(new FakeCurrentUser(null, false));

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.GetOwnedHallDetailsAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetOwnedHallDetails_MissingUserAccount_ThrowsNotFound()
    {
        var service = CreateService(new FakeCurrentUser("not-a-real-id", true));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.GetOwnedHallDetailsAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetOwnedHallDetails_UnderReviewHall_IsReportedAsNotEditable()
    {
        var owner = await CreateOwnerAsync("owner4@example.com", "+970599100005");
        var hall = AddHall(owner.Id, "Pending Hall", HallStatus.PendingReview, withDetails: true);

        var details = await GetDetailsAsync(hall.Id, new FakeCurrentUser(owner.Id, true));

        Assert.Equal(HallStatus.PendingReview, details.Status);
        Assert.False(details.IsEditable);
    }

    [Fact]
    public async Task UpdateOwnedHall_AppliesAllEditableFields_AndPreservesStatusAndOwner()
    {
        var owner = await CreateOwnerAsync("owner5@example.com", "+970599100006");
        var hall = AddHall(owner.Id, "Grand Hall", withDetails: true);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var details = await service.UpdateOwnedHallAsync(hall.Id, CreateUpdateRequest());

        Assert.Equal("Grand Hall Updated", details.HallName);
        Assert.Equal("+970599222222", details.ContactPhone);
        Assert.Equal(HallRegion.SouthGaza, details.Region);
        Assert.Equal("Omar Al-Mukhtar Street, Gaza", details.Address);
        Assert.Equal("Renovated hall", details.Description);
        Assert.Equal(250, details.Capacity);
        Assert.Equal(UpdatedPrice, details.Price);
        Assert.False(details.ShowPrice);
        Assert.Equal(HallStatus.Approved, details.Status);
        Assert.True(details.IsEditable);
    }

    [Fact]
    public async Task UpdateOwnedHall_ReplacesPhotos_SoftDeletingThePreviousSet()
    {
        var owner = await CreateOwnerAsync("owner6@example.com", "+970599100007");
        var hall = AddHall(owner.Id, "Grand Hall", withDetails: true);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var details = await service.UpdateOwnedHallAsync(hall.Id, CreateUpdateRequest());

        Assert.Equal(2, details.Photos.Count);
        Assert.Contains(details.Photos, photo => photo.Url == "https://cdn.example.com/new-1.jpg" && photo.DisplayOrder == 0);
        Assert.Contains(details.Photos, photo => photo.Url == "https://cdn.example.com/new-2.jpg" && photo.DisplayOrder == 1);
        Assert.DoesNotContain(details.Photos, photo => photo.Url == "https://cdn.example.com/old-1.jpg");

        var persistedOld = _context.HallImages.AsNoTracking().Single(image => image.Url == "https://cdn.example.com/old-1.jpg");
        Assert.True(persistedOld.IsDeleted);
    }

    [Fact]
    public async Task UpdateOwnedHall_UpdatesBothBookingPeriods()
    {
        var owner = await CreateOwnerAsync("owner7@example.com", "+970599100008");
        var hall = AddHall(owner.Id, "Grand Hall", withDetails: true);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var details = await service.UpdateOwnedHallAsync(hall.Id, CreateUpdateRequest());

        var first = Assert.Single(details.BookingPeriods, period => period.Type == BookingPeriodType.FirstPeriod);
        Assert.Equal(new TimeOnly(8, 0), first.StartTime);
        Assert.Equal(new TimeOnly(14, 0), first.EndTime);

        var second = Assert.Single(details.BookingPeriods, period => period.Type == BookingPeriodType.SecondPeriod);
        Assert.Equal(new TimeOnly(15, 0), second.StartTime);
        Assert.Equal(new TimeOnly(22, 0), second.EndTime);

        Assert.Equal(2, _context.HallBookingPeriods.Count());
    }

    [Fact]
    public async Task UpdateOwnedHall_AddsMissingBookingPeriod()
    {
        var owner = await CreateOwnerAsync("owner8@example.com", "+970599100009");
        var hall = AddHall(owner.Id, "Grand Hall", withDetails: true);
        hall.BookingPeriods.Remove(hall.BookingPeriods.Single(period => period.Type == BookingPeriodType.SecondPeriod));
        _context.SaveChanges();
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var details = await service.UpdateOwnedHallAsync(hall.Id, CreateUpdateRequest());

        Assert.Equal(2, details.BookingPeriods.Count);
        Assert.Contains(details.BookingPeriods, period => period.Type == BookingPeriodType.SecondPeriod);
    }

    [Fact]
    public async Task UpdateOwnedHall_UnderReview_ThrowsBusinessRule_AndPersistsNothing()
    {
        var owner = await CreateOwnerAsync("owner9@example.com", "+970599100010");
        var hall = AddHall(owner.Id, "Pending Hall", HallStatus.PendingReview, withDetails: true);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var exception = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            service.UpdateOwnedHallAsync(hall.Id, CreateUpdateRequest()));

        Assert.Equal("HallNotEditable", exception.Code);

        var untouched = _context.Halls.AsNoTracking().Single(item => item.Id == hall.Id);
        Assert.Equal("Pending Hall", untouched.Name);
        Assert.Equal(HallStatus.PendingReview, untouched.Status);
    }

    [Fact]
    public async Task UpdateOwnedHall_AnotherOwnersHall_ThrowsNotFound_AndPersistsNothing()
    {
        var owner = await CreateOwnerAsync("owner10@example.com", "+970599100011");
        var other = await CreateOwnerAsync("owner11@example.com", "+970599100012");
        var hall = AddHall(other.Id, "Other's Hall", withDetails: true);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.UpdateOwnedHallAsync(hall.Id, CreateUpdateRequest()));

        var untouched = _context.Halls.AsNoTracking().Single(item => item.Id == hall.Id);
        Assert.Equal("Other's Hall", untouched.Name);
        Assert.Equal(other.Id, untouched.OwnerId);
    }

    [Fact]
    public async Task UpdateOwnedHall_Unauthenticated_ThrowsUnauthorized()
    {
        var service = CreateService(new FakeCurrentUser(null, false));

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.UpdateOwnedHallAsync(Guid.NewGuid(), CreateUpdateRequest()));
    }

    [Fact]
    public async Task UpdateOwnedHall_ResolvesOwnerOnlyFromSession()
    {
        // The update API must never accept a client-supplied owner identity or status:
        // ownership is resolved exclusively from the authenticated session, which
        // prevents one owner from editing another owner's hall.
        var updateMethod = typeof(IOwnerHallService).GetMethod(nameof(IOwnerHallService.UpdateOwnedHallAsync));
        Assert.NotNull(updateMethod);

        var parameters = updateMethod!.GetParameters();
        Assert.Equal(3, parameters.Length);
        Assert.Equal(typeof(Guid), parameters[0].ParameterType);
        Assert.Equal(typeof(UpdateOwnerHallRequest), parameters[1].ParameterType);
        Assert.Equal(typeof(CancellationToken), parameters[2].ParameterType);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

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
}