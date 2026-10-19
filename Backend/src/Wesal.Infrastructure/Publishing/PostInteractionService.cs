using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Publishing;

public sealed class PostInteractionService(
    IPostInteractionRepository posts,
    ICurrentUserService currentUser,
    IUnitOfWork unitOfWork,
    UserManager<ApplicationUser> users,
    INotificationService notificationService,
    IUserNotificationWriter notificationWriter,
    INotificationDispatcher dispatcher,
    IDateTime clock,
    IAccountLockService? accountLocks = null) : IPostInteractionService
{
    private static readonly Regex Markup = new("<[^>]*>", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public async Task<PostCommentDto> CreateCommentAsync(Guid postId, CreatePostCommentRequest request, CancellationToken cancellationToken = default)
    {
        var actorId = RequireUser();
        if (accountLocks is not null) await accountLocks.EnsureUnlockedAsync(actorId, cancellationToken);
        var text = Sanitize(request.Text);
        var post = await posts.GetPublicPostAsync(postId, cancellationToken) ?? throw new NotFoundException("Post", postId);
        var comment = new PostComment { Id = Guid.NewGuid(), PostId = postId, AuthorUserId = actorId, Text = text, CreatedAt = clock.Now };
        var notificationKind = actorId == post.OwnerUserId ? null : await GetOwnerRoleKindAsync(post.OwnerUserId, cancellationToken);
        var displayName = await GetPublicNameAsync(actorId, cancellationToken);

        await unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            posts.AddComment(comment);
            if (notificationKind is { } kind)
                await AddDurableNotificationAsync(kind, post.OwnerUserId, displayName, postId, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);

        if (notificationKind is { } dispatchKind)
            await dispatcher.DispatchAsync(dispatchKind, post.OwnerUserId,
                new Dictionary<string, string?> { [NotificationTokens.CommenterName] = displayName }, postId.ToString(), cancellationToken);
        return await ToCommentDtoAsync(comment, cancellationToken);
    }

    public async Task<PostCommentDto> ReplyAsync(Guid postId, Guid commentId, CreatePostCommentRequest request, CancellationToken cancellationToken = default)
    {
        var actorId = RequireUser();
        if (accountLocks is not null) await accountLocks.EnsureUnlockedAsync(actorId, cancellationToken);
        var text = Sanitize(request.Text);
        var repliedTo = await posts.GetCommentAsync(commentId, tracking: false, cancellationToken)
            ?? throw new NotFoundException("Comment", commentId);
        if (repliedTo.PostId != postId) throw new NotFoundException("Comment", commentId);
        var post = await posts.GetPublicPostAsync(postId, cancellationToken) ?? throw new NotFoundException("Post", postId);
        var topLevelId = repliedTo.ParentCommentId ?? repliedTo.Id;
        var topLevel = repliedTo.ParentCommentId is null ? repliedTo : await posts.GetCommentAsync(topLevelId, tracking: false, cancellationToken)
            ?? throw new NotFoundException("Comment", topLevelId);
        if (topLevel.PostId != postId || topLevel.ParentCommentId is not null) throw new NotFoundException("Comment", topLevelId);
        var reply = new PostComment
        {
            Id = Guid.NewGuid(), PostId = postId, AuthorUserId = actorId,
            ParentCommentId = topLevelId, ReplyToCommentId = repliedTo.Id, Text = text, CreatedAt = clock.Now
        };
        NotificationKind? notificationKind = null;
        if (actorId != post.OwnerUserId && await IsProfessionalOwnerAsync(post.OwnerUserId))
            notificationKind = repliedTo.AuthorUserId == post.OwnerUserId
                ? NotificationKind.PostCommentReplyForOwner
                : NotificationKind.PostCommentReplyOnOwnerPost;
        var displayName = await GetPublicNameAsync(actorId, cancellationToken);

        await unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            posts.AddComment(reply);
            if (notificationKind is { } kind)
                await AddDurableNotificationAsync(kind, post.OwnerUserId, displayName, post.Id, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);

        if (notificationKind is { } dispatchKind)
            await dispatcher.DispatchAsync(dispatchKind, post.OwnerUserId,
                new Dictionary<string, string?> { [NotificationTokens.CommenterName] = displayName }, post.Id.ToString(), cancellationToken);
        return await ToCommentDtoAsync(reply, cancellationToken);
    }

    public async Task<PagedResult<PostCommentDto>> ListCommentsAsync(Guid postId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        if (await posts.GetPublicPostAsync(postId, cancellationToken) is null) throw new NotFoundException("Post", postId);
        var window = PageWindow(page, pageSize);
        var comments = await posts.ListTopLevelCommentsAsync(postId, window.Skip, window.Size, cancellationToken);
        var result = new List<PostCommentDto>(comments.Count);
        foreach (var row in comments) result.Add(await ToCommentDtoAsync(row, cancellationToken));
        return PagedResult<PostCommentDto>.Create(result, window.Page, window.Size,
            await posts.CountTopLevelCommentsAsync(postId, cancellationToken));
    }

    public async Task<PagedResult<PostCommentDto>> ListRepliesAsync(Guid postId, Guid commentId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var comment = await posts.GetCommentAsync(commentId, tracking: false, cancellationToken)
            ?? throw new NotFoundException("Comment", commentId);
        var rootId = comment.ParentCommentId ?? comment.Id;
        var root = await posts.GetCommentAsync(rootId, tracking: false, cancellationToken)
            ?? throw new NotFoundException("Comment", rootId);
        if (root.PostId != postId || root.ParentCommentId is not null) throw new NotFoundException("Comment", commentId);
        if (await posts.GetPublicPostAsync(postId, cancellationToken) is null) throw new NotFoundException("Post", postId);
        var window = PageWindow(page, pageSize);
        var replies = await posts.ListRepliesAsync(rootId, window.Skip, window.Size, cancellationToken);
        var result = new List<PostCommentDto>(replies.Count);
        foreach (var row in replies) result.Add(await ToCommentDtoAsync(row, cancellationToken));
        return PagedResult<PostCommentDto>.Create(result, window.Page, window.Size,
            await posts.CountRepliesAsync(rootId, cancellationToken));
    }

    public async Task DeleteCommentAsync(Guid postId, Guid commentId, CancellationToken cancellationToken = default)
    {
        var actorId = RequireUser();
        var row = await posts.GetCommentAsync(commentId, tracking: true, cancellationToken)
            ?? throw new NotFoundException("Comment", commentId);
        if (row.PostId != postId) throw new NotFoundException("Comment", commentId);
        if (row.AuthorUserId != actorId) throw new ForbiddenException("You can delete only your own comments.");
        await unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            if (row.ParentCommentId is null)
                posts.RemoveComments(await posts.ListRepliesForDeleteAsync(row.Id, cancellationToken));
            posts.RemoveComment(row);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);
    }

    public async Task AddFavoriteAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        var actorId = RequireUser();
        if (await posts.GetPublicPostAsync(postId, cancellationToken) is null) throw new NotFoundException("Post", postId);
        await unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await posts.AddFavoriteAndIncrementAsync(actorId, postId, clock.Now, cancellationToken);
        }, cancellationToken);
    }

    public async Task RemoveFavoriteAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        var actorId = RequireUser();
        await unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await posts.RemoveFavoriteAndDecrementAsync(actorId, postId, cancellationToken);
        }, cancellationToken);
    }

    public async Task<PagedResult<FavoritePostDto>> ListFavoritesAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var actorId = RequireUser();
        var window = PageWindow(page, pageSize);
        var favorites = await posts.ListVisibleFavoritesAsync(actorId, window.Skip, window.Size, cancellationToken);
        var result = new List<FavoritePostDto>(favorites.Count);
        foreach (var row in favorites)
        {
            var owner = await posts.GetAuthorPublicDataAsync(row.Post.OwnerUserId, cancellationToken);
            result.Add(new FavoritePostDto
            {
                Id = row.Post.Id, OwnerUserId = row.Post.OwnerUserId, OwnerName = await PublicNameAsync(owner),
                OwnerAvatarUrl = owner?.ProfilePictureUrl, Content = row.Post.Content, Price = row.Post.Price,
                SaveCount = row.Post.SaveCount, SavedAt = row.Favorite.CreatedAt,
                Images = row.Post.Images.OrderBy(image => image.Order).Select(image => new PublicProfileImageDto
                {
                    Id = image.Id, Order = image.Order, Url = $"/api/v1/posts/{row.Post.Id}/images/{image.Id}"
                }).ToArray()
            });
        }
        return PagedResult<FavoritePostDto>.Create(result, window.Page, window.Size,
            await posts.CountVisibleFavoritesAsync(actorId, cancellationToken));
    }

    private async Task<NotificationKind?> GetOwnerRoleKindAsync(string ownerId, CancellationToken ct)
    {
        var owner = await users.FindByIdAsync(ownerId) ?? throw new NotFoundException("User", ownerId);
        var roles = await users.GetRolesAsync(owner);
        if (roles.Contains(ApplicationRoles.Photographer)) return NotificationKind.PostCommentedForPhotographer;
        if (roles.Contains(ApplicationRoles.EventCoordinator)) return NotificationKind.PostCommentedForCoordinator;
        return null;
    }

    private async Task<bool> IsProfessionalOwnerAsync(string ownerId)
    {
        var owner = await users.FindByIdAsync(ownerId);
        if (owner is null) return false;
        var roles = await users.GetRolesAsync(owner);
        return roles.Contains(ApplicationRoles.Photographer) || roles.Contains(ApplicationRoles.EventCoordinator);
    }

    private async Task AddDurableNotificationAsync(NotificationKind kind, string ownerId, string commenterName, Guid postId, CancellationToken ct)
    {
        var content = await notificationService.BuildAsync(kind, ownerId,
            new Dictionary<string, string?> { [NotificationTokens.CommenterName] = commenterName }, postId.ToString(), ct);
        await notificationWriter.AddAsync(new UserNotification
        {
            Id = Guid.NewGuid(), RecipientUserId = ownerId, Kind = kind,
            Language = SupportedLanguages.ToCode(content.Language), Title = content.Title, Body = content.Body,
            ActionLabel = content.ActionLabel, ActionTarget = content.ActionTarget, TargetId = content.TargetId, CreatedAt = clock.Now
        }, ct);
    }

    private async Task<string> GetPublicNameAsync(string userId, CancellationToken ct)
        => await PublicNameAsync(await posts.GetAuthorPublicDataAsync(userId, ct));

    private async Task<PostCommentDto> ToCommentDtoAsync(PostComment row, CancellationToken ct)
    {
        var author = await posts.GetAuthorPublicDataAsync(row.AuthorUserId, ct);
        return new PostCommentDto
        {
            Id = row.Id, PostId = row.PostId, Text = row.Text, AuthorUserId = row.AuthorUserId,
            AuthorName = await PublicNameAsync(author), AuthorAvatarUrl = author?.ProfilePictureUrl,
            ParentCommentId = row.ParentCommentId, ReplyToCommentId = row.ReplyToCommentId,
            ReplyCount = row.ParentCommentId is null ? await posts.CountRepliesAsync(row.Id, ct) : 0, CreatedAt = row.CreatedAt
        };
    }

    private async Task<string> PublicNameAsync(PostAuthorPublicData? author)
    {
        if (author is null) return PublicProfiles.DisplayNameFallback;
        if (!string.IsNullOrWhiteSpace(author.CoordinatorBusinessName)) return author.CoordinatorBusinessName;
        if (!string.IsNullOrWhiteSpace(author.PhotographerStudioName)) return author.PhotographerStudioName;
        var user = await users.FindByIdAsync(author.UserId);
        if (user is null) return PublicProfiles.DisplayNameFallback;
        var roles = await users.GetRolesAsync(user);
        return roles.Contains(ApplicationRoles.Photographer) || roles.Contains(ApplicationRoles.EventCoordinator)
            ? PublicProfiles.DisplayNameFallback
            : author.FullName ?? PublicProfiles.DisplayNameFallback;
    }

    private string RequireUser()
    {
        if (!currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(currentUser.UserId)) throw new UnauthorizedException("You must be logged in.");
        return currentUser.UserId;
    }

    private static string Sanitize(string? text)
    {
        var plain = Markup.Replace(text ?? string.Empty, " ");
        var safe = new string(plain.Where(ch => !char.IsControl(ch)).ToArray());
        var cleaned = string.Join(" ", safe.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).Trim();
        if (cleaned.Length == 0) throw new ValidationException("Comment text is required.");
        if (cleaned.Length > PostCommentLimits.MaxTextLength) throw new ValidationException($"Comment text must not exceed {PostCommentLimits.MaxTextLength} characters.");
        return cleaned;
    }

    private static (int Page, int Size, int Skip) PageWindow(int page, int pageSize)
    {
        var normalizedPage = page <= 0 ? 1 : page;
        var normalizedSize = pageSize <= 0 ? 10 : Math.Min(pageSize, 100);
        return (normalizedPage, normalizedSize, (normalizedPage - 1) * normalizedSize);
    }
}
