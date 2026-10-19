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
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Authorization;
using Wesal.Infrastructure.Documents;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Notifications;
using Wesal.Infrastructure.Publishing;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

public sealed class PublishingServiceShould : IDisposable
{
    private static readonly DateTimeOffset Now = new(2030, 1, 10, 12, 0, 0, TimeSpan.Zero);
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _db;
    private readonly UserManager<ApplicationUser> _users;
    private readonly RoleManager<ApplicationRole> _roles;
    private readonly CurrentUser _current = new();
    private readonly FakeRestrictions _restrictions = new();
    private readonly MemoryContentStore _files = new();
    private readonly DirectUnitOfWork _unit;
    private readonly FakeNotificationService _notificationService = new();
    private readonly RecordingNotificationDispatcher _dispatcher = new();
    private readonly FixedTimeProvider _clock = new(Now);

    public PublishingServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddIdentityCore<ApplicationUser>().AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
        services.AddLogging();
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<ApplicationDbContext>();
        _db.Database.EnsureCreated();
        _users = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        _roles = _provider.GetRequiredService<RoleManager<ApplicationRole>>();
        _unit = new DirectUnitOfWork(_db);
        _roles.CreateAsync(new ApplicationRole(ApplicationRoles.EventCoordinator)).GetAwaiter().GetResult();
        _roles.CreateAsync(new ApplicationRole(ApplicationRoles.Photographer)).GetAwaiter().GetResult();
        _roles.CreateAsync(new ApplicationRole(ApplicationRoles.HallOwner)).GetAwaiter().GetResult();
    }

    [Fact]
    public async Task CreateTextOnlyOrImagePostsAndExposeOnlyApprovedOwners()
    {
        var owner = await CreateUserAsync(ApplicationRoles.EventCoordinator);
        var posts = CreatePostService();
        var textId = await posts.CreateAsync(new CreatePostRequest { Content = "  <b>Text</b>   only  ", Price = 0 });
        var imageId = await posts.CreateAsync(new CreatePostRequest { Images = [Png(), Png()] });

        var text = await posts.GetPublicAsync(textId);
        Assert.Equal("Text only", text.Content);
        Assert.Equal(0m, text.Price);
        Assert.Empty(text.Images);
        var imagePost = await posts.GetPublicAsync(imageId);
        Assert.Equal(2, imagePost.Images.Count);
        Assert.All(imagePost.Images, image => Assert.StartsWith("/api/v1/posts/", image.Url));
        Assert.All(_files.Keys, key => Assert.StartsWith("/documents/public-content/", key));
        Assert.DoesNotContain("/documents/coordinators/", string.Join("|", _files.Keys));

        var pending = await CreateUserAsync(ApplicationRoles.Photographer, AccountApprovalStatus.Pending);
        _db.Posts.Add(new Post { OwnerUserId = pending.Id, Content = "private", CreatedAt = Now });
        await _db.SaveChangesAsync();
        Assert.Empty((await posts.ListProfileAsync(pending.Id, 1, 10)).Items);
        await Assert.ThrowsAsync<NotFoundException>(() => posts.GetPublicAsync(_db.Posts.Local.Single(post => post.OwnerUserId == pending.Id).Id));
        Assert.NotEmpty((await posts.ListProfileAsync(owner.Id, 1, 10)).Items);
    }

    [Fact]
    public async Task RejectEmptyPostsAndBlockPublishingForUnapprovedOrRestrictedUsers()
    {
        var owner = await CreateUserAsync(ApplicationRoles.EventCoordinator);
        var posts = CreatePostService();
        await Assert.ThrowsAsync<ValidationException>(() => posts.CreateAsync(new CreatePostRequest()));

        var pending = await CreateUserAsync(ApplicationRoles.Photographer, AccountApprovalStatus.Pending);
        _current.Set(pending, ApplicationRoles.Photographer);
        await Assert.ThrowsAsync<ForbiddenException>(() => CreatePostService().CreateAsync(new CreatePostRequest { Content = "blocked" }));

        _current.Set(owner, ApplicationRoles.EventCoordinator);
        _restrictions.Restricted.Add(owner.Id);
        await Assert.ThrowsAsync<ForbiddenException>(() => CreatePostService().CreateAsync(new CreatePostRequest { Images = [Png()] }));
        Assert.Empty(_files.Keys);
    }

    [Fact]
    public async Task EditPostImmediatelyAndPersistNotificationAtomicallyWhileCleaningFiles()
    {
        var owner = await CreateUserAsync(ApplicationRoles.Photographer);
        var posts = CreatePostService();
        var id = await posts.CreateAsync(new CreatePostRequest { Content = "Initial", Images = [Png()] });
        var oldKey = Assert.Single(_files.Keys);
        Assert.Single(await _db.PostImages.ToArrayAsync());
        Assert.Single(await _db.Posts.ToArrayAsync());

        await posts.UpdateAsync(id, new UpdatePostRequest
        {
            Content = "Updated publicly", Price = 15.25m, ReplaceImages = true, Images = [Png()]
        });
        var updated = await posts.GetPublicAsync(id);
        Assert.Equal("Updated publicly", updated.Content);
        Assert.Equal(15.25m, updated.Price);
        Assert.DoesNotContain(oldKey, _files.Keys);
        var durable = await _db.UserNotifications.SingleAsync();
        Assert.Equal(NotificationKind.PostEditsSaved, durable.Kind);
        Assert.Equal(NotificationActionTarget.Post, durable.ActionTarget);
        Assert.Equal(id.ToString(), durable.TargetId);
        Assert.True(_dispatcher.Has(NotificationKind.PostEditsSaved, owner.Id));

        _unit.FailNextSave = true;
        await Assert.ThrowsAsync<InvalidOperationException>(() => posts.UpdateAsync(id, new UpdatePostRequest
        {
            Content = "failed update", ReplaceImages = true, Images = [Png()]
        }));
        Assert.Equal("Updated publicly", (await posts.GetPublicAsync(id)).Content);
        Assert.Single(_files.Keys);
    }

    [Fact]
    public async Task RestrictPostEditsToTheirOwner()
    {
        var first = await CreateUserAsync(ApplicationRoles.EventCoordinator);
        var posts = CreatePostService();
        var postId = await posts.CreateAsync(new CreatePostRequest { Content = "Owner only" });
        var other = await CreateUserAsync(ApplicationRoles.Photographer);
        _current.Set(other, ApplicationRoles.Photographer);
        await Assert.ThrowsAsync<ForbiddenException>(() => CreatePostService().UpdateAsync(postId,
            new UpdatePostRequest { Content = "IDOR" }));
        Assert.Equal("Owner only", (await posts.GetPublicAsync(postId)).Content);
    }

    [Fact]
    public async Task CreateEditStopAndHideProfessionalOffersAndRejectInvalidTransitions()
    {
        var owner = await CreateUserAsync(ApplicationRoles.EventCoordinator);
        var offers = CreateOfferService();
        var id = await offers.CreateAsync(new CreateProfessionalOfferRequest
        {
            Content = "Text offer", OldPrice = 100, OfferPrice = 75, PriceBox = 70,
            StartsAt = Now.AddMinutes(-1), EndsAt = Now.AddDays(3)
        });
        var own = await offers.ListOwnAsync(1, 10);
        Assert.Single(own.Items);
        Assert.Equal(NotificationKind.ProfessionalOfferPublishedForCoordinator, _dispatcher.Single().Kind);

        await offers.UpdateAsync(id, new UpdateProfessionalOfferRequest
        {
            Content = "Edited offer", OldPrice = 120, OfferPrice = 80, StartsAt = Now.AddMinutes(-1), EndsAt = Now.AddDays(2)
        });
        Assert.Equal(NotificationKind.ProfessionalOfferEditsSaved, _dispatcher.Dispatches.Last().Kind);
        _restrictions.Restricted.Add(owner.Id);
        await offers.StopAsync(id); // stopping remains available to an owner under a publishing restriction
        Assert.Equal(NotificationKind.ProfessionalOfferStopped, _dispatcher.Dispatches.Last().Kind);
        Assert.NotNull((await offers.ListOwnAsync(1, 10)).Items.Single().StoppedAt);
        _restrictions.Restricted.Remove(owner.Id);
        await Assert.ThrowsAsync<ConflictException>(() => offers.StopAsync(id));
        await Assert.ThrowsAsync<ConflictException>(() => offers.UpdateAsync(id, new UpdateProfessionalOfferRequest
        {
            Content = "again", OldPrice = 100, OfferPrice = 50, StartsAt = Now, EndsAt = Now.AddDays(1)
        }));
    }

    [Fact]
    public async Task RejectPublishingWhenRestrictedAndEnforceOfferPriceAndTextRules()
    {
        var owner = await CreateUserAsync(ApplicationRoles.Photographer);
        var offers = CreateOfferService();
        await Assert.ThrowsAsync<ValidationException>(() => offers.CreateAsync(new CreateProfessionalOfferRequest
        {
            OldPrice = 100, OfferPrice = 100, Content = "no discount", StartsAt = Now, EndsAt = Now.AddDays(1)
        }));
        await Assert.ThrowsAsync<ValidationException>(() => offers.CreateAsync(new CreateProfessionalOfferRequest
        {
            OldPrice = 100, OfferPrice = 50, StartsAt = Now, EndsAt = Now.AddDays(1)
        }));
        _restrictions.Restricted.Add(owner.Id);
        await Assert.ThrowsAsync<ForbiddenException>(() => offers.CreateAsync(new CreateProfessionalOfferRequest
        {
            OldPrice = 100, OfferPrice = 50, Content = "blocked", StartsAt = Now, EndsAt = Now.AddDays(1)
        }));
    }

    [Fact]
    public async Task NotifyOfferReminderAndExpiryOnceAndSkipEditedStoppedOrShortLivedOffers()
    {
        var coordinator = await CreateUserAsync(ApplicationRoles.EventCoordinator);
        var photographer = await CreateUserAsync(ApplicationRoles.Photographer);
        var repository = new LifecycleOffersRepository();
        var reminder = Offer(coordinator.Id, Now.AddHours(20), reminderEligible: true);
        var shortLived = Offer(coordinator.Id, Now.AddHours(10), reminderEligible: false);
        var edited = Offer(coordinator.Id, Now.AddHours(10), reminderEligible: true, edited: true);
        var stopped = Offer(coordinator.Id, Now.AddHours(10), reminderEligible: true, stopped: true);
        var expired = Offer(photographer.Id, Now.AddMinutes(-1), end: Now.AddMinutes(-1));
        repository.Rows.AddRange([reminder, shortLived, edited, stopped, expired]);
        var lifecycle = new OfferLifecycleService(repository, new EmptyHallOfferRepository(), _unit,
            _notificationService, new UserNotificationWriter(_db), _dispatcher, _users, _clock);

        await lifecycle.ProcessAsync();
        await lifecycle.ProcessAsync();

        Assert.Equal(2, _db.UserNotifications.Count());
        Assert.Equal(1, _db.UserNotifications.Count(notification => notification.Kind == NotificationKind.ProfessionalOfferReminder24Hours));
        Assert.Equal(1, _db.UserNotifications.Count(notification => notification.Kind == NotificationKind.ProfessionalOfferEndedForPhotographer));
        Assert.Equal(2, _dispatcher.Dispatches.Count);
        Assert.NotNull(reminder.ReminderSentAt);
        Assert.NotNull(expired.ExpiredProcessedAt);
        Assert.Null(shortLived.ReminderSentAt);
        Assert.Null(edited.ReminderSentAt);
        Assert.Null(stopped.ReminderSentAt);
    }

    [Fact]
    public async Task EnforceHallOfferOwnershipAndRejectOverlappingSchedules()
    {
        var owner = await CreateUserAsync(ApplicationRoles.HallOwner);
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Owner hall", OwnerId = owner.Id };
        _db.Halls.Add(hall);
        await _db.SaveChangesAsync();
        var repository = new MemoryHallOffersRepository();
        repository.Hall = hall;
        var service = CreateHallOfferService(repository);
        var id = await service.CreateAsync(hall.Id, new CreateHallOfferRequest
        {
            OldBookingPrice = 1000, OfferPrice = 800, StartsAt = Now.AddDays(2), EndsAt = Now.AddDays(4)
        });
        Assert.Equal(id, Assert.Single(await repository.ListOwnAsync(hall.Id, 0, 10)).Id);

        await Assert.ThrowsAsync<ConflictException>(() => service.CreateAsync(hall.Id, new CreateHallOfferRequest
        {
            OldBookingPrice = 1000, OfferPrice = 700, StartsAt = Now.AddDays(3), EndsAt = Now.AddDays(5)
        }));

        var other = await CreateUserAsync(ApplicationRoles.HallOwner);
        _current.Set(other, ApplicationRoles.HallOwner);
        await Assert.ThrowsAsync<NotFoundException>(() => CreateHallOfferService(repository).StopAsync(hall.Id, id));
        _current.Set(owner, ApplicationRoles.EventCoordinator);
        await Assert.ThrowsAsync<ForbiddenException>(() => CreateHallOfferService(repository).ListOwnAsync(hall.Id, 1, 10));
        _current.Set(owner, ApplicationRoles.HallOwner);
        await service.StopAsync(hall.Id, id);
        Assert.NotNull((await service.ListOwnAsync(hall.Id, 1, 10)).Items.Single().StoppedAt);
    }

    private async Task<ApplicationUser> CreateUserAsync(string role, AccountApprovalStatus status = AccountApprovalStatus.Approved)
    {
        var email = $"{Guid.NewGuid():N}@example.com";
        var user = new ApplicationUser { FullName = "Publisher", UserName = email, Email = email, ApprovalStatus = status };
        Assert.True((await _users.CreateAsync(user, "LongPassword1!")).Succeeded);
        Assert.True((await _users.AddToRoleAsync(user, role)).Succeeded);
        _current.Set(user, role);
        return user;
    }

    private PostService CreatePostService()
        => new(_current, new AccountApprovalGuard(_current, _users), _restrictions, _users,
            new PostRepository(_db), _files, _unit, _notificationService, new UserNotificationWriter(_db), _dispatcher,
            new Wesal.Application.Common.Validation.CreatePostRequestValidator(),
            new Wesal.Application.Common.Validation.UpdatePostRequestValidator(), _clock);

    private ProfessionalOfferService CreateOfferService()
        => new(_current, new AccountApprovalGuard(_current, _users), _restrictions, _users,
            new ProfessionalOfferRepository(_db), _files, _unit, _notificationService, new UserNotificationWriter(_db), _dispatcher,
            new Wesal.Application.Common.Validation.CreateProfessionalOfferRequestValidator(_clock),
            new Wesal.Application.Common.Validation.UpdateProfessionalOfferRequestValidator(_clock), _clock);

    private HallOfferService CreateHallOfferService(IHallOfferRepository repository)
        => new(_current, new HallRepository(_db), repository, _unit,
            new Wesal.Application.Common.Validation.CreateHallOfferRequestValidator(_clock),
            new Wesal.Application.Common.Validation.UpdateHallOfferRequestValidator(_clock), _clock);

    private static ProfessionalOffer Offer(string ownerId, DateTimeOffset endsAt, bool reminderEligible = false,
        bool edited = false, bool stopped = false, DateTimeOffset? end = null)
        => new()
        {
            OwnerUserId = ownerId, OldPrice = 100, OfferPrice = 70, Content = "Offer",
            StartsAt = Now.AddDays(-1), EndsAt = end ?? endsAt, ReminderEligible = reminderEligible,
            HasBeenEdited = edited, StoppedAt = stopped ? Now.AddMinutes(-1) : null
        };

    private static OwnerDocumentUpload Png() => new()
    {
        FileName = "image.png", ContentType = "image/png", Content = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    };

    public void Dispose() => _provider.Dispose();

    private sealed class CurrentUser : ICurrentUserService
    {
        public string? UserId { get; private set; }
        public string? UserName => null;
        public string? Email => null;
        public bool IsAuthenticated => UserId is not null;
        public IReadOnlyList<string> Roles { get; private set; } = [];
        public void Set(ApplicationUser user, params string[] roles) { UserId = user.Id; Roles = roles; }
    }

    private sealed class FakeRestrictions : IUserContentPublishingRestrictionService
    {
        public HashSet<string> Restricted { get; } = [];
        public Task<bool> IsRestrictedAsync(string userId, CancellationToken cancellationToken = default)
            => Task.FromResult(Restricted.Contains(userId));
    }

    private sealed class MemoryContentStore : IIdentityDocumentStore
    {
        private readonly Dictionary<string, byte[]> _files = [];
        public IReadOnlyCollection<string> Keys => _files.Keys;
        public Task SaveAsync(string relativeUrl, byte[] content, CancellationToken cancellationToken = default)
        { _files[relativeUrl] = content; return Task.CompletedTask; }
        public Task<StoredDocumentContent?> ReadAsync(string relativeUrl, CancellationToken cancellationToken = default)
            => Task.FromResult(_files.TryGetValue(relativeUrl, out var content) ? new StoredDocumentContent { Bytes = content } : null);
        public Task DeleteAsync(string relativeUrl, CancellationToken cancellationToken = default)
        { _files.Remove(relativeUrl); return Task.CompletedTask; }
    }

    private sealed class DirectUnitOfWork(ApplicationDbContext db) : IUnitOfWork
    {
        public bool FailNextSave { get; set; }
        public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            if (FailNextSave) { FailNextSave = false; throw new InvalidOperationException("Simulated database failure."); }
            return await db.SaveChangesAsync(cancellationToken);
        }
        public Task ExecuteInTransactionAsync(Func<Task> operation, CancellationToken cancellationToken = default) => operation();
        public Task<T> ExecuteInTransactionAsync<T>(Func<Task<T>> operation, CancellationToken cancellationToken = default) => operation();
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class LifecycleOffersRepository : IProfessionalOfferRepository
    {
        private readonly HashSet<Guid> _claimedReminders = [];
        private readonly HashSet<Guid> _claimedExpiry = [];
        public List<ProfessionalOffer> Rows { get; } = [];
        public Task AddAsync(ProfessionalOffer offer, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public void AddImage(ProfessionalOfferImage image) => throw new NotImplementedException();
        public Task<ProfessionalOffer?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<ProfessionalOffer?> GetAccessibleAsync(Guid id, string? ownerId, DateTimeOffset now, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<ProfessionalOffer>> ListOwnAsync(string ownerId, int skip, int take, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<int> CountOwnAsync(string ownerId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<ProfessionalOffer>> ListVisibleByOwnerAsync(string ownerId, DateTimeOffset now, int skip, int take, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<int> CountVisibleByOwnerAsync(string ownerId, DateTimeOffset now, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<ProfessionalOffer>> GetReminderCandidatesAsync(DateTimeOffset now, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ProfessionalOffer>>(Rows.Where(row => row.ReminderEligible && !row.HasBeenEdited && row.StoppedAt is null && row.ReminderSentAt is null && row.ExpiredProcessedAt is null && row.EndsAt > now && row.EndsAt <= now.AddHours(24)).ToArray());
        public Task<IReadOnlyList<ProfessionalOffer>> GetExpiryCandidatesAsync(DateTimeOffset now, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<ProfessionalOffer>>(Rows.Where(row => row.EndsAt <= now && row.ExpiredProcessedAt is null && row.StoppedAt is null).ToArray());
        public Task<bool> TryClaimReminderAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default)
        {
            var row = Rows.Single(item => item.Id == id);
            if (!_claimedReminders.Add(id) || row.HasBeenEdited || row.StoppedAt is not null || row.ReminderSentAt is not null) return Task.FromResult(false);
            row.ReminderSentAt = now; return Task.FromResult(true);
        }
        public Task<bool> TryClaimExpiryAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default)
        {
            var row = Rows.Single(item => item.Id == id);
            if (!_claimedExpiry.Add(id) || row.ExpiredProcessedAt is not null || row.StoppedAt is not null) return Task.FromResult(false);
            row.ExpiredProcessedAt = now; return Task.FromResult(true);
        }
    }

    private sealed class EmptyHallOfferRepository : IHallOfferRepository
    {
        public Task AddAsync(HallOffer offer, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task LockHallForOfferAsync(Guid hallId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<HallOffer?> GetForUpdateAsync(Guid hallId, Guid offerId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<HallOffer>> ListOwnAsync(Guid hallId, int skip, int take, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<HallOffer>>([]);
        public Task<int> CountOwnAsync(Guid hallId, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<HallOffer?> GetActiveForHallAsync(Guid hallId, DateTimeOffset now, CancellationToken cancellationToken = default) => Task.FromResult<HallOffer?>(null);
        public Task<bool> HasOverlappingAsync(Guid hallId, DateTimeOffset startsAt, DateTimeOffset endsAt, DateTimeOffset now, Guid? exceptId = null, CancellationToken cancellationToken = default) => Task.FromResult(false);
        public Task<IReadOnlyList<HallOffer>> GetExpiredUnprocessedAsync(DateTimeOffset now, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<HallOffer>>([]);
        public Task MarkExpiredForHallAsync(Guid hallId, DateTimeOffset now, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<bool> TryClaimExpiryAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default) => Task.FromResult(false);
    }

    private sealed class MemoryHallOffersRepository : IHallOfferRepository
    {
        private readonly List<HallOffer> _rows = [];
        public Hall? Hall { get; set; }
        public Task AddAsync(HallOffer offer, CancellationToken cancellationToken = default) { offer.Hall = Hall!; _rows.Add(offer); return Task.CompletedTask; }
        public Task LockHallForOfferAsync(Guid hallId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<HallOffer?> GetForUpdateAsync(Guid hallId, Guid offerId, CancellationToken cancellationToken = default)
            => Task.FromResult(_rows.FirstOrDefault(offer => offer.HallId == hallId && offer.Id == offerId));
        public Task<IReadOnlyList<HallOffer>> ListOwnAsync(Guid hallId, int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallOffer>>(_rows.Where(offer => offer.HallId == hallId).OrderByDescending(offer => offer.CreatedAt).Skip(skip).Take(take).ToArray());
        public Task<int> CountOwnAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult(_rows.Count(offer => offer.HallId == hallId));
        public Task<HallOffer?> GetActiveForHallAsync(Guid hallId, DateTimeOffset now, CancellationToken cancellationToken = default)
            => Task.FromResult(_rows.FirstOrDefault(offer => offer.HallId == hallId && offer.StoppedAt is null && offer.StartsAt <= now && now < offer.EndsAt));
        public Task<bool> HasOverlappingAsync(Guid hallId, DateTimeOffset startsAt, DateTimeOffset endsAt, DateTimeOffset now, Guid? exceptId = null, CancellationToken cancellationToken = default)
            => Task.FromResult(_rows.Any(offer => offer.HallId == hallId && offer.Id != exceptId && offer.StoppedAt is null
                && offer.ExpiredProcessedAt is null && offer.EndsAt > now && offer.StartsAt < endsAt && startsAt < offer.EndsAt));
        public Task<IReadOnlyList<HallOffer>> GetExpiredUnprocessedAsync(DateTimeOffset now, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallOffer>>(_rows.Where(offer => offer.EndsAt <= now && offer.ExpiredProcessedAt is null && offer.StoppedAt is null).ToArray());
        public Task MarkExpiredForHallAsync(Guid hallId, DateTimeOffset now, CancellationToken cancellationToken = default)
        { foreach (var offer in _rows.Where(offer => offer.HallId == hallId && offer.EndsAt <= now && offer.StoppedAt is null)) offer.ExpiredProcessedAt = now; return Task.CompletedTask; }
        public Task<bool> TryClaimExpiryAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default)
        {
            var offer = _rows.FirstOrDefault(row => row.Id == id && row.EndsAt <= now && row.ExpiredProcessedAt is null && row.StoppedAt is null);
            if (offer is null) return Task.FromResult(false);
            offer.ExpiredProcessedAt = now;
            return Task.FromResult(true);
        }
    }
}
