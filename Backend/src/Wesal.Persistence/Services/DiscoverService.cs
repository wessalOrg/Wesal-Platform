using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Services;

/// <summary>Database-projected public Discover and name-search results.</summary>
public sealed class DiscoverService(ApplicationDbContext db, TimeProvider clock) : IDiscoverService
{
    private const int MaxPageSize = 50;

    public async Task<PagedResult<DiscoverItemDto>> GetFeedAsync(string filter, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var selected = ParseFilter(filter, allowOffers: true);
        var window = PageWindow(page, pageSize);
        var now = clock.GetUtcNow();
        var sources = BuildFeed(selected, now);
        return await PageMixedAsync(sources, window, cancellationToken);
    }

    public async Task<PagedResult<DiscoverItemDto>> SearchAsync(string filter, string query, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var selected = ParseFilter(filter, allowOffers: false);
        var window = PageWindow(page, pageSize);
        var term = query?.Trim();
        if (string.IsNullOrWhiteSpace(term))
            return PagedResult<DiscoverItemDto>.Create([], window.Page, window.Size, 0);

        var pattern = term.ToLowerInvariant();
        var results = new List<IQueryable<DiscoverItemDto>>();
        if (selected is Filter.All or Filter.Halls)
        {
            var halls = PublicHalls().Where(hall => hall.Name.ToLower().Contains(pattern)
                || selected == Filter.Halls && hall.Address.ToLower().Contains(pattern));
            results.Add(halls.Select(hall => new DiscoverItemDto
            {
                ContentType = "Hall", Id = hall.Id, OwnerUserId = hall.OwnerId, DisplayName = hall.Name,
                ImageUrl = hall.MainImageUrl, Location = hall.Address, Price = hall.Price, CreatedAt = hall.CreatedAt
            }));
        }

        if (selected is Filter.All or Filter.EventCoordinators)
        {
            var coordinatorProfiles = from profile in db.CoordinatorProfiles.AsNoTracking()
                join user in ApprovedRoleUsers(ApplicationRoles.EventCoordinator) on profile.UserId equals user.Id
                let name = profile.BusinessType == CoordinatorBusinessType.Shop ? profile.ShopName : profile.OnlineStoreName
                where name != null && name.ToLower().Contains(pattern)
                select new DiscoverItemDto
                {
                    ContentType = "EventCoordinator", Id = profile.Id, OwnerUserId = profile.UserId,
                    DisplayName = name, ImageUrl = user.ProfilePictureUrl, CreatedAt = profile.SubmittedAt
                };
            results.Add(coordinatorProfiles);
        }

        if (selected is Filter.All or Filter.Photographers)
        {
            var photographerProfiles = from profile in db.PhotographerProfiles.AsNoTracking()
                join user in ApprovedRoleUsers(ApplicationRoles.Photographer) on profile.UserId equals user.Id
                let name = profile.HasStudio ? profile.StudioName : PublicProfiles.DisplayNameFallback
                where name != null && name.ToLower().Contains(pattern)
                select new DiscoverItemDto
                {
                    ContentType = "Photographer", Id = profile.Id, OwnerUserId = profile.UserId,
                    DisplayName = name, ImageUrl = user.ProfilePictureUrl,
                    Location = profile.StudioLocation, CreatedAt = profile.SubmittedAt
                };
            results.Add(photographerProfiles);
        }

        return await PageMixedAsync(results, window, cancellationToken);
    }

    private IReadOnlyList<IQueryable<DiscoverItemDto>> BuildFeed(Filter filter, DateTimeOffset now)
    {
        var result = new List<IQueryable<DiscoverItemDto>>();
        if (filter is Filter.All or Filter.Halls)
            result.Add(PublicHalls().Select(hall => new DiscoverItemDto
            {
                ContentType = "Hall", Id = hall.Id, OwnerUserId = hall.OwnerId, DisplayName = hall.Name,
                Content = hall.Description, ImageUrl = hall.MainImageUrl, Location = hall.Address,
                Price = hall.Price, CreatedAt = hall.CreatedAt
            }));

        if (filter is Filter.All)
        {
            var coordinatorIds = ApprovedRoleUsers(ApplicationRoles.EventCoordinator).Select(user => user.Id);
            var photographerIds = ApprovedRoleUsers(ApplicationRoles.Photographer).Select(user => user.Id);
            var publicOwners = coordinatorIds.Concat(photographerIds);
            var posts = from post in db.Posts.AsNoTracking()
                where publicOwners.Contains(post.OwnerUserId)
                select new DiscoverItemDto
                {
                    ContentType = "Post", Id = post.Id, OwnerUserId = post.OwnerUserId, Content = post.Content,
                    Price = post.Price, ImageUrl = db.PostImages.Where(image => image.PostId == post.Id)
                        .OrderBy(image => image.Order).Select(image => $"/api/v1/posts/{post.Id}/images/{image.Id}").FirstOrDefault(),
                    CreatedAt = post.CreatedAt
                };
            result.Add(posts);
        }

        if (filter is Filter.EventCoordinators)
        {
            var profiles = from profile in db.CoordinatorProfiles.AsNoTracking()
                join user in ApprovedRoleUsers(ApplicationRoles.EventCoordinator) on profile.UserId equals user.Id
                select new DiscoverItemDto
                {
                    ContentType = "EventCoordinator", Id = profile.Id, OwnerUserId = profile.UserId,
                    DisplayName = profile.BusinessType == CoordinatorBusinessType.Shop ? profile.ShopName : profile.OnlineStoreName,
                    ImageUrl = user.ProfilePictureUrl, Location = profile.ShopLocation, CreatedAt = profile.SubmittedAt
                };
            result.Add(profiles);
        }

        if (filter is Filter.Photographers)
        {
            var profiles = from profile in db.PhotographerProfiles.AsNoTracking()
                join user in ApprovedRoleUsers(ApplicationRoles.Photographer) on profile.UserId equals user.Id
                select new DiscoverItemDto
                {
                    ContentType = "Photographer", Id = profile.Id, OwnerUserId = profile.UserId,
                    DisplayName = profile.HasStudio ? profile.StudioName : PublicProfiles.DisplayNameFallback,
                    ImageUrl = user.ProfilePictureUrl, Location = profile.HasStudio ? profile.StudioLocation : null,
                    CreatedAt = profile.SubmittedAt
                };
            result.Add(profiles);
        }

        if (filter is Filter.Offers)
        {
            var approvedCoordinatorIds = ApprovedRoleUsers(ApplicationRoles.EventCoordinator).Select(user => user.Id);
            var approvedPhotographerIds = ApprovedRoleUsers(ApplicationRoles.Photographer).Select(user => user.Id);
            var professionalOffers = from offer in db.ProfessionalOffers.AsNoTracking()
                where offer.StoppedAt == null && offer.ExpiredProcessedAt == null
                    && offer.StartsAt <= now && now < offer.EndsAt
                    && (approvedCoordinatorIds.Contains(offer.OwnerUserId) || approvedPhotographerIds.Contains(offer.OwnerUserId))
                select new DiscoverItemDto
                {
                    ContentType = "ProfessionalOffer", Id = offer.Id, OwnerUserId = offer.OwnerUserId,
                    Content = offer.Content, OldPrice = offer.OldPrice, OfferPrice = offer.OfferPrice,
                    StartsAt = offer.StartsAt, EndsAt = offer.EndsAt,
                    ImageUrl = db.ProfessionalOfferImages.Where(image => image.OfferId == offer.Id)
                        .OrderBy(image => image.Order).Select(image => $"/api/v1/offers/{offer.Id}/images/{image.Id}").FirstOrDefault(),
                    CreatedAt = offer.CreatedAt
                };
            result.Add(professionalOffers);

            var hallOffers = from offer in db.HallOffers.AsNoTracking()
                join hall in PublicHalls() on offer.HallId equals hall.Id
                where offer.StoppedAt == null && offer.ExpiredProcessedAt == null
                    && offer.StartsAt <= now && now < offer.EndsAt
                select new DiscoverItemDto
                {
                    ContentType = "HallOffer", Id = offer.Id, OwnerUserId = hall.OwnerId,
                    DisplayName = hall.Name, Content = hall.Description, ImageUrl = hall.MainImageUrl,
                    Location = hall.Address, OldPrice = offer.OldBookingPrice, OfferPrice = offer.OfferPrice,
                    StartsAt = offer.StartsAt, EndsAt = offer.EndsAt, CreatedAt = offer.CreatedAt
                };
            result.Add(hallOffers);
        }

        return result;
    }

    private IQueryable<ApplicationUser> ApprovedRoleUsers(string role)
    {
        var roleIds = db.Roles.Where(row => row.NormalizedName == role.ToUpperInvariant()).Select(row => row.Id);
        var userIds = db.UserRoles.Where(row => roleIds.Contains(row.RoleId)).Select(row => row.UserId);
        return db.Users.AsNoTracking().Where(user => user.ApprovalStatus == AccountApprovalStatus.Approved && userIds.Contains(user.Id));
    }

    private IQueryable<Wesal.Domain.Entities.Hall> PublicHalls()
        => db.Halls.AsNoTracking().Where(hall => hall.Status == HallStatus.Approved && !hall.IsDeleted
            && !hall.IsAdminLocked && !hall.SystemLocked && hall.PaymentStatus == HallPaymentStatus.Paid);

    private static async Task<PagedResult<DiscoverItemDto>> PageMixedAsync(IReadOnlyList<IQueryable<DiscoverItemDto>> sources,
        (int Page, int Size, int Skip) window, CancellationToken cancellationToken)
    {
        var candidateCount = checked(window.Skip + window.Size);
        var total = 0;
        var candidates = new List<DiscoverItemDto>();
        foreach (var source in sources)
        {
            total += await source.CountAsync(cancellationToken);
            candidates.AddRange(await source.OrderByDescending(row => row.CreatedAt).ThenBy(row => row.ContentType).ThenBy(row => row.Id)
                .Take(candidateCount).ToListAsync(cancellationToken));
        }
        var items = candidates.OrderByDescending(row => row.CreatedAt).ThenBy(row => row.ContentType).ThenBy(row => row.Id)
            .Skip(window.Skip).Take(window.Size).ToArray();
        return PagedResult<DiscoverItemDto>.Create(items, window.Page, window.Size, total);
    }

    private static (int Page, int Size, int Skip) PageWindow(int page, int pageSize)
    {
        if (page is < 1 or > 1000) throw new ValidationException("Page must be between 1 and 1000.");
        if (pageSize is < 1 or > MaxPageSize) throw new ValidationException($"Page size must be between 1 and {MaxPageSize}.");
        if ((long)(page - 1) * pageSize + pageSize > int.MaxValue) throw new ValidationException("Page is too large.");
        return (page, pageSize, (page - 1) * pageSize);
    }

    private static Filter ParseFilter(string? value, bool allowOffers)
    {
        var normalized = value?.Trim().Replace(" ", "", StringComparison.Ordinal).Replace("-", "", StringComparison.Ordinal);
        var parsed = normalized?.ToLowerInvariant() switch
        {
            null or "" or "all" => Filter.All,
            "halls" => Filter.Halls,
            "eventcoordinators" or "coordinators" => Filter.EventCoordinators,
            "photographers" => Filter.Photographers,
            "offers" when allowOffers => Filter.Offers,
            _ => (Filter?)null
        };
        return parsed ?? throw new ValidationException("Filter must be All, Halls, Event Coordinators, Photographers" + (allowOffers ? ", or Offers." : "."));
    }

    private enum Filter { All, Halls, EventCoordinators, Photographers, Offers }
}
