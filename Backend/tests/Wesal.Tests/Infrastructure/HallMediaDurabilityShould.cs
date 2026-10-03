using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Halls;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Durable-media service contract (Phase 20): services persist exactly the URLs
/// the storage provider returns (legacy relative or absolute R2), never rewrite
/// untouched references, compensate only newly uploaded objects on DB failure,
/// and never physically delete history on soft delete.
/// </summary>
public sealed class HallMediaDurabilityShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public HallMediaDurabilityShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
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
        _provider.GetRequiredService<RoleManager<ApplicationRole>>()
            .CreateAsync(new ApplicationRole(ApplicationRoles.HallOwner)).GetAwaiter().GetResult();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
    }

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(string? userId) => UserId = userId;
        public string? UserId { get; }
        public string? UserName => "test";
        public string? Email => "test@example.com";
        public bool IsAuthenticated => UserId is not null;
        public IReadOnlyList<string> Roles => [ApplicationRoles.HallOwner];
    }

    private sealed class RecordingHallMediaStorage : IHallMediaStorage
    {
        public readonly List<StoredHallMedia> Saved = [];
        public readonly List<StoredHallMedia> Deleted = [];
        public Func<StoredHallMedia, Exception?>? DeleteFailure;
        public HallMediaStorageInfo Info => new(false, null);

        public Task<StoredHallMedia> SaveAsync(Guid hallId, HallPhotoUpload upload, CancellationToken cancellationToken = default)
        {
            var key = $"halls/{hallId:D}/{Guid.NewGuid():N}.jpg";
            var stored = new StoredHallMedia($"https://media.test/{key}", key);
            Saved.Add(stored);
            return Task.FromResult(stored);
        }

        public Task DeleteAsync(StoredHallMedia media, CancellationToken cancellationToken = default)
        {
            Deleted.Add(media);
            var failure = DeleteFailure?.Invoke(media);
            return failure is null ? Task.CompletedTask : Task.FromException(failure);
        }
    }

    private sealed class FailingUnitOfWork : IUnitOfWork
    {
        private readonly ApplicationDbContext _context;
        public FailingUnitOfWork(ApplicationDbContext context) => _context = context;

        public Task ExecuteInTransactionAsync(Func<Task> operation, CancellationToken cancellationToken = default)
            => ExecuteInTransactionAsync<byte>(async () => { await operation(); return 0; }, cancellationToken);

        public async Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> operation, CancellationToken cancellationToken = default)
        {
            var result = await operation();
            throw new InvalidOperationException("simulated database failure after upload");
        }

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
            => _context.SaveChangesAsync(cancellationToken);
    }

    private static HallPhotoUpload JpegUpload(string fileName = "photo.jpg") => new()
    {
        FileName = fileName,
        ContentType = "image/jpeg",
        Content = [0xFF, 0xD8, 0xFF, 0xE0]
    };

    private async Task<ApplicationUser> CreateOwnerAsync(string id)
    {
        var user = new ApplicationUser
        {
            Id = id,
            FullName = "Owner",
            Email = $"{id}@example.com",
            UserName = $"{id}@example.com",
            PhoneNumber = "+970599" + Math.Abs(id.GetHashCode() % 900000 + 100000),
            IdentityDocumentUrl = $"/documents/owners/{id}/id.jpg"
        };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, ApplicationRoles.HallOwner);
        return user;
    }

    private static CreateHallRequest ValidCreateRequest(HallPhotoUpload? mainPhoto = null, IReadOnlyList<HallPhotoUpload>? photos = null) => new()
    {
        Name = "Test Hall",
        ContactPhone = "+972599123456",
        Region = "Gaza",
        Address = "حي الشجاعية",
        Description = "Nice hall",
        Capacity = 300,
        Price = 1000,
        HourlySlotStart = new TimeOnly(8, 0),
        HourlySlotEnd = new TimeOnly(22, 0),
        MainPhoto = mainPhoto,
        Photos = photos
    };

    private HallCreationService CreateCreationService(
        string ownerId,
        IHallMediaStorage storage,
        IUnitOfWork? unitOfWork = null)
        => new(
            new FakeCurrentUser(ownerId),
            new HallRepository(_context),
            unitOfWork ?? new UnitOfWork(_context),
            storage,
            _userManager,
            new RecordingNotificationDispatcher(),
            NullLogger<HallCreationService>.Instance);

    private OwnerHallService CreateOwnerService(
        string ownerId,
        IHallMediaStorage storage,
        IUnitOfWork? unitOfWork = null)
        => new(
            _userManager,
            new FakeCurrentUser(ownerId),
            new OwnerDashboardRepository(_context),
            new BookingRepository(_context),
            storage,
            unitOfWork ?? new UnitOfWork(_context),
            NullLogger<OwnerHallService>.Instance);

    private Hall AddHall(string ownerId, string? coverUrl, params string[] galleryUrls)
    {
        var hall = new Hall
        {
            Name = "Grand Hall",
            Address = "حي الرمال",
            Region = HallRegion.Gaza,
            Capacity = 200,
            Price = 1500,
            ShowPrice = true,
            ContactPhone = "+970599111111",
            Description = "Spacious hall",
            OwnerId = ownerId,
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            IsDeleted = false,
            MainImageUrl = coverUrl
        };
        var order = 0;
        foreach (var url in galleryUrls)
        {
            hall.Images.Add(new HallImage { HallId = hall.Id, Url = url, DisplayOrder = order++ });
        }

        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    [Fact]
    public async Task Create_PersistsStorageUrls_CoverWins_OrderPreserved()
    {
        var owner = await CreateOwnerAsync("owner-1");
        var storage = new RecordingHallMediaStorage();
        var service = CreateCreationService(owner.Id, storage);

        var result = await service.CreateHallAsync(ValidCreateRequest(
            mainPhoto: JpegUpload("cover.jpg"),
            photos: [JpegUpload("a.jpg"), JpegUpload("b.jpg")]));

        Assert.Equal(3, storage.Saved.Count);
        Assert.All(result.Images, image => Assert.StartsWith("https://media.test/", image.Url, StringComparison.Ordinal));
        Assert.Equal(0, result.Images[0].DisplayOrder);
        Assert.Equal(1, result.Images[1].DisplayOrder);
        var cover = storage.Saved[2];
        Assert.Equal(cover.PublicUrl, result.MainImageUrl);
        var persisted = await _context.Halls.Include(h => h.Images).SingleAsync(h => h.Id == result.HallId);
        Assert.Equal(cover.PublicUrl, persisted.MainImageUrl);
        Assert.Equal(2, persisted.Images.Count);
    }

    [Fact]
    public async Task Create_DbFailureAfterUpload_DeletesOnlyNewObjects()
    {
        var owner = await CreateOwnerAsync("owner-2");
        var storage = new RecordingHallMediaStorage();
        var preExisting = new StoredHallMedia("https://media.test/halls/other/old.jpg", "halls/other/old.jpg");
        var service = CreateCreationService(owner.Id, storage, new FailingUnitOfWork(_context));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CreateHallAsync(ValidCreateRequest(photos: [JpegUpload()])));

        Assert.Equal("simulated database failure after upload", ex.Message);
        Assert.Single(storage.Saved);
        Assert.Equal(storage.Saved, storage.Deleted);
        Assert.DoesNotContain(preExisting, storage.Deleted);
        // Row rollback itself is the unit of work's job (covered by its own tests);
        // the storage contract proven here is: only this request's objects are compensated.
    }

    [Fact]
    public async Task Create_CleanupFailure_DoesNotMaskOriginalException()
    {
        var owner = await CreateOwnerAsync("owner-3");
        var storage = new RecordingHallMediaStorage
        {
            DeleteFailure = _ => new IOException("r2 unavailable")
        };
        var service = CreateCreationService(owner.Id, storage, new FailingUnitOfWork(_context));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CreateHallAsync(ValidCreateRequest(photos: [JpegUpload()])));

        Assert.Equal("simulated database failure after upload", ex.Message);
    }

    [Fact]
    public async Task Update_PreservesExistingUrls_StoresNewR2Url()
    {
        var owner = await CreateOwnerAsync("owner-4");
        var hall = AddHall(owner.Id, "/uploads/halls/legacy-cover.jpg",
            "/uploads/halls/legacy-1.jpg", "https://cdn.example.com/old-1.jpg");
        var storage = new RecordingHallMediaStorage();
        var service = CreateOwnerService(owner.Id, storage);

        var details = await service.UpdateOwnedHallAsync(hall.Id, new UpdateOwnerHallRequest
        {
            Name = "Grand Hall",
            ContactPhone = "+970599111111",
            Region = HallRegion.Gaza,
            Address = "حي الرمال",
            Capacity = 200,
            Photos =
            [
                new UpdateOwnerHallPhotoDto { Url = "/uploads/halls/legacy-1.jpg", DisplayOrder = 0 },
                new UpdateOwnerHallPhotoDto { Url = "https://cdn.example.com/old-1.jpg", DisplayOrder = 1 }
            ],
            NewPhotos = [JpegUpload("fresh.jpg")]
        });

        Assert.Single(storage.Saved);
        var fresh = storage.Saved[0];
        Assert.StartsWith("https://media.test/", fresh.PublicUrl, StringComparison.Ordinal);
        Assert.Contains(details.Photos, photo => photo.Url == "/uploads/halls/legacy-1.jpg");
        Assert.Contains(details.Photos, photo => photo.Url == "https://cdn.example.com/old-1.jpg");
        Assert.Contains(details.Photos, photo => photo.Url == fresh.PublicUrl);
        var reloaded = await _context.Halls.Include(h => h.Images).SingleAsync(h => h.Id == hall.Id);
        Assert.DoesNotContain(reloaded.Images, image => image.IsDeleted && image.Url == fresh.PublicUrl);
    }

    [Fact]
    public async Task Update_DbFailure_DeletesOnlyNewObjects()
    {
        var owner = await CreateOwnerAsync("owner-5");
        var hall = AddHall(owner.Id, null, "/uploads/halls/legacy-1.jpg");
        var storage = new RecordingHallMediaStorage();
        var service = CreateOwnerService(owner.Id, storage, new FailingUnitOfWork(_context));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.UpdateOwnedHallAsync(hall.Id, new UpdateOwnerHallRequest
            {
                Name = "Grand Hall",
                ContactPhone = "+970599111111",
                Region = HallRegion.Gaza,
                Address = "حي الرمال",
                Capacity = 200,
                Photos = [new UpdateOwnerHallPhotoDto { Url = "/uploads/halls/legacy-1.jpg", DisplayOrder = 0 }],
                NewPhotos = [JpegUpload("fresh.jpg")]
            }));

        Assert.Single(storage.Saved);
        Assert.Equal(storage.Saved, storage.Deleted);
    }

    [Fact]
    public async Task DeleteOwnedHall_DoesNotDeleteStoredObjects()
    {
        var owner = await CreateOwnerAsync("owner-6");
        var hall = AddHall(owner.Id, "https://media.test/halls/x/cover.jpg", "https://media.test/halls/x/1.jpg");
        var storage = new RecordingHallMediaStorage();
        var service = CreateOwnerService(owner.Id, storage);

        await service.DeleteOwnedHallAsync(hall.Id);

        Assert.Empty(storage.Deleted);
        var reloaded = await _context.Halls.Include(h => h.Images).SingleAsync(h => h.Id == hall.Id);
        Assert.True(reloaded.IsDeleted);
        Assert.Single(reloaded.Images);
    }

    public void Dispose()
    {
        _context.Dispose();
        _provider.Dispose();
    }
}
