using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Comments;

public sealed class CommentService : ICommentService
{
    private readonly ICommentRepository _commentRepository;
    private readonly IHallRepository _hallRepository;
    private readonly ICurrentUserService _currentUser;

    public CommentService(
        ICommentRepository commentRepository,
        IHallRepository hallRepository,
        ICurrentUserService currentUser)
    {
        _commentRepository = commentRepository;
        _hallRepository = hallRepository;
        _currentUser = currentUser;
    }

    public async Task<CommentResponse> CreateCommentAsync(
        CreateCommentRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        EnsureCanComment();

        var hall = await RequireApprovedHallAsync(request.HallId, cancellationToken);
        var body = request.Body.Trim();
        var comment = new Comment
        {
            HallId = hall.Id,
            UserId = _currentUser.UserId!,
            Body = body
        };

        await _commentRepository.AddAsync(comment, cancellationToken);

        return new CommentResponse
        {
            CommentId = comment.Id,
            HallId = comment.HallId,
            Author = ResolveAuthorName(),
            Body = comment.Body,
            CreatedAt = comment.CreatedAt
        };
    }

    public async Task<IReadOnlyList<CommentResponse>> GetHallCommentsAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var hall = await RequireApprovedHallAsync(hallId, cancellationToken);
        return await _commentRepository.ListByHallAsync(hall.Id, cancellationToken);
    }

    private async Task<Hall> RequireApprovedHallAsync(Guid hallId, CancellationToken cancellationToken)
    {
        var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken);
        if (hall is null || hall.IsDeleted || hall.Status != HallStatus.Approved)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        return hall;
    }

    private void EnsureCanComment()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to comment on a hall.");
        }

        if (_currentUser.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Hall owners cannot comment on halls.");
        }

        if (!_currentUser.Roles.Contains(ApplicationRoles.RegisteredUser, StringComparer.OrdinalIgnoreCase)
            && !_currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only registered users can comment on halls.");
        }
    }

    private string ResolveAuthorName()
    {
        if (!string.IsNullOrWhiteSpace(_currentUser.UserName))
        {
            return _currentUser.UserName;
        }

        return "مستخدم";
    }
}
