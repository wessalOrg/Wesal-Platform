using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Identity;
using ValidationException = Wesal.Domain.Exceptions.ValidationException;

namespace Wesal.Infrastructure.Publishing;

public sealed class PostService : IPostService
{
    private readonly ICurrentUserService _currentUser;
    private readonly IAccountApprovalGuard _approval;
    private readonly IUserContentPublishingRestrictionService _restrictions;
    private readonly UserManager<ApplicationUser> _users;
    private readonly IPostRepository _posts;
    private readonly IIdentityDocumentStore _files;
    private readonly IUnitOfWork _unitOfWork;
    private readonly INotificationService _notifications;
    private readonly IUserNotificationWriter _notificationWriter;
    private readonly INotificationDispatcher _dispatcher;
    private readonly IValidator<CreatePostRequest> _createValidator;
    private readonly IValidator<UpdatePostRequest> _updateValidator;
    private readonly TimeProvider _clock;

    public PostService(ICurrentUserService currentUser, IAccountApprovalGuard approval,
        IUserContentPublishingRestrictionService restrictions, UserManager<ApplicationUser> users,
        IPostRepository posts, IIdentityDocumentStore files, IUnitOfWork unitOfWork,
        INotificationService notifications, IUserNotificationWriter notificationWriter,
        INotificationDispatcher dispatcher, IValidator<CreatePostRequest> createValidator,
        IValidator<UpdatePostRequest> updateValidator, TimeProvider clock)
    {
        _currentUser = currentUser; _approval = approval; _restrictions = restrictions; _users = users;
        _posts = posts; _files = files; _unitOfWork = unitOfWork; _notifications = notifications;
        _notificationWriter = notificationWriter; _dispatcher = dispatcher;
        _createValidator = createValidator; _updateValidator = updateValidator; _clock = clock;
    }

    public async Task<Guid> CreateAsync(CreatePostRequest request, CancellationToken cancellationToken = default)
    {
        await PublishingContentHelper.ValidateAsync(_createValidator, request, cancellationToken);
        var owner = await RequirePublisherAsync(cancellationToken);
        var content = PublishingContentHelper.SanitizeText(request.Content);
        if (content is null && request.Images.Count == 0) throw new ValidationException("A post must include an image or non-empty text.");
        var stored = await PublishingContentHelper.SaveImagesAsync(owner.Id, request.Images, _files, cancellationToken);
        var post = new Post { OwnerUserId = owner.Id, Content = content, Price = request.Price, CreatedAt = _clock.GetUtcNow() };
        post.Images = stored.Select((image, index) => new PostImage
        {
            PostId = post.Id, Order = index, StorageKey = image.Key, ContentType = image.ContentType
        }).ToList();
        try
        {
            await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                await _posts.AddAsync(post, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }, cancellationToken);
        }
        catch
        {
            await PublishingContentHelper.DeleteImagesAsync(stored.Select(image => image.Key), _files);
            throw;
        }
        return post.Id;
    }

    public async Task UpdateAsync(Guid postId, UpdatePostRequest request, CancellationToken cancellationToken = default)
    {
        await PublishingContentHelper.ValidateAsync(_updateValidator, request, cancellationToken);
        var owner = await RequirePublisherAsync(cancellationToken);
        var post = await _posts.GetForUpdateAsync(postId, cancellationToken) ?? throw new NotFoundException("Post", postId);
        if (post.OwnerUserId != owner.Id) throw new ForbiddenException("You can edit only your own posts.");
        var retained = request.ReplaceImages
            ? request.KeepImageIds.Distinct().Select(id => post.Images.FirstOrDefault(image => image.Id == id)
                ?? throw new ValidationException("An image selected to keep does not belong to this post.")).ToList()
            : post.Images.OrderBy(image => image.Order).ToList();
        if (retained.Count + request.Images.Count > PublishingContentLimits.MaxImages)
            throw new ValidationException($"A post may contain at most {PublishingContentLimits.MaxImages} images.");
        var content = PublishingContentHelper.SanitizeText(request.Content);
        if (retained.Count + request.Images.Count == 0 && content is null)
            throw new ValidationException("A post must include an image or non-empty text.");
        var stored = await PublishingContentHelper.SaveImagesAsync(owner.Id, request.Images, _files, cancellationToken);
        var retainedIds = retained.Select(image => image.Id).ToHashSet();
        var deletedKeys = post.Images.Where(image => !retainedIds.Contains(image.Id)).Select(image => image.StorageKey).ToArray();
        var notificationId = post.Id.ToString();
        try
        {
            await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                foreach (var image in post.Images.Where(image => !retainedIds.Contains(image.Id)).ToArray()) post.Images.Remove(image);
                post.Content = content; post.Price = request.Price; post.UpdatedAt = _clock.GetUtcNow();
                var order = 0;
                foreach (var image in retained) image.Order = order++;
                foreach (var image in stored)
                {
                    var addedImage = new PostImage { PostId = post.Id, Order = order++, StorageKey = image.Key, ContentType = image.ContentType };
                    post.Images.Add(addedImage);
                    _posts.AddImage(addedImage);
                }
                await AddNotificationAsync(owner.Id, NotificationKind.PostEditsSaved, post.Id, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }, cancellationToken);
        }
        catch
        {
            await PublishingContentHelper.DeleteImagesAsync(stored.Select(image => image.Key), _files);
            throw;
        }
        await PublishingContentHelper.DeleteImagesAsync(deletedKeys, _files);
        await _dispatcher.DispatchAsync(NotificationKind.PostEditsSaved, owner.Id, targetId: notificationId, cancellationToken: cancellationToken);
    }

    public async Task<PagedResult<PublicProfileContentDto>> ListProfileAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var window = PublishingContentHelper.PageWindow(page, pageSize);
        var rows = await _posts.ListPublicByOwnerAsync(userId, window.Skip, window.Size, cancellationToken);
        var total = await _posts.CountPublicByOwnerAsync(userId, cancellationToken);
        return PagedResult<PublicProfileContentDto>.Create(rows.Select(ToProfileDto).ToArray(), window.Page, window.Size, total);
    }

    public async Task<PublicProfileContentDto> GetPublicAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        var post = await _posts.GetPublicAsync(postId, cancellationToken) ?? throw new NotFoundException("Post", postId);
        return ToProfileDto(post);
    }

    public async Task<StoredDocument> GetImageAsync(Guid postId, Guid imageId, CancellationToken cancellationToken = default)
    {
        var post = await _posts.GetPublicAsync(postId, cancellationToken) ?? throw new NotFoundException("Post", postId);
        var image = post.Images.FirstOrDefault(row => row.Id == imageId) ?? throw new NotFoundException("Post image", imageId);
        var file = await _files.ReadAsync(image.StorageKey, cancellationToken) ?? throw new NotFoundException("Post image", imageId);
        return new StoredDocument { RelativeUrl = image.StorageKey, Content = file.Bytes, ContentType = image.ContentType, FileName = Path.GetFileName(image.StorageKey) };
    }

    private async Task<ApplicationUser> RequirePublisherAsync(CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId)) throw new UnauthorizedException("You must be logged in to publish content.");
        if (!_currentUser.Roles.Any(role => role is ApplicationRoles.EventCoordinator or ApplicationRoles.Photographer))
            throw new ForbiddenException("Only coordinators and photographers can publish posts.");
        await _approval.EnsureCanPublishAsync(cancellationToken);
        if (await _restrictions.IsRestrictedAsync(_currentUser.UserId, cancellationToken))
            throw new ForbiddenException("Your content publishing is currently restricted.");
        return await _users.FindByIdAsync(_currentUser.UserId) ?? throw new ForbiddenException("The publishing account could not be found.");
    }

    private async Task AddNotificationAsync(string userId, NotificationKind kind, Guid targetId, CancellationToken cancellationToken)
    {
        var content = await _notifications.BuildAsync(kind, userId, targetId: targetId.ToString(), cancellationToken: cancellationToken);
        await _notificationWriter.AddAsync(new UserNotification
        {
            Id = Guid.NewGuid(), RecipientUserId = userId, Kind = kind, Language = Wesal.Domain.Constants.SupportedLanguages.ToCode(content.Language),
            Title = content.Title, Body = content.Body, ActionLabel = content.ActionLabel,
            ActionTarget = content.ActionTarget, TargetId = content.TargetId, CreatedAt = _clock.GetUtcNow()
        }, cancellationToken);
    }

    private static PublicProfileContentDto ToProfileDto(Post post) => new()
    {
        Id = post.Id, OwnerUserId = post.OwnerUserId, Content = post.Content, Price = post.Price,
        CreatedAt = post.CreatedAt, UpdatedAt = post.UpdatedAt,
        Images = post.Images.OrderBy(image => image.Order).Select(image => PublishingContentHelper.ToImage(post.Id, image.Id, image.Order, "posts")).ToArray()
    };
}
