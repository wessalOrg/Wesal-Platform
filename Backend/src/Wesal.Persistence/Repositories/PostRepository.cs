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

    private IQueryable<Post> PublicPosts(string ownerId)
        => context.Posts.AsNoTracking().Where(post => post.OwnerUserId == ownerId
            && context.Users.Any(user => user.Id == ownerId && user.ApprovalStatus == AccountApprovalStatus.Approved));
}
