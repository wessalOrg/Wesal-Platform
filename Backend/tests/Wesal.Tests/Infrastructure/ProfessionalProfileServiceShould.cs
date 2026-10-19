using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Documents;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Profile;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public sealed class ProfessionalProfileServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _users;
    private readonly MemoryDocumentStore _documents = new();
    private readonly RestrictionState _restriction = new();

    public ProfessionalProfileServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddIdentityCore<ApplicationUser>().AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
        services.AddLogging();
        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
        _users = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        var roles = _provider.GetRequiredService<RoleManager<ApplicationRole>>();
        roles.CreateAsync(new ApplicationRole(ApplicationRoles.EventCoordinator)).GetAwaiter().GetResult();
        roles.CreateAsync(new ApplicationRole(ApplicationRoles.Photographer)).GetAwaiter().GetResult();
    }

    private ProfessionalProfileService CreateService(ApplicationUser? current = null, bool authenticated = true)
        => new(_users, new CurrentUser(current?.Id, authenticated), new CoordinatorRepository(_context),
            new PhotographerRepository(_context), _restriction, _documents, new UnitOfWork(_context),
            new EmptyPostService(), new EmptyOfferService());

    private ProfessionalProfileService CreateServiceWithContent(ApplicationUser owner,
        IReadOnlyList<PublicProfileContentDto> posts, IReadOnlyList<PublicProfileContentDto> offers)
        => new(_users, new CurrentUser(owner.Id, false), new CoordinatorRepository(_context),
            new PhotographerRepository(_context), _restriction, _documents, new UnitOfWork(_context),
            new EmptyPostService(posts), new EmptyOfferService(offers));

    private sealed class EmptyPostService : IPostService
    {
        private readonly IReadOnlyList<PublicProfileContentDto> _items;
        public EmptyPostService(IReadOnlyList<PublicProfileContentDto>? items = null) => _items = items ?? [];
        public Task<Guid> CreateAsync(CreatePostRequest request, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task UpdateAsync(Guid postId, UpdatePostRequest request, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<PagedResult<PublicProfileContentDto>> ListProfileAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default)
            => Task.FromResult(PagedResult<PublicProfileContentDto>.Create(_items, page, pageSize, _items.Count));
        public Task<PublicProfileContentDto> GetPublicAsync(Guid postId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<StoredDocument> GetImageAsync(Guid postId, Guid imageId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
    }

    private sealed class EmptyOfferService : IProfessionalOfferService
    {
        private readonly IReadOnlyList<PublicProfileContentDto> _items;
        public EmptyOfferService(IReadOnlyList<PublicProfileContentDto>? items = null) => _items = items ?? [];
        public Task<Guid> CreateAsync(CreateProfessionalOfferRequest request, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task UpdateAsync(Guid offerId, UpdateProfessionalOfferRequest request, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task StopAsync(Guid offerId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<PublicProfileContentDto> GetAsync(Guid offerId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<PagedResult<PublicProfileContentDto>> ListOwnAsync(int page, int pageSize, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<PagedResult<PublicProfileContentDto>> ListProfileAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default)
            => Task.FromResult(PagedResult<PublicProfileContentDto>.Create(_items, page, pageSize, _items.Count));
        public Task<StoredDocument> GetImageAsync(Guid offerId, Guid imageId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
    }

    private async Task<ApplicationUser> CreatePhotographerAsync(AccountApprovalStatus status, bool hasStudio = false)
    {
        var user = new ApplicationUser { FullName = "Registration Name", Email = $"{Guid.NewGuid():N}@example.com", UserName = $"{Guid.NewGuid():N}@example.com", ApprovalStatus = status };
        Assert.True((await _users.CreateAsync(user, "Password123!")).Succeeded);
        await _users.AddToRoleAsync(user, ApplicationRoles.Photographer);
        await _context.PhotographerProfiles.AddAsync(new PhotographerProfile
        {
            Id = Guid.NewGuid(), UserId = user.Id, HasStudio = hasStudio,
            StudioName = hasStudio ? "Noor Studio" : null,
            StudioLocation = hasStudio ? "Gaza" : null,
            DetailedStudioLocation = hasStudio ? "Rimal, Gaza" : null,
            FullName = hasStudio ? null : "Admin Only Name",
            PhoneNumber = "+970599111111", IdentityDocumentUrl = "/documents/photographers/private/id.pdf",
            Bio = "Public bio", SubmittedAt = DateTimeOffset.UtcNow
        });
        await _context.SaveChangesAsync();
        return user;
    }

    [Fact]
    public async Task HideNonApprovedProfilesFromEveryoneButReturnOwnerStatus()
    {
        var pending = await CreatePhotographerAsync(AccountApprovalStatus.NeedsChanges);

        var own = await CreateService(pending).GetPublicProfileAsync(pending.Id);
        Assert.False(own.IsPubliclyAvailable);
        Assert.Equal(nameof(AccountApprovalStatus.NeedsChanges), own.ApprovalStatus);
        Assert.Empty(own.Posts);
        await Assert.ThrowsAsync<NotFoundException>(() => CreateService().GetPublicProfileAsync(pending.Id));
    }

    [Fact]
    public async Task ReturnApprovedPublicProfileWithoutAdminOnlyFields()
    {
        var photographer = await CreatePhotographerAsync(AccountApprovalStatus.Approved);

        var profile = await CreateService().GetPublicProfileAsync(photographer.Id);
        var json = System.Text.Json.JsonSerializer.Serialize(profile);

        Assert.True(profile.IsPubliclyAvailable);
        Assert.Null(profile.PhoneNumber);
        Assert.Empty(profile.Posts);
        Assert.Empty(profile.Offers);
        Assert.DoesNotContain("Admin Only Name", json);
        Assert.DoesNotContain("identity-document", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("private/id.pdf", json);
    }

    [Fact]
    public async Task PopulateThePublicProfilePostsAndOffersSections()
    {
        var coordinator = await CreateCoordinatorAsync();
        var post = new PublicProfileContentDto { Id = Guid.NewGuid(), Content = "Public post" };
        var offer = new PublicProfileContentDto { Id = Guid.NewGuid(), Content = "Active offer", OfferPrice = 50 };

        var profile = await CreateServiceWithContent(coordinator, [post], [offer]).GetPublicProfileAsync(coordinator.Id);

        Assert.Equal(post.Id, Assert.Single(profile.Posts).Id);
        Assert.Equal(offer.Id, Assert.Single(profile.Offers).Id);
    }

    [Fact]
    public async Task TrimAndSanitizeBioAndRejectExcessiveLength()
    {
        var coordinator = await CreateCoordinatorAsync();
        var service = CreateService(coordinator);
        await service.UpdateBioAsync(new UpdatePublicBioRequest { Bio = "  <b>Nice</b>\n work  " });
        var profile = await _context.CoordinatorProfiles.SingleAsync(p => p.UserId == coordinator.Id);
        Assert.Equal("Nice work", profile.Bio);

        await Assert.ThrowsAsync<ValidationException>(() => service.UpdateBioAsync(new UpdatePublicBioRequest { Bio = new string('x', 301) }));
    }

    [Fact]
    public async Task RequireApprovalForBioEdit()
    {
        var coordinator = await CreateCoordinatorAsync(AccountApprovalStatus.Pending);
        _restriction.IsRestricted = false;
        await Assert.ThrowsAsync<ForbiddenException>(() => CreateService(coordinator).UpdateBioAsync(new UpdatePublicBioRequest { Bio = "Hello" }));
    }

    [Fact]
    public async Task BlockBioEditWhileRestricted()
    {
        var coordinator = await CreateCoordinatorAsync();
        _restriction.IsRestricted = true;
        await Assert.ThrowsAsync<ForbiddenException>(() => CreateService(coordinator).UpdateBioAsync(new UpdatePublicBioRequest { Bio = "Hello" }));
    }

    [Fact]
    public async Task BlockProfilePictureUploadWhileUnapprovedOrRestricted()
    {
        var photographer = await CreatePhotographerAsync(AccountApprovalStatus.Pending);
        var upload = new OwnerDocumentUpload { FileName = "../../bad.png", ContentType = "image/png", Content = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] };
        await Assert.ThrowsAsync<ForbiddenException>(() => CreateService(photographer).UploadProfilePictureAsync(upload));

        photographer = await _users.FindByIdAsync(photographer.Id) ?? throw new InvalidOperationException();
        photographer.ApprovalStatus = AccountApprovalStatus.Approved;
        await _users.UpdateAsync(photographer);
        _restriction.IsRestricted = true;
        await Assert.ThrowsAsync<ForbiddenException>(() => CreateService(photographer).UploadProfilePictureAsync(upload));
        Assert.Empty(_documents.Files);
    }

    [Fact]
    public async Task StoreAndServeApprovedProfilePictureUsingGeneratedStorageKey()
    {
        var coordinator = await CreateCoordinatorAsync();
        var upload = new OwnerDocumentUpload
        {
            FileName = "../../unsafe.png",
            ContentType = "image/png",
            Content = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x01]
        };

        var service = CreateService(coordinator);
        var url = await service.UploadProfilePictureAsync(upload);
        var persisted = await _users.FindByIdAsync(coordinator.Id);
        var picture = await service.GetProfilePictureAsync(coordinator.Id);

        Assert.Equal($"/api/v1/profile/{coordinator.Id}/picture", url);
        Assert.Equal(url, persisted!.ProfilePictureUrl);
        Assert.DoesNotContain("unsafe", persisted.ProfilePictureStorageKey);
        Assert.Equal("image/png", picture.ContentType);
        Assert.Equal(upload.Content, picture.Content);
    }

    private async Task<ApplicationUser> CreateCoordinatorAsync(AccountApprovalStatus status = AccountApprovalStatus.Approved)
    {
        var user = new ApplicationUser { FullName = "Coordinator", Email = $"{Guid.NewGuid():N}@example.com", UserName = $"{Guid.NewGuid():N}@example.com", ApprovalStatus = status };
        Assert.True((await _users.CreateAsync(user, "Password123!")).Succeeded);
        await _users.AddToRoleAsync(user, ApplicationRoles.EventCoordinator);
        await _context.CoordinatorProfiles.AddAsync(new CoordinatorProfile
        {
            Id = Guid.NewGuid(), UserId = user.Id, BusinessType = CoordinatorBusinessType.Shop,
            ShopName = "Wesal Gifts", ShopLocation = "Gaza", PhoneNumber = "+970599111111",
            IdentityDocumentUrl = "/documents/coordinators/private/id.pdf", Bio = "Original"
        });
        await _context.SaveChangesAsync();
        return user;
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    private sealed class CurrentUser(string? userId, bool authenticated) : ICurrentUserService
    {
        public string? UserId => userId;
        public string? UserName => null;
        public string? Email => null;
        public bool IsAuthenticated => authenticated;
        public IReadOnlyList<string> Roles => [];
    }

    private sealed class RestrictionState : IUserContentPublishingRestrictionService
    {
        public bool IsRestricted { get; set; }
        public Task<bool> IsRestrictedAsync(string userId, CancellationToken cancellationToken = default) => Task.FromResult(IsRestricted);
    }

    private sealed class MemoryDocumentStore : IIdentityDocumentStore
    {
        public Dictionary<string, byte[]> Files { get; } = [];
        public Task SaveAsync(string relativeUrl, byte[] content, CancellationToken cancellationToken = default) { Files[relativeUrl] = content; return Task.CompletedTask; }
        public Task<StoredDocumentContent?> ReadAsync(string relativeUrl, CancellationToken cancellationToken = default)
            => Task.FromResult(Files.TryGetValue(relativeUrl, out var bytes) ? new StoredDocumentContent { Bytes = bytes } : null);
        public Task DeleteAsync(string relativeUrl, CancellationToken cancellationToken = default) { Files.Remove(relativeUrl); return Task.CompletedTask; }
    }
}
