using System.Web;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
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

        EnsureAuthenticated();
        EnsureNotHallOwner();
        EnsureRegisteredUser();

        var hall = await _hallRepository.GetHallByIdAsync(request.HallId, cancellationToken);

        if (hall is null || hall.IsDeleted || hall.Status != HallStatus.Approved)
        {
            throw new NotFoundException(nameof(Hall), request.HallId);
        }

        ValidateContent(request.Content);

        var sanitizedContent = SanitizeContent(request.Content);

        var comment = new Comment
        {
            HallId = request.HallId,
            UserId = _currentUser.UserId!,
            Content = sanitizedContent
        };

        await _commentRepository.AddAsync(comment, cancellationToken);

        return new CommentResponse
        {
            CommentId = comment.Id,
            HallId = comment.HallId,
            Content = comment.Content,
            UserName = _currentUser.UserName ?? string.Empty,
            CreatedAt = comment.CreatedAt
        };
    }

    public async Task<IReadOnlyList<CommentResponse>> GetHallCommentsAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken);

        if (hall is null || hall.IsDeleted || hall.Status != HallStatus.Approved)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        var comments = await _commentRepository.GetByHallIdAsync(hallId, cancellationToken);

        return comments.Select(c => new CommentResponse
        {
            CommentId = c.Id,
            HallId = c.HallId,
            Content = c.Content,
            UserName = string.Empty,
            CreatedAt = c.CreatedAt
        }).ToList();
    }

    private static string SanitizeContent(string content)
    {
        var trimmed = content.Trim();
        var sanitized = HttpUtility.HtmlEncode(trimmed);
        return sanitized;
    }

    private static void ValidateContent(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                { "Content", ["Comment content cannot be empty."] }
            });
        }

        if (content.Trim().Length > CreateCommentRequestValidator.MaxContentLength)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                { "Content", [$"Comment content cannot exceed {CreateCommentRequestValidator.MaxContentLength} characters."] }
            });
        }
    }

    private void EnsureAuthenticated()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to comment on a hall.");
        }
    }

    private void EnsureNotHallOwner()
    {
        if (_currentUser.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Hall owners cannot comment on halls.");
        }
    }

    private void EnsureRegisteredUser()
    {
        if (!_currentUser.Roles.Contains(ApplicationRoles.RegisteredUser, StringComparer.OrdinalIgnoreCase)
            && !_currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only registered users can comment on halls.");
        }
    }
}
