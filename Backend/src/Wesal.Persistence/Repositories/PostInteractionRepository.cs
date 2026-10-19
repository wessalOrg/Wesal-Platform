using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Persistence.Data;
using Wesal.Persistence.Queries;

namespace Wesal.Persistence.Repositories;

public sealed class PostInteractionRepository : IPostInteractionRepository
{
    private readonly ApplicationDbContext db;
    private readonly TimeProvider clock;

    public PostInteractionRepository(ApplicationDbContext db, TimeProvider? clock = null)
    {
        this.db = db;
        this.clock = clock ?? TimeProvider.System;
    }

    public Task<Post?> GetPublicPostAsync(Guid postId, CancellationToken cancellationToken = default)
        => db.Posts.AsNoTracking().FirstOrDefaultAsync(post => post.Id == postId
            && db.Users.VisibleToPublic(db, clock.GetUtcNow()).Any(owner => owner.Id == post.OwnerUserId), cancellationToken);

    public Task<PostComment?> GetCommentAsync(Guid commentId, bool tracking, CancellationToken cancellationToken = default)
    {
        var query = db.PostComments.AsQueryable();
        if (!tracking) query = query.AsNoTracking();
        return query.FirstOrDefaultAsync(comment => comment.Id == commentId, cancellationToken);
    }

    public void AddComment(PostComment comment) => db.PostComments.Add(comment);
    public void RemoveComment(PostComment comment) => db.PostComments.Remove(comment);
    public void RemoveComments(IEnumerable<PostComment> comments) => db.PostComments.RemoveRange(comments);

    public async Task<IReadOnlyList<PostComment>> ListTopLevelCommentsAsync(Guid postId, int skip, int take, CancellationToken cancellationToken = default)
        => await db.PostComments.AsNoTracking().Where(row => row.PostId == postId && row.ParentCommentId == null)
            .OrderByDescending(row => row.CreatedAt).ThenByDescending(row => row.Id).Skip(skip).Take(take).ToListAsync(cancellationToken);

    public Task<int> CountTopLevelCommentsAsync(Guid postId, CancellationToken cancellationToken = default)
        => db.PostComments.CountAsync(row => row.PostId == postId && row.ParentCommentId == null, cancellationToken);

    public async Task<IReadOnlyList<PostComment>> ListRepliesAsync(Guid rootCommentId, int skip, int take, CancellationToken cancellationToken = default)
        => await db.PostComments.AsNoTracking().Where(row => row.ParentCommentId == rootCommentId)
            .OrderBy(row => row.CreatedAt).ThenBy(row => row.Id).Skip(skip).Take(take).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<PostComment>> ListRepliesForDeleteAsync(Guid rootCommentId, CancellationToken cancellationToken = default)
        => await db.PostComments.Where(row => row.ParentCommentId == rootCommentId).ToListAsync(cancellationToken);

    public Task<int> CountRepliesAsync(Guid rootCommentId, CancellationToken cancellationToken = default)
        => db.PostComments.CountAsync(row => row.ParentCommentId == rootCommentId, cancellationToken);

    public Task<PostAuthorPublicData?> GetAuthorPublicDataAsync(string userId, CancellationToken cancellationToken = default)
        => db.Users.AsNoTracking().Where(user => user.Id == userId).Select(user => new PostAuthorPublicData
        {
            UserId = user.Id, FullName = user.FullName, ProfilePictureUrl = user.ProfilePictureUrl,
            CoordinatorBusinessName = db.CoordinatorProfiles.Where(profile => profile.UserId == userId)
                .Select(profile => profile.BusinessType == CoordinatorBusinessType.Shop ? profile.ShopName : profile.OnlineStoreName).FirstOrDefault(),
            PhotographerStudioName = db.PhotographerProfiles.Where(profile => profile.UserId == userId && profile.HasStudio)
                .Select(profile => profile.StudioName).FirstOrDefault()
        }).FirstOrDefaultAsync(cancellationToken);

    public async Task<int> AddFavoriteAndIncrementAsync(string userId, Guid postId, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        if (!db.Database.IsRelational())
        {
            if (await db.PostFavorites.AnyAsync(row => row.UserId == userId && row.PostId == postId, cancellationToken)) return 0;
            db.PostFavorites.Add(new PostFavorite { Id = Guid.NewGuid(), UserId = userId, PostId = postId, CreatedAt = now });
            var post = await db.Posts.FirstAsync(row => row.Id == postId, cancellationToken);
            post.SaveCount++;
            await db.SaveChangesAsync(cancellationToken);
            return 1;
        }
        var inserted = await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"wesal\".\"PostFavorites\" (\"Id\", \"UserId\", \"PostId\", \"CreatedAt\") VALUES ({Guid.NewGuid()}, {userId}, {postId}, {now}) ON CONFLICT (\"UserId\", \"PostId\") DO NOTHING", cancellationToken);
        if (inserted > 0)
            await db.Posts.Where(post => post.Id == postId).ExecuteUpdateAsync(setters => setters.SetProperty(post => post.SaveCount, post => post.SaveCount + 1), cancellationToken);
        return inserted;
    }

    public async Task<int> RemoveFavoriteAndDecrementAsync(string userId, Guid postId, CancellationToken cancellationToken = default)
    {
        if (!db.Database.IsRelational())
        {
            var favorite = await db.PostFavorites.FirstOrDefaultAsync(row => row.UserId == userId && row.PostId == postId, cancellationToken);
            if (favorite is null) return 0;
            db.PostFavorites.Remove(favorite);
            var post = await db.Posts.FirstOrDefaultAsync(row => row.Id == postId, cancellationToken);
            if (post is not null) post.SaveCount = Math.Max(0, post.SaveCount - 1);
            await db.SaveChangesAsync(cancellationToken);
            return 1;
        }
        var deleted = await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM \"wesal\".\"PostFavorites\" WHERE \"UserId\" = {userId} AND \"PostId\" = {postId}", cancellationToken);
        if (deleted > 0)
            await db.Posts.Where(post => post.Id == postId).ExecuteUpdateAsync(setters => setters.SetProperty(post => post.SaveCount, post => post.SaveCount > 0 ? post.SaveCount - 1 : 0), cancellationToken);
        return deleted;
    }

    public async Task<IReadOnlyList<PostFavoriteWithPost>> ListVisibleFavoritesAsync(string userId, int skip, int take, CancellationToken cancellationToken = default)
    {
        var rows = await VisibleFavorites(userId).OrderByDescending(row => row.CreatedAt).ThenByDescending(row => row.PostId)
            .Skip(skip).Take(take).ToListAsync(cancellationToken);
        var results = new List<PostFavoriteWithPost>(rows.Count);
        foreach (var favorite in rows)
        {
            var post = await db.Posts.AsNoTracking().Include(row => row.Images).FirstAsync(row => row.Id == favorite.PostId, cancellationToken);
            results.Add(new PostFavoriteWithPost(favorite, post));
        }
        return results;
    }

    public Task<int> CountVisibleFavoritesAsync(string userId, CancellationToken cancellationToken = default)
        => VisibleFavorites(userId).CountAsync(cancellationToken);

    private IQueryable<PostFavorite> VisibleFavorites(string userId)
        => db.PostFavorites.AsNoTracking().Where(favorite => favorite.UserId == userId
            && db.Posts.Any(post => post.Id == favorite.PostId
                && db.Users.VisibleToPublic(db, clock.GetUtcNow()).Any(owner => owner.Id == post.OwnerUserId)));
}
