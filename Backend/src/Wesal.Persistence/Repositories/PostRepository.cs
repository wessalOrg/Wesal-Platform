using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class PostRepository(ApplicationDbContext context) : IPostRepository
{
    public async Task AddAsync(Post post, CancellationToken cancellationToken = default)
        => await context.Posts.AddAsync(post, cancellationToken);

    public void AddImage(PostImage image) => context.PostImages.Add(image);

    public Task<Post?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken = default)
        => context.Posts.Include(post => post.Images).FirstOrDefaultAsync(post => post.Id == id, cancellationToken);

    public Task<Post?> GetPublicAsync(Guid id, CancellationToken cancellationToken = default)
        => context.Posts.AsNoTracking().Include(post => post.Images)
            .Where(post => context.Users.Any(user => user.Id == post.OwnerUserId && user.ApprovalStatus == AccountApprovalStatus.Approved))
            .FirstOrDefaultAsync(post => post.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Post>> ListPublicByOwnerAsync(string ownerId, int skip, int take, CancellationToken cancellationToken = default)
        => await PublicPosts(ownerId).Include(post => post.Images)
            .OrderByDescending(post => post.CreatedAt).ThenBy(post => post.Id)
            .Skip(skip).Take(take).ToListAsync(cancellationToken);

    public Task<int> CountPublicByOwnerAsync(string ownerId, CancellationToken cancellationToken = default)
        => PublicPosts(ownerId).CountAsync(cancellationToken);

    public async Task<bool> RegisterShareAsync(Guid postId, string userId, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        if (context.Database.ProviderName?.Contains("Npgsql", StringComparison.Ordinal) == true)
        {
            var lockKey = $"post-share:{userId}:{postId:N}";
            await context.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({lockKey}))", cancellationToken);
        }
        var day = DateOnly.FromDateTime(now.UtcDateTime);
        var cutoff = now.AddHours(-24);
        var exists = await context.PostShares.AnyAsync(share => share.PostId == postId && share.UserId == userId
            && (share.UtcDate == day || share.CreatedAt > cutoff), cancellationToken);
        if (exists) return false;
        context.PostShares.Add(new PostShare { PostId = postId, UserId = userId, UtcDate = day, CreatedAt = now });
        await context.SaveChangesAsync(cancellationToken);
        var publicPosts = context.Posts.Where(post => post.Id == postId);
        if (context.Database.IsRelational())
        {
            await publicPosts.ExecuteUpdateAsync(update => update.SetProperty(post => post.ShareCount, post => post.ShareCount + 1), cancellationToken);
        }
        else
        {
            var post = await publicPosts.FirstAsync(cancellationToken);
            post.ShareCount++;
            await context.SaveChangesAsync(cancellationToken);
        }
        return true;
    }

    private IQueryable<Post> PublicPosts(string ownerId)
        => context.Posts.AsNoTracking().Where(post => post.OwnerUserId == ownerId
            && context.Users.Any(user => user.Id == ownerId && user.ApprovalStatus == AccountApprovalStatus.Approved));
}
