using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class CommentRepository : ICommentRepository
{
    private readonly ApplicationDbContext _context;

    public CommentRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(Comment comment, CancellationToken cancellationToken = default)
    {
        await _context.Comments.AddAsync(comment, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Comment>> GetByHallIdAsync(Guid hallId, CancellationToken cancellationToken = default)
    {
        // Soft-deleted comments never appear in normal retrieval (Edit 22).
        return await _context.Comments
            .AsNoTracking()
            .Where(c => c.HallId == hallId && !c.IsDeleted)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public Task<Comment?> GetByIdAsync(Guid commentId, CancellationToken cancellationToken = default)
        => _context.Comments
            .FirstOrDefaultAsync(c => c.Id == commentId && !c.IsDeleted, cancellationToken);

    public async Task<IReadOnlyList<CommentAuthorRow>> GetByHallIdWithAuthorsAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        // One left-join query: every comment with its author's profile name/picture,
        // so listing never pays a per-comment user lookup (Edit 22). A comment whose
        // author row is gone keeps its content with a null name, letting the service
        // fall back to the sign-in name rather than a generic placeholder.
        return await (
            from comment in _context.Comments.AsNoTracking()
            join author in _context.Users.AsNoTracking()
                on comment.UserId equals author.Id into authorJoin
            from author in authorJoin.DefaultIfEmpty()
            where comment.HallId == hallId && !comment.IsDeleted
            orderby comment.CreatedAt descending
            select new CommentAuthorRow
            {
                CommentId = comment.Id,
                HallId = comment.HallId,
                Content = comment.Content,
                AuthorUserId = comment.UserId,
                AuthorFullName = author != null ? author.FullName : null,
                AuthorProfilePictureUrl = author != null ? author.ProfilePictureUrl : null,
                CreatedAt = comment.CreatedAt
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<CommentAuthorDisplay?> GetAuthorDisplayAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        return await _context.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => new CommentAuthorDisplay
            {
                UserId = user.Id,
                FullName = user.FullName,
                ProfilePictureUrl = user.ProfilePictureUrl
            })
            .FirstOrDefaultAsync(cancellationToken);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        => _context.SaveChangesAsync(cancellationToken);
}
