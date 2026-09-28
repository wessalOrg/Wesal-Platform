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

        // Edit 22: attribute to the persisted profile, not the token claim, so the
        // response carries the real display name (and picture when set).
        var author = await _commentRepository.GetAuthorDisplayAsync(comment.UserId, cancellationToken);

        return new CommentResponse
        {
            CommentId = comment.Id,
            HallId = comment.HallId,
            Content = comment.Content,
            UserId = comment.UserId,
            UserName = ResolveAuthorName(author, _currentUser.UserName),
            UserProfilePictureUrl = author?.ProfilePictureUrl,
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

        var rows = await _commentRepository.GetByHallIdWithAuthorsAsync(hallId, cancellationToken);

        return rows.Select(row => new CommentResponse
        {
            CommentId = row.CommentId,
            HallId = row.HallId,
            Content = row.Content,
            UserId = row.AuthorUserId,
            UserName = ResolveAuthorName(row.AuthorFullName, row.AuthorUserId),
            UserProfilePictureUrl = row.AuthorProfilePictureUrl,
            CreatedAt = row.CreatedAt
        }).ToList();
    }

    /// <summary>
    /// Author-owned comment edit (Edit 22): only the comment's author may change its
    /// content, validated and sanitized with the exact creation rules.
    /// </summary>
    public async Task<CommentResponse> UpdateCommentAsync(
        Guid commentId,
        UpdateCommentRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticated();

        if (request is null)
        {
            throw new ValidationException("Comment content is required.");
        }

        var comment = await _commentRepository.GetByIdAsync(commentId, cancellationToken);

        if (comment is null)
        {
            throw new NotFoundException(nameof(Comment), commentId);
        }

        EnsureIsAuthor(comment);

        ValidateContent(request.Content);

        comment.Content = SanitizeContent(request.Content);
        comment.UpdatedAt = DateTimeOffset.UtcNow;

        await _commentRepository.SaveChangesAsync(cancellationToken);

        var author = await _commentRepository.GetAuthorDisplayAsync(comment.UserId, cancellationToken);

        return new CommentResponse
        {
            CommentId = comment.Id,
            HallId = comment.HallId,
            Content = comment.Content,
            UserId = comment.UserId,
            UserName = ResolveAuthorName(author, _currentUser.UserName),
            UserProfilePictureUrl = author?.ProfilePictureUrl,
            CreatedAt = comment.CreatedAt
        };
    }

    /// <summary>
    /// Author-owned comment deletion (Edit 22): soft-deletes so the comment disappears
    /// from normal retrieval while history is preserved, matching the
    /// <see cref="HallImage"/> convention.
    /// </summary>
    public async Task DeleteCommentAsync(
        Guid commentId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticated();

        var comment = await _commentRepository.GetByIdAsync(commentId, cancellationToken);

        if (comment is null)
        {
            throw new NotFoundException(nameof(Comment), commentId);
        }

        EnsureIsAuthor(comment);

        comment.IsDeleted = true;
        comment.UpdatedAt = DateTimeOffset.UtcNow;

        await _commentRepository.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Resolves the displayed author name (Edit 22): the persisted profile name when it
    /// exists, otherwise the given fallback (sign-in name or user id). A generic
    /// placeholder is never substituted while real profile information exists.
    /// </summary>
    private static string ResolveAuthorName(CommentAuthorDisplay? author, string? fallback)
        => !string.IsNullOrWhiteSpace(author?.FullName)
            ? author.FullName
            : fallback ?? string.Empty;

    private static string ResolveAuthorName(string? profileFullName, string? fallback)
        => !string.IsNullOrWhiteSpace(profileFullName)
            ? profileFullName
            : fallback ?? string.Empty;

    private void EnsureIsAuthor(Comment comment)
    {
        if (!string.Equals(comment.UserId, _currentUser.UserId, StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only the comment author can modify this comment.");
        }
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
