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

public sealed class ProfessionalOfferService : IProfessionalOfferService
{
    private readonly ICurrentUserService _currentUser;
    private readonly IAccountApprovalGuard _approval;
    private readonly IAccountLockService _restrictions;
    private readonly UserManager<ApplicationUser> _users;
    private readonly IProfessionalOfferRepository _offers;
    private readonly IIdentityDocumentStore _files;
    private readonly IUnitOfWork _unitOfWork;
    private readonly INotificationService _notifications;
    private readonly IUserNotificationWriter _notificationWriter;
    private readonly INotificationDispatcher _dispatcher;
    private readonly IValidator<CreateProfessionalOfferRequest> _createValidator;
    private readonly IValidator<UpdateProfessionalOfferRequest> _updateValidator;
    private readonly TimeProvider _clock;

    public ProfessionalOfferService(ICurrentUserService currentUser, IAccountApprovalGuard approval,
        IAccountLockService restrictions, UserManager<ApplicationUser> users,
        IProfessionalOfferRepository offers, IIdentityDocumentStore files, IUnitOfWork unitOfWork,
        INotificationService notifications, IUserNotificationWriter notificationWriter,
        INotificationDispatcher dispatcher, IValidator<CreateProfessionalOfferRequest> createValidator,
        IValidator<UpdateProfessionalOfferRequest> updateValidator, TimeProvider clock)
    {
        _currentUser = currentUser; _approval = approval; _restrictions = restrictions; _users = users;
        _offers = offers; _files = files; _unitOfWork = unitOfWork; _notifications = notifications;
        _notificationWriter = notificationWriter; _dispatcher = dispatcher;
        _createValidator = createValidator; _updateValidator = updateValidator; _clock = clock;
    }

    public async Task<Guid> CreateAsync(CreateProfessionalOfferRequest request, CancellationToken cancellationToken = default)
    {
        await PublishingContentHelper.ValidateAsync(_createValidator, request, cancellationToken);
        PublishingContentHelper.ValidateImages(request.Images);
        var owner = await RequirePublisherAsync(cancellationToken);
        var content = PublishingContentHelper.SanitizeText(request.Content);
        if (content is null && request.Images.Count == 0) throw new ValidationException("An offer must include an image or non-empty text.");
        var now = _clock.GetUtcNow();
        var startsAt = request.StartsAt.ToUniversalTime();
        var endsAt = request.EndsAt.ToUniversalTime();
        var stored = await PublishingContentHelper.SaveImagesAsync(owner.Id, request.Images, _files, cancellationToken);
        var offer = new ProfessionalOffer
        {
            OwnerUserId = owner.Id, Content = content, OldPrice = request.OldPrice,
            OfferPrice = request.OfferPrice, PriceBox = request.PriceBox,
            StartsAt = startsAt, EndsAt = endsAt, CreatedAt = now,
            ReminderEligible = endsAt - now >= TimeSpan.FromHours(24)
        };
        offer.Images = stored.Select((image, index) => new ProfessionalOfferImage
        {
            OfferId = offer.Id, Order = index, StorageKey = image.Key, ContentType = image.ContentType
        }).ToList();
        var kind = _currentUser.Roles.Contains(ApplicationRoles.Photographer)
            ? NotificationKind.ProfessionalOfferPublishedForPhotographer
            : NotificationKind.ProfessionalOfferPublishedForCoordinator;
        try
        {
            await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                await _offers.AddAsync(offer, cancellationToken);
                await AddNotificationAsync(owner.Id, kind, offer.Id, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }, cancellationToken);
        }
        catch
        {
            await PublishingContentHelper.DeleteImagesAsync(stored.Select(image => image.Key), _files);
            throw;
        }
        await _dispatcher.DispatchAsync(kind, owner.Id, targetId: offer.Id.ToString(), cancellationToken: cancellationToken);
        return offer.Id;
    }

    public async Task UpdateAsync(Guid offerId, UpdateProfessionalOfferRequest request, CancellationToken cancellationToken = default)
    {
        await PublishingContentHelper.ValidateAsync(_updateValidator, request, cancellationToken);
        PublishingContentHelper.ValidateImages(request.Images);
        var owner = await RequirePublisherAsync(cancellationToken);
        var offer = await _offers.GetForUpdateAsync(offerId, cancellationToken) ?? throw new NotFoundException("Offer", offerId);
        if (offer.OwnerUserId != owner.Id) throw new ForbiddenException("You can edit only your own offers.");
        var now = _clock.GetUtcNow();
        if (offer.StoppedAt is not null || offer.EndsAt <= now) throw new ConflictException("An ended or stopped offer cannot be edited.");
        var retained = request.ReplaceImages
            ? request.KeepImageIds.Distinct().Select(id => offer.Images.FirstOrDefault(image => image.Id == id)
                ?? throw new ValidationException("An image selected to keep does not belong to this offer.")).ToList()
            : offer.Images.OrderBy(image => image.Order).ToList();
        if (retained.Count + request.Images.Count > PublishingContentLimits.MaxImages)
            throw new ValidationException($"An offer may contain at most {PublishingContentLimits.MaxImages} images.");
        var content = PublishingContentHelper.SanitizeText(request.Content);
        if (retained.Count + request.Images.Count == 0 && content is null)
            throw new ValidationException("An offer must include an image or non-empty text.");
        var stored = await PublishingContentHelper.SaveImagesAsync(owner.Id, request.Images, _files, cancellationToken);
        var retainedIds = retained.Select(image => image.Id).ToHashSet();
        var deletedKeys = offer.Images.Where(image => !retainedIds.Contains(image.Id)).Select(image => image.StorageKey).ToArray();
        try
        {
            await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                foreach (var image in offer.Images.Where(image => !retainedIds.Contains(image.Id)).ToArray()) offer.Images.Remove(image);
                offer.Content = content; offer.OldPrice = request.OldPrice; offer.OfferPrice = request.OfferPrice;
                offer.PriceBox = request.PriceBox; offer.StartsAt = request.StartsAt.ToUniversalTime(); offer.EndsAt = request.EndsAt.ToUniversalTime();
                offer.HasBeenEdited = true; offer.UpdatedAt = now;
                var order = 0;
                foreach (var image in retained) image.Order = order++;
                foreach (var image in stored)
                {
                    var addedImage = new ProfessionalOfferImage { OfferId = offer.Id, Order = order++, StorageKey = image.Key, ContentType = image.ContentType };
                    offer.Images.Add(addedImage);
                    _offers.AddImage(addedImage);
                }
                await AddNotificationAsync(owner.Id, NotificationKind.ProfessionalOfferEditsSaved, offer.Id, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }, cancellationToken);
        }
        catch
        {
            await PublishingContentHelper.DeleteImagesAsync(stored.Select(image => image.Key), _files);
            throw;
        }
        await PublishingContentHelper.DeleteImagesAsync(deletedKeys, _files);
        await _dispatcher.DispatchAsync(NotificationKind.ProfessionalOfferEditsSaved, owner.Id,
            targetId: offer.Id.ToString(), cancellationToken: cancellationToken);
    }

    public async Task StopAsync(Guid offerId, CancellationToken cancellationToken = default)
    {
        var owner = await RequirePublisherAsync(cancellationToken);
        var offer = await _offers.GetForUpdateAsync(offerId, cancellationToken) ?? throw new NotFoundException("Offer", offerId);
        if (offer.OwnerUserId != owner.Id) throw new ForbiddenException("You can stop only your own offers.");
        var now = _clock.GetUtcNow();
        if (offer.StoppedAt is not null || offer.EndsAt <= now) throw new ConflictException("An ended or stopped offer cannot be stopped again.");
        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            offer.StoppedAt = now; offer.UpdatedAt = now;
            await AddNotificationAsync(owner.Id, NotificationKind.ProfessionalOfferStopped, offer.Id, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);
        await _dispatcher.DispatchAsync(NotificationKind.ProfessionalOfferStopped, owner.Id,
            targetId: offer.Id.ToString(), cancellationToken: cancellationToken);
    }

    public async Task<PublicProfileContentDto> GetAsync(Guid offerId, CancellationToken cancellationToken = default)
    {
        var now = _clock.GetUtcNow();
        var offer = await _offers.GetAccessibleAsync(offerId, _currentUser.UserId, now, cancellationToken)
            ?? throw new NotFoundException("Offer", offerId);
        return ToProfileDto(offer);
    }

    public async Task<PagedResult<PublicProfileContentDto>> ListOwnAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId)) throw new UnauthorizedException("You must be logged in.");
        if (!_currentUser.Roles.Any(role => role is ApplicationRoles.EventCoordinator or ApplicationRoles.Photographer))
            throw new ForbiddenException("Only coordinators and photographers can view their offers.");
        var window = PublishingContentHelper.PageWindow(page, pageSize);
        var rows = await _offers.ListOwnAsync(_currentUser.UserId, window.Skip, window.Size, cancellationToken);
        var total = await _offers.CountOwnAsync(_currentUser.UserId, cancellationToken);
        return PagedResult<PublicProfileContentDto>.Create(rows.Select(ToProfileDto).ToArray(), window.Page, window.Size, total);
    }

    public async Task<PagedResult<PublicProfileContentDto>> ListProfileAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var window = PublishingContentHelper.PageWindow(page, pageSize);
        var now = _clock.GetUtcNow();
        var rows = await _offers.ListVisibleByOwnerAsync(userId, now, window.Skip, window.Size, cancellationToken);
        var total = await _offers.CountVisibleByOwnerAsync(userId, now, cancellationToken);
        return PagedResult<PublicProfileContentDto>.Create(rows.Select(ToProfileDto).ToArray(), window.Page, window.Size, total);
    }

    public async Task<StoredDocument> GetImageAsync(Guid offerId, Guid imageId, CancellationToken cancellationToken = default)
    {
        var offer = await _offers.GetAccessibleAsync(offerId, _currentUser.UserId, _clock.GetUtcNow(), cancellationToken)
            ?? throw new NotFoundException("Offer", offerId);
        var image = offer.Images.FirstOrDefault(row => row.Id == imageId) ?? throw new NotFoundException("Offer image", imageId);
        var file = await _files.ReadAsync(image.StorageKey, cancellationToken) ?? throw new NotFoundException("Offer image", imageId);
        return new StoredDocument { RelativeUrl = image.StorageKey, Content = file.Bytes, ContentType = image.ContentType, FileName = Path.GetFileName(image.StorageKey) };
    }

    private async Task<ApplicationUser> RequirePublisherAsync(CancellationToken cancellationToken)
    {
        var user = await RequireProfessionalOwnerAsync(cancellationToken);
        await _approval.EnsureCanPublishAsync(cancellationToken);
        await _restrictions.EnsureUnlockedAsync(user.Id, cancellationToken);
        return user;
    }

    private async Task<ApplicationUser> RequireProfessionalOwnerAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId)) throw new UnauthorizedException("You must be logged in.");
        if (!_currentUser.Roles.Any(role => role is ApplicationRoles.EventCoordinator or ApplicationRoles.Photographer))
            throw new ForbiddenException("Only coordinators and photographers can manage offers.");
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

    private static PublicProfileContentDto ToProfileDto(ProfessionalOffer offer) => new()
    {
        Id = offer.Id, OwnerUserId = offer.OwnerUserId, Content = offer.Content, OldPrice = offer.OldPrice, OfferPrice = offer.OfferPrice,
        Price = offer.PriceBox, StartsAt = offer.StartsAt, EndsAt = offer.EndsAt,
        StoppedAt = offer.StoppedAt, CreatedAt = offer.CreatedAt, UpdatedAt = offer.UpdatedAt,
        Images = offer.Images.OrderBy(image => image.Order).Select(image => PublishingContentHelper.ToImage(offer.Id, image.Id, image.Order, "offers")).ToArray()
    };
}
