using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class AdminModerationRepository(ApplicationDbContext context) : IAdminModerationRepository
{
    public Task<Post?> GetPostForModerationAsync(Guid id, CancellationToken cancellationToken = default)
        => context.Posts.Include(row => row.Images).FirstOrDefaultAsync(row => row.Id == id, cancellationToken);

    public Task<ProfessionalOffer?> GetOfferForModerationAsync(Guid id, CancellationToken cancellationToken = default)
        => context.ProfessionalOffers.Include(row => row.Images).FirstOrDefaultAsync(row => row.Id == id, cancellationToken);

    public void RemovePost(Post post) => context.Posts.Remove(post);
    public void RemoveOffer(ProfessionalOffer offer) => context.ProfessionalOffers.Remove(offer);

    public Task<int> CountLockedAccountsAsync(string role, string? search, DateTimeOffset now, CancellationToken cancellationToken = default)
        => LockedAccountQuery(role, search, now).CountAsync(cancellationToken);

    public async Task<IReadOnlyList<AdminLockedAccountDto>> ListLockedAccountsAsync(string role, string? search,
        DateTimeOffset now, int skip, int take, CancellationToken cancellationToken = default)
    {
        var rows = await LockedAccountQuery(role, search, now)
            .OrderBy(lockRow => lockRow.EndsAt).ThenBy(lockRow => lockRow.UserId)
            .Skip(skip).Take(take)
            .Select(lockRow => new
            {
                Lock = lockRow,
                UserName = context.Users.Where(user => user.Id == lockRow.UserId).Select(user => user.FullName).FirstOrDefault() ?? string.Empty,
                BusinessName = role == ApplicationRoles.EventCoordinator
                    ? context.CoordinatorProfiles.Where(profile => profile.UserId == lockRow.UserId)
                        .Select(profile => profile.BusinessType == CoordinatorBusinessType.Shop ? profile.ShopName : profile.OnlineStoreName).FirstOrDefault()
                    : context.PhotographerProfiles.Where(profile => profile.UserId == lockRow.UserId && profile.HasStudio)
                        .Select(profile => profile.StudioName).FirstOrDefault(),
                PhotographerAdminOnlyFullName = role == ApplicationRoles.Photographer
                    ? context.PhotographerProfiles.Where(profile => profile.UserId == lockRow.UserId && !profile.HasStudio)
                        .Select(profile => profile.FullName).FirstOrDefault()
                    : null
            }).ToListAsync(cancellationToken);

        return rows.Select(row => new AdminLockedAccountDto
        {
            UserId = row.Lock.UserId,
            DisplayName = row.UserName,
            BusinessName = row.BusinessName,
            Role = role,
            LockedAt = row.Lock.StartsAt,
            LockedUntil = row.Lock.EndsAt,
            Remaining = row.Lock.EndsAt - now,
            Reason = row.Lock.Reason,
            LockingAdminId = row.Lock.CreatedByAdminId,
            PhotographerAdminOnlyFullName = row.PhotographerAdminOnlyFullName,
            UnlockAction = $"/api/v1/admin/moderation/users/{Uri.EscapeDataString(row.Lock.UserId)}/lock"
        }).ToArray();
    }

    private IQueryable<UserPublishingRestriction> LockedAccountQuery(string role, string? search, DateTimeOffset now)
    {
        var normalizedRole = role.ToUpperInvariant();
        var rows = context.AccountLocks.AsNoTracking().Where(lockRow => lockRow.LiftedAt == null
            && lockRow.StartsAt <= now && now < lockRow.EndsAt
            && context.UserRoles.Any(userRole => userRole.UserId == lockRow.UserId
                && context.Roles.Any(identityRole => identityRole.Id == userRole.RoleId
                    && identityRole.NormalizedName == normalizedRole)));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            rows = rows.Where(lockRow => context.Users.Any(user => user.Id == lockRow.UserId && user.FullName.ToLower().Contains(term))
                || role == ApplicationRoles.EventCoordinator && context.CoordinatorProfiles.Where(profile => profile.UserId == lockRow.UserId)
                    .Any(profile => (profile.ShopName ?? profile.OnlineStoreName ?? string.Empty).ToLower().Contains(term))
                || role == ApplicationRoles.Photographer && context.PhotographerProfiles.Where(profile => profile.UserId == lockRow.UserId)
                    .Any(profile => (profile.StudioName ?? profile.FullName ?? string.Empty).ToLower().Contains(term)));
        }
        return rows;
    }

    public Task<int> CountAdminPostsAsync(string? ownerId, string? ownerRole, CancellationToken cancellationToken = default)
        => AdminPosts(ownerId, ownerRole).CountAsync(cancellationToken);

    public async Task<IReadOnlyList<AdminModeratedContentDto>> ListAdminPostsAsync(string? ownerId, string? ownerRole,
        DateTimeOffset now, int skip, int take, CancellationToken cancellationToken = default)
    {
        var rows = await AdminPosts(ownerId, ownerRole).Include(row => row.Images)
            .OrderByDescending(row => row.CreatedAt).ThenBy(row => row.Id).Skip(skip).Take(take).ToListAsync(cancellationToken);
        return await MapPostsAsync(rows, now, cancellationToken);
    }

    public async Task<AdminModeratedContentDto?> GetAdminPostAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        var row = await AdminPosts(null, null).Include(post => post.Images).FirstOrDefaultAsync(post => post.Id == id, cancellationToken);
        if (row is null) return null;
        return (await MapPostsAsync([row], now, cancellationToken)).Single();
    }

    public Task<int> CountAdminOffersAsync(string? ownerId, string? ownerRole, CancellationToken cancellationToken = default)
        => AdminOffers(ownerId, ownerRole).CountAsync(cancellationToken);

    public async Task<IReadOnlyList<AdminModeratedContentDto>> ListAdminOffersAsync(string? ownerId, string? ownerRole,
        DateTimeOffset now, int skip, int take, CancellationToken cancellationToken = default)
    {
        var rows = await AdminOffers(ownerId, ownerRole).Include(row => row.Images)
            .OrderByDescending(row => row.CreatedAt).ThenBy(row => row.Id).Skip(skip).Take(take).ToListAsync(cancellationToken);
        return await MapOffersAsync(rows, now, cancellationToken);
    }

    public async Task<AdminModeratedContentDto?> GetAdminOfferAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        var row = await AdminOffers(null, null).Include(offer => offer.Images).FirstOrDefaultAsync(offer => offer.Id == id, cancellationToken);
        if (row is null) return null;
        return (await MapOffersAsync([row], now, cancellationToken)).Single();
    }

    private IQueryable<Post> AdminPosts(string? ownerId, string? ownerRole)
    {
        var professionalRoleIds = context.Roles.Where(role => role.NormalizedName == ApplicationRoles.EventCoordinator.ToUpperInvariant()
            || role.NormalizedName == ApplicationRoles.Photographer.ToUpperInvariant()).Select(role => role.Id);
        var query = context.Posts.AsNoTracking().Where(post => context.UserRoles.Any(userRole => userRole.UserId == post.OwnerUserId
            && professionalRoleIds.Contains(userRole.RoleId)));
        if (!string.IsNullOrWhiteSpace(ownerId)) query = query.Where(post => post.OwnerUserId == ownerId);
        if (!string.IsNullOrWhiteSpace(ownerRole))
        {
            var selectedRoleIds = context.Roles.Where(role => role.NormalizedName == ownerRole.ToUpperInvariant()).Select(role => role.Id);
            query = query.Where(post => context.UserRoles.Any(userRole => userRole.UserId == post.OwnerUserId
                && selectedRoleIds.Contains(userRole.RoleId)));
        }
        return query;
    }

    private IQueryable<ProfessionalOffer> AdminOffers(string? ownerId, string? ownerRole)
    {
        var professionalRoleIds = context.Roles.Where(role => role.NormalizedName == ApplicationRoles.EventCoordinator.ToUpperInvariant()
            || role.NormalizedName == ApplicationRoles.Photographer.ToUpperInvariant()).Select(role => role.Id);
        var query = context.ProfessionalOffers.AsNoTracking().Where(offer => context.UserRoles.Any(userRole => userRole.UserId == offer.OwnerUserId
            && professionalRoleIds.Contains(userRole.RoleId)));
        if (!string.IsNullOrWhiteSpace(ownerId)) query = query.Where(offer => offer.OwnerUserId == ownerId);
        if (!string.IsNullOrWhiteSpace(ownerRole))
        {
            var selectedRoleIds = context.Roles.Where(role => role.NormalizedName == ownerRole.ToUpperInvariant()).Select(role => role.Id);
            query = query.Where(offer => context.UserRoles.Any(userRole => userRole.UserId == offer.OwnerUserId
                && selectedRoleIds.Contains(userRole.RoleId)));
        }
        return query;
    }

    private async Task<IReadOnlyList<AdminModeratedContentDto>> MapPostsAsync(IReadOnlyList<Post> posts, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var owners = await GetOwnerDetailsAsync(posts.Select(row => row.OwnerUserId).Distinct().ToArray(), now, cancellationToken);
        return posts.Select(post =>
        {
            var owner = owners[post.OwnerUserId];
            return new AdminModeratedContentDto
            {
                Id = post.Id, OwnerUserId = post.OwnerUserId, OwnerDisplayName = owner.DisplayName,
                OwnerRole = owner.Role, OwnerIsLocked = owner.IsLocked, Content = post.Content, Price = post.Price,
                CreatedAt = post.CreatedAt,
                Images = post.Images.OrderBy(image => image.Order).Select(image => new PublicProfileImageDto
                {
                    Id = image.Id, Order = image.Order, Url = $"/api/v1/admin/moderation/posts/{post.Id}/images/{image.Id}"
                }).ToArray()
            };
        }).ToArray();
    }

    private async Task<IReadOnlyList<AdminModeratedContentDto>> MapOffersAsync(IReadOnlyList<ProfessionalOffer> offers, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var owners = await GetOwnerDetailsAsync(offers.Select(row => row.OwnerUserId).Distinct().ToArray(), now, cancellationToken);
        return offers.Select(offer =>
        {
            var owner = owners[offer.OwnerUserId];
            var status = offer.StoppedAt is not null ? "Stopped" : offer.EndsAt <= now ? "Ended"
                : offer.StartsAt > now ? "Scheduled" : "Active";
            return new AdminModeratedContentDto
            {
                Id = offer.Id, OwnerUserId = offer.OwnerUserId, OwnerDisplayName = owner.DisplayName,
                OwnerRole = owner.Role, OwnerIsLocked = owner.IsLocked, Content = offer.Content,
                Price = offer.PriceBox, OldPrice = offer.OldPrice, OfferPrice = offer.OfferPrice,
                StartsAt = offer.StartsAt, EndsAt = offer.EndsAt, StoppedAt = offer.StoppedAt,
                Status = status, CreatedAt = offer.CreatedAt,
                Images = offer.Images.OrderBy(image => image.Order).Select(image => new PublicProfileImageDto
                {
                    Id = image.Id, Order = image.Order, Url = $"/api/v1/admin/moderation/offers/{offer.Id}/images/{image.Id}"
                }).ToArray()
            };
        }).ToArray();
    }

    private async Task<Dictionary<string, OwnerDetails>> GetOwnerDetailsAsync(string[] ownerIds, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (ownerIds.Length == 0) return [];
        var coordinatorRoleIds = context.Roles.Where(role => role.NormalizedName == ApplicationRoles.EventCoordinator.ToUpperInvariant()).Select(role => role.Id);
        var photographerRoleIds = context.Roles.Where(role => role.NormalizedName == ApplicationRoles.Photographer.ToUpperInvariant()).Select(role => role.Id);
        var rows = await context.Users.AsNoTracking().Where(user => ownerIds.Contains(user.Id)).Select(user => new OwnerRow
        {
            UserId = user.Id,
            CoordinatorName = context.CoordinatorProfiles.Where(profile => profile.UserId == user.Id)
                .Select(profile => profile.BusinessType == CoordinatorBusinessType.Shop ? profile.ShopName : profile.OnlineStoreName).FirstOrDefault(),
            PhotographerName = context.PhotographerProfiles.Where(profile => profile.UserId == user.Id && profile.HasStudio)
                .Select(profile => profile.StudioName).FirstOrDefault(),
            IsCoordinator = context.UserRoles.Any(userRole => userRole.UserId == user.Id && coordinatorRoleIds.Contains(userRole.RoleId)),
            IsPhotographer = context.UserRoles.Any(userRole => userRole.UserId == user.Id && photographerRoleIds.Contains(userRole.RoleId)),
            IsLocked = context.AccountLocks.Any(lockRow => lockRow.UserId == user.Id && lockRow.LiftedAt == null
                && lockRow.StartsAt <= now && now < lockRow.EndsAt)
        }).ToListAsync(cancellationToken);
        return rows.ToDictionary(row => row.UserId, row => new OwnerDetails(
            row.IsCoordinator ? row.CoordinatorName ?? PublicProfiles.DisplayNameFallback
                : row.PhotographerName ?? PublicProfiles.DisplayNameFallback,
            row.IsPhotographer ? ApplicationRoles.Photographer : ApplicationRoles.EventCoordinator,
            row.IsLocked), StringComparer.Ordinal);
    }

    private sealed class OwnerRow
    {
        public string UserId { get; init; } = string.Empty;
        public string? CoordinatorName { get; init; }
        public string? PhotographerName { get; init; }
        public bool IsCoordinator { get; init; }
        public bool IsPhotographer { get; init; }
        public bool IsLocked { get; init; }
    }

    private sealed record OwnerDetails(string DisplayName, string Role, bool IsLocked);
}
