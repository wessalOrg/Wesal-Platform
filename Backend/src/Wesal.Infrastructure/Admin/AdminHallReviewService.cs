using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Documents;
using Wesal.Infrastructure.Halls;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Admin;

/// <summary>
/// Admin Panel hall-review actions (US-ADMIN-01/03/05): the pending queue, the full
/// hall/owner drill-down, the rejection flow, and the manual Admin lock. Admin role
/// authorization is enforced by the RequireAdmin policy at the controller.
///
/// Rejection only ever applies to a PendingReview hall (or an idempotent no-op on an
/// already Rejected hall); rejecting a live Approved hall requires an explicit
/// confirmation flag and otherwise returns 409 Conflict. The rejection reason is
/// delivered to the owner's Messages inbox via a hall-scoped conversation that stays
/// open so the owner can reply. The manual lock records the acting Admin and timestamp
/// and never touches PaymentStatus or SystemLocked (FR-SUB-05).
///
/// Unlock (US-ADMIN-06, FR-SUB-05) clears only the manual Admin lock, records the
/// acting Admin and timestamp, then re-reads the hall's combined lock state and corrects
/// any inconsistency a concurrent payment-confirmation race left behind, so restored
/// access is always reported truthfully. Direct Admin→Owner messaging (US-ADMIN-04)
/// reuses the system's Conversation/Message domain and SignalR notifications; when the
/// owner's account is blocked the message is queued and flagged accordingly.
/// </summary>
public sealed class AdminHallReviewService : IAdminHallReviewService
{
    private readonly IAdminDashboardRepository _adminDashboardRepository;
    private readonly IHallRepository _hallRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IConversationRepository _conversationRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _dateTime;
    private readonly IConversationNotifier _notifier;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IIdentityDocumentStore _identityDocumentStore;
    private readonly INotificationService _notificationService;
    private readonly INotificationDispatcher _notificationDispatcher;
    private readonly ILogger<AdminHallReviewService> _logger;

    public AdminHallReviewService(
        IAdminDashboardRepository adminDashboardRepository,
        IHallRepository hallRepository,
        IUnitOfWork unitOfWork,
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        ICurrentUserService currentUser,
        IDateTime dateTime,
        IConversationNotifier notifier,
        UserManager<ApplicationUser> userManager,
        IIdentityDocumentStore identityDocumentStore,
        INotificationService notificationService,
        INotificationDispatcher notificationDispatcher,
        ILogger<AdminHallReviewService> logger)
    {
        _adminDashboardRepository = adminDashboardRepository;
        _hallRepository = hallRepository;
        _unitOfWork = unitOfWork;
        _conversationRepository = conversationRepository;
        _messageRepository = messageRepository;
        _currentUser = currentUser;
        _dateTime = dateTime;
        _notifier = notifier;
        _userManager = userManager;
        _identityDocumentStore = identityDocumentStore;
        _notificationService = notificationService;
        _notificationDispatcher = notificationDispatcher;
        _logger = logger;
    }

    public async Task<PagedResult<AdminPendingHallDto>> GetPendingHallsAsync(
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        page = page <= 0 ? 1 : page;
        pageSize = pageSize <= 0 ? 10 : pageSize;

        var items = await _adminDashboardRepository.GetPendingHallsAsync((page - 1) * pageSize, pageSize, cancellationToken);
        var totalCount = await _adminDashboardRepository.GetPendingHallsCountAsync(cancellationToken);

        return PagedResult<AdminPendingHallDto>.Create(items, page, pageSize, totalCount);
    }

    public async Task<PagedResult<AdminPendingHallDto>> GetRejectedHallsAsync(
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        page = page <= 0 ? 1 : page;
        pageSize = pageSize <= 0 ? 10 : pageSize;

        var items = await _adminDashboardRepository.GetRejectedHallsAsync((page - 1) * pageSize, pageSize, cancellationToken);
        var totalCount = await _adminDashboardRepository.GetRejectedHallsCountAsync(cancellationToken);

        return PagedResult<AdminPendingHallDto>.Create(items, page, pageSize, totalCount);
    }

    public async Task<AdminHallDetailDto> GetAdminHallDetailAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var row = await _adminDashboardRepository.GetHallDetailForAdminAsync(hallId, cancellationToken);

        if (row is null)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        return new AdminHallDetailDto
        {
            HallId = row.HallId,
            Name = row.Name,
            Region = row.Region,
            RegionDisplayName = HallDisplayNames.GetRegionDisplayName(row.Region),
            Address = row.Address,
            DetailedAddress = row.DetailedAddress,
            Description = row.Description,
            Capacity = row.Capacity,
            Price = row.Price,
            SubmittedAt = row.SubmittedAt,
            Status = row.Status,
            OwnerId = row.OwnerId,
            OwnerFullName = row.OwnerFullName,
            OwnerPhoneNumber = row.OwnerPhoneNumber,
            OwnerEmail = row.OwnerEmail,
            // Edit 17: the admin review surface resolves the cover exactly like the
            // public surfaces — stored cover first, then the first gallery photo — so a
            // coverless hall with photos still shows a reliable image.
            MainImageUrl = HallMediaUrl.ResolveCoverUrl(row.MainImageUrl, row.PhotoUrls),
            YouTubeVideoUrl = row.YouTubeVideoUrl,
            Features = row.Features,
            OtherFeatures = row.OtherFeatures,
            PaymentStatus = row.PaymentStatus,
            OwnerHasIdentityDocument = row.OwnerHasIdentityDocument,
            PhotoUrls = row.PhotoUrls
        };
    }

    public async Task<StoredDocument> GetOwnerIdentityDocumentAsync(
        string ownerId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var owner = await _userManager.FindByIdAsync(ownerId);
        if (owner is null)
        {
            throw new NotFoundException("User", ownerId);
        }

        if (string.IsNullOrWhiteSpace(owner.IdentityDocumentUrl))
        {
            throw new NotFoundException("The owner has not uploaded an identity document yet.");
        }

        var stored = await _identityDocumentStore.ReadAsync(owner.IdentityDocumentUrl, cancellationToken);

        if (stored is null)
        {
            throw new NotFoundException("The owner identity document was not found.");
        }

        return new StoredDocument
        {
            RelativeUrl = owner.IdentityDocumentUrl,
            FullPath = stored.LocalPath ?? string.Empty,
            Content = stored.Bytes,
            ContentType = DocumentPath.ContentTypeFromUrl(owner.IdentityDocumentUrl),
            FileName = DocumentPath.FileNameFromUrl(owner.IdentityDocumentUrl) ?? owner.IdentityDocumentUrl
        };
    }

    public async Task<AdminRejectHallResultDto> RejectHallAsync(
        Guid hallId,
        AdminRejectHallRequestDto request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var hall = await _hallRepository.GetHallByIdForUpdateAsync(hallId, cancellationToken);

        if (hall is null || hall.IsDeleted)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        if (hall.Status == HallStatus.Rejected)
        {
            return new AdminRejectHallResultDto
            {
                HallId = hall.Id,
                Name = hall.Name,
                Status = hall.Status,
                IsAlreadyRejected = true,
                NotificationDelivered = false
            };
        }

        if (hall.Status == HallStatus.Approved && !request.ConfirmLiveApproved)
        {
            throw new ConflictException(
                "This hall is currently Approved (live). Rejecting it will take the hall offline; send an explicit confirmation to proceed.");
        }

        if (hall.Status == HallStatus.Approved || hall.Status == HallStatus.PendingReview)
        {
            hall.Status = HallStatus.Rejected;
            hall.UpdatedAt = _dateTime.Now;
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Hall {HallId} was rejected by admin {AdminId}", hall.Id, ResolveAdminUserId());

            var notificationDelivered = await TryDeliverRejectionMessageAsync(hall, request.Reason, cancellationToken);

            return new AdminRejectHallResultDto
            {
                HallId = hall.Id,
                Name = hall.Name,
                Status = hall.Status,
                IsAlreadyRejected = false,
                NotificationDelivered = notificationDelivered
            };
        }

        throw new BusinessRuleException(
            "HallNotPending",
            $"A hall with status {hall.Status} cannot be rejected.");
    }

    public async Task<AdminLockHallResultDto> LockHallAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var hall = await _hallRepository.GetHallByIdForUpdateAsync(hallId, cancellationToken);

        if (hall is null || hall.IsDeleted)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        if (!hall.IsAdminLocked)
        {
            hall.IsAdminLocked = true;
            hall.LockedByAdminUserId = ResolveAdminUserId();
            hall.LockedAt = _dateTime.Now;
            hall.UpdatedAt = _dateTime.Now;

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Hall {HallId} was locked by admin {AdminId}", hall.Id, hall.LockedByAdminUserId);
        }

        return new AdminLockHallResultDto
        {
            HallId = hall.Id,
            Name = hall.Name,
            IsLocked = hall.IsAdminLocked,
            LockedAt = hall.LockedAt,
            LockedByAdminUserId = hall.LockedByAdminUserId
        };
    }

    public async Task<AdminUnlockHallResultDto> UnlockHallAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var hall = await _hallRepository.GetHallByIdForUpdateAsync(hallId, cancellationToken);

        if (hall is null || hall.IsDeleted)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        if (hall.IsAdminLocked)
        {
            var adminId = ResolveAdminUserId();

            hall.IsAdminLocked = false;
            hall.UnlockedByAdminUserId = adminId;
            hall.UnlockedAt = _dateTime.Now;
            hall.UpdatedAt = _dateTime.Now;

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Hall {HallId} was unlocked by admin {AdminId}", hall.Id, adminId);

            // Verification step (US-ADMIN-06): re-read the freshest combined lock state
            // and correct a left-over inconsistency (e.g. SystemLocked still set although
            // the hall is Paid with an active cycle) so the returned state and the owner's
            // restored access are truthful.
            await VerifyUnlockStateAsync(hall.Id, cancellationToken);
        }

        return new AdminUnlockHallResultDto
        {
            HallId = hall.Id,
            Name = hall.Name,
            IsLocked = hall.IsAdminLocked,
            UnlockedAt = hall.UnlockedAt,
            UnlockedByAdminUserId = hall.UnlockedByAdminUserId,
            ManagementAccessRestored = !hall.IsAdminLocked
                && !hall.SystemLocked
                && hall.PaymentStatus == HallPaymentStatus.Paid
        };
    }

    /// <summary>
    /// Resolves this hall's owner/Admin conversation without sending anything, creating it if
    /// it does not exist yet (WESAL-TASK-10, Edit 15).
    ///
    /// This is the backend half of the Admin "Message" / "مراسلة" action. Edit 4's
    /// SendMessageToOwnerAsync already lets an Admin write to an owner, but it is a SEND: it
    /// requires non-empty content, so it cannot back a button whose job is to OPEN a thread.
    /// Posting an empty placeholder just to learn the conversation id would put a junk message
    /// in the owner's inbox, so the two are separate operations.
    ///
    /// The thread is resolved on the same (HallId, HallOwnerId) key Edit 4 and Edit 11 use, so
    /// this is a lookup rather than a new resolution path: it lands on the thread a payment
    /// notice already created, and on the thread the owner's own ContactAdmin action creates,
    /// rather than forking a third copy. Repeated calls for one hall always return the same
    /// single thread.
    ///
    /// Deliberately NOT subject to the hall-messaging lock gate that Edit 10 applies to the
    /// OWNER's side of this feature. An Admin must be able to open the thread for a hall in any
    /// state — including one they have just locked, which is frequently the very thing the two
    /// sides need to discuss. The gate exists to stop a locked owner using the platform; it
    /// has no business stopping the platform from talking to the owner.
    ///
    /// Authorization is the Admin role, enforced by the RequireAdmin policy on the controller.
    /// </summary>
    public async Task<AdminOwnerConversationDto> GetOwnerConversationAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var hall = await _hallRepository.GetHallByIdForUpdateAsync(hallId, cancellationToken);

        if (hall is null || hall.IsDeleted)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        if (string.IsNullOrWhiteSpace(hall.OwnerId))
        {
            throw new ValidationException("The hall has no owner to message.");
        }

        var conversation = await _conversationRepository.GetByHallForOwnerAsync(
            hall.Id, hall.OwnerId!, cancellationToken);

        var isExisting = conversation is not null;

        if (conversation is null)
        {
            conversation = new Conversation
            {
                HallId = hall.Id,
                SenderUserId = ResolveAdminUserId(),
                HallOwnerId = hall.OwnerId!
            };

            await _conversationRepository.AddAsync(conversation, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return new AdminOwnerConversationDto
        {
            ConversationId = conversation.Id,
            HallId = hall.Id,
            HallName = hall.Name,
            OwnerUserId = hall.OwnerId!,
            IsExisting = isExisting
        };
    }

    public async Task<AdminOwnerMessageResponseDto> SendMessageToOwnerAsync(
        Guid hallId,
        string content,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (string.IsNullOrWhiteSpace(content))
        {
            throw new ValidationException("Message content is required.");
        }

        if (content.Trim().Length > 1000)
        {
            throw new ValidationException("Message content must not exceed 1000 characters.");
        }

        var hall = await _hallRepository.GetHallByIdForUpdateAsync(hallId, cancellationToken);

        if (hall is null || hall.IsDeleted)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        if (string.IsNullOrWhiteSpace(hall.OwnerId))
        {
            throw new ValidationException("The hall has no owner to message.");
        }

        var adminUserId = ResolveAdminUserId();

        // WESAL-TASK-4 (Edit 4): resolve the owner/Admin thread by (HallId, HallOwnerId)
        // so two different Admins messaging the same owner always land in ONE thread.
        var conversation = await _conversationRepository.GetByHallForOwnerAsync(hall.Id, hall.OwnerId!, cancellationToken);

        if (conversation is null)
        {
            conversation = new Conversation
            {
                HallId = hall.Id,
                SenderUserId = adminUserId,
                HallOwnerId = hall.OwnerId!
            };

            await _conversationRepository.AddAsync(conversation, cancellationToken);
        }

        var message = new Message
        {
            ConversationId = conversation.Id,
            SenderUserId = adminUserId,
            Content = content.Trim()
        };

        await _messageRepository.AddAsync(message, cancellationToken);
        await _messageRepository.SaveChangesAsync(cancellationToken);

        var ownerBlocked = await IsOwnerBlockedAsync(hall.OwnerId, cancellationToken);

        if (!ownerBlocked)
        {
            var senderName = await ResolveSenderNameAsync(adminUserId, cancellationToken);
            await TryNotifyRealTimeAsync(conversation.Id, message, senderName, cancellationToken);
        }

        return new AdminOwnerMessageResponseDto
        {
            MessageId = message.Id,
            ConversationId = conversation.Id,
            HallId = hall.Id,
            Content = message.Content ?? string.Empty,
            SentAt = message.CreatedAt,
            OwnerBlocked = ownerBlocked,
            DeliveryPending = ownerBlocked
        };
    }

    private async Task VerifyUnlockStateAsync(Guid hallId, CancellationToken cancellationToken)
    {
        var fresh = await _hallRepository.GetHallByIdForUpdateAsync(hallId, cancellationToken);

        if (fresh is null || fresh.IsDeleted)
        {
            return;
        }

        var today = DateOnly.FromDateTime(_dateTime.Now.UtcDateTime);

        // A payment confirmation racing the manual unlock can leave SystemLocked set even
        // though the hall is Paid with an active cycle. Correct that inconsistency so the
        // manual unlock restores access as the business rule intends.
        if (fresh.SystemLocked
            && fresh.PaymentStatus == HallPaymentStatus.Paid
            && fresh.SubscriptionCycleEnd is not null
            && fresh.SubscriptionCycleEnd >= today)
        {
            fresh.SystemLocked = false;
            fresh.UpdatedAt = _dateTime.Now;

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Unlock verification corrected a stale SystemLocked flag for hall {HallId}", fresh.Id);
        }
    }

    private async Task<bool> IsOwnerBlockedAsync(string ownerId, CancellationToken cancellationToken)
    {
        if (cancellationToken.IsCancellationRequested)
        {
            throw new OperationCanceledException(cancellationToken);
        }

        var owner = await _userManager.FindByIdAsync(ownerId);

        if (owner is null)
        {
            return false;
        }

        return await _userManager.IsLockedOutAsync(owner);
    }

    private async Task<string> ResolveSenderNameAsync(string adminUserId, CancellationToken cancellationToken)
    {
        var users = await _conversationRepository.GetUserDisplayNamesAsync([adminUserId], cancellationToken);
        return users.FirstOrDefault(info => info.UserId == adminUserId)?.FullName ?? string.Empty;
    }

    private async Task TryNotifyRealTimeAsync(
        Guid conversationId,
        Message message,
        string senderName,
        CancellationToken cancellationToken)
    {
        try
        {
            await _notifier.NotifyMessageSentAsync(new MessageSentEvent
            {
                MessageId = message.Id,
                ConversationId = conversationId,
                SenderUserId = message.SenderUserId,
                SenderName = senderName,
                Content = message.Content ?? string.Empty,
                SentAt = message.CreatedAt
            }, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to push the admin message for hall {HallId}", conversationId);
        }
    }

    /// <summary>
    /// The acting Admin's own id, or the platform's Admin-side sentinel when there is no
    /// authenticated caller (a background call, or a test harness).
    /// <para>
    /// WESAL-TASK-10, Edit 16: the fallback is <see cref="PlatformSenders.AdminFallback"/>
    /// rather than a bare literal, because the shared Admin inbox classifies an owner/Admin
    /// thread by recognising that value. Two copies of the string that must agree is exactly
    /// how a thread silently stops being recognised as Admin-side later.
    /// </para>
    /// </summary>
    private string ResolveAdminUserId()
        => _currentUser.IsAuthenticated && !string.IsNullOrWhiteSpace(_currentUser.UserId)
            ? _currentUser.UserId
            : PlatformSenders.AdminFallback;

    private async Task<bool> TryDeliverRejectionMessageAsync(
        Hall hall,
        string? reason,
        CancellationToken cancellationToken)
    {
        try
        {
            await DeliverRejectionMessageAsync(hall, reason, cancellationToken);
            return true;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to deliver the rejection message for hall {HallId}", hall.Id);
            return false;
        }
    }

    private async Task DeliverRejectionMessageAsync(
        Hall hall,
        string? reason,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(hall.OwnerId))
        {
            return;
        }

        var adminUserId = ResolveAdminUserId();

        // WESAL-TASK-4 (Edit 4): resolve the owner/Admin thread by (HallId, HallOwnerId)
        // so two different Admins messaging the same owner always land in ONE thread.
        var conversation = await _conversationRepository.GetByHallForOwnerAsync(hall.Id, hall.OwnerId!, cancellationToken);

        if (conversation is null)
        {
            conversation = new Conversation
            {
                HallId = hall.Id,
                SenderUserId = adminUserId,
                HallOwnerId = hall.OwnerId!
            };

            await _conversationRepository.AddAsync(conversation, cancellationToken);
        }

        var message = new Message
        {
            ConversationId = conversation.Id,
            SenderUserId = adminUserId,
            // WESAL-TASK-13 (Edit 13): this notice used to be English-only, so an
            // Arabic-speaking owner received the rejection in a language they had not chosen.
            // It is now rendered from the catalog in the OWNER's own stored language, and the
            // pushed notification reuses the identical wording.
            Content = await BuildRejectionContentAsync(hall, reason, cancellationToken)
        };

        await _messageRepository.AddAsync(message, cancellationToken);
        await _messageRepository.SaveChangesAsync(cancellationToken);

        // The click-through opens this very owner/Admin thread, which was just created on
        // demand when the owner had never been messaged before, so "contact support" always
        // lands in a real, writable conversation.
        await _notificationDispatcher.DispatchAsync(
            NotificationKind.HallRejectedForOwner,
            hall.OwnerId!,
            new Dictionary<string, string?>
            {
                [NotificationTokens.HallName] = hall.Name,
                [NotificationTokens.Reason] = string.IsNullOrWhiteSpace(reason) ? string.Empty : reason.Trim()
            },
            conversation.Id.ToString(),
            cancellationToken);
    }

    private async Task<string> BuildRejectionContentAsync(
        Hall hall,
        string? reason,
        CancellationToken cancellationToken)
    {
        var content = await _notificationService.BuildAsync(
            NotificationKind.HallRejectedForOwner,
            hall.OwnerId!,
            new Dictionary<string, string?>
            {
                [NotificationTokens.HallName] = hall.Name,
                [NotificationTokens.Reason] = string.IsNullOrWhiteSpace(reason) ? string.Empty : reason.Trim()
            },
            cancellationToken: cancellationToken);

        return content.Body;
    }
}