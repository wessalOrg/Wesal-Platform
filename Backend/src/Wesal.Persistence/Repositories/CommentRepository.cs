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

    public async Task<IReadOnlyList<CommentResponse>> ListByHallAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        return await (
            from comment in _context.Comments.AsNoTracking()
            join user in _context.Users.AsNoTracking() on comment.UserId equals user.Id into users
            from user in users.DefaultIfEmpty()
            where comment.HallId == hallId
            orderby comment.CreatedAt descending
            select new CommentResponse
            {
                CommentId = comment.Id,
                HallId = comment.HallId,
                Author = user != null
                    ? (string.IsNullOrWhiteSpace(user.FullName) ? user.UserName ?? "مستخدم" : user.FullName)
                    : "مستخدم",
                Body = comment.Body,
                CreatedAt = comment.CreatedAt
            }).ToListAsync(cancellationToken);
    }
}
