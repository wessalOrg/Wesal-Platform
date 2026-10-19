using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Services;

/// <summary>Counts accepted detail-view requests as events; it does not infer unique people.</summary>
public sealed class StatisticsService(ApplicationDbContext db, ICurrentUserService currentUser, TimeProvider clock) : IStatisticsService
{
    private const int MaxPageSize = 50;

    public async Task RecordPostViewAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        var post = await (from row in db.Posts.AsNoTracking()
            join owner in ApprovedProfessionals() on row.OwnerUserId equals owner.Id
            where row.Id == postId
            select new { row.Id, row.OwnerUserId }).SingleOrDefaultAsync(cancellationToken);
        if (post is null) return;
        db.ContentViewEvents.Add(new Domain.Entities.ContentViewEvent
        {
            OwnerUserId = post.OwnerUserId, PostId = post.Id, ViewedAt = clock.GetUtcNow()
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task RecordProfileViewAsync(string profileUserId, CancellationToken cancellationToken = default)
    {
        var ownerId = await ApprovedProfessionals().Where(user => user.Id == profileUserId)
            .Select(user => user.Id).SingleOrDefaultAsync(cancellationToken);
        if (ownerId is null) return; // A non-public self-profile response is not a public view.
        db.ContentViewEvents.Add(new Domain.Entities.ContentViewEvent
        {
            OwnerUserId = ownerId, ProfileUserId = ownerId, ViewedAt = clock.GetUtcNow()
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<OwnerStatisticsDto> GetMyStatisticsAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        if (!currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(currentUser.UserId))
            throw new UnauthorizedException("You must be logged in to view statistics.");
        if (page is < 1 or > 1000 || pageSize is < 1 or > MaxPageSize || (long)(page - 1) * pageSize + pageSize > int.MaxValue)
            throw new ValidationException($"Page must be between 1 and 1000 and page size must be between 1 and {MaxPageSize}.");

        var userId = currentUser.UserId;
        var isProfessional = await ApprovedProfessionals().AnyAsync(user => user.Id == userId, cancellationToken)
            || await ProfessionalUsers().AnyAsync(user => user.Id == userId, cancellationToken);
        if (!isProfessional) throw new ForbiddenException("Statistics are available only to professional account owners.");

        var posts = db.Posts.AsNoTracking().Where(post => post.OwnerUserId == userId);
        var total = await posts.CountAsync(cancellationToken);
        var allPostIds = posts.Select(post => post.Id);
        var totalSaves = await posts.SumAsync(post => (long)post.SaveCount, cancellationToken);
        var totalShares = await posts.SumAsync(post => (long)post.ShareCount, cancellationToken);
        var totalPostViews = await db.ContentViewEvents.CountAsync(view => view.PostId != null && allPostIds.Contains(view.PostId.Value), cancellationToken);
        var profileViews = await db.ContentViewEvents.CountAsync(view => view.ProfileUserId == userId, cancellationToken);
        var pagePosts = await posts.OrderByDescending(post => post.CreatedAt).ThenBy(post => post.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(post => new PostStatisticsItemDto
            {
                PostId = post.Id, Content = post.Content, SaveCount = post.SaveCount, ShareCount = post.ShareCount,
                ViewCount = db.ContentViewEvents.Count(view => view.PostId == post.Id)
            }).ToListAsync(cancellationToken);

        return new OwnerStatisticsDto
        {
            PageNumber = page, PageSize = pageSize, TotalPosts = total, ProfileViewCount = profileViews,
            TotalSaveCount = (int)Math.Min(totalSaves, int.MaxValue), TotalShareCount = (int)Math.Min(totalShares, int.MaxValue),
            TotalPostViewCount = totalPostViews, Posts = pagePosts
        };
    }

    private IQueryable<ApplicationUser> ProfessionalUsers()
    {
        var roleIds = db.Roles.Where(role => role.NormalizedName == ApplicationRoles.EventCoordinator.ToUpperInvariant()
            || role.NormalizedName == ApplicationRoles.Photographer.ToUpperInvariant()).Select(role => role.Id);
        var ids = db.UserRoles.Where(userRole => roleIds.Contains(userRole.RoleId)).Select(userRole => userRole.UserId);
        return db.Users.AsNoTracking().Where(user => ids.Contains(user.Id));
    }

    private IQueryable<ApplicationUser> ApprovedProfessionals()
        => ProfessionalUsers().Where(user => user.ApprovalStatus == Domain.Enums.AccountApprovalStatus.Approved);
}
