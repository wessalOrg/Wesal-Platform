using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Documents;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.OwnerDashboard;

/// <summary>
/// Owner payment-receipt flow (US-OWNER-31, US-ADMIN-07/10). An owner of an
/// Approved-but-unpaid hall uploads the subscription payment receipt; the hall moves to
/// <see cref="HallPaymentStatus.ReceiptUploaded"/> and stays private (public visibility
/// requires Approved AND Paid). The Admin sees the receipt state on the subscription
/// overview and the review drill-down and confirms the payment through the existing
/// US-ADMIN-10 endpoint. Ownership is resolved exclusively from the authenticated
/// session; the upload is stored in the protected document root and served only to the
/// owner and the Admin. The upload also appends a notification to the hall's
/// owner↔admin conversation via the existing inbox, so the Admin sees it without polling.
/// </summary>
public sealed class PaymentReceiptService : IPaymentReceiptService
{
    private readonly IOwnerDashboardRepository _ownerDashboardRepository;
    private readonly IConversationRepository _conversationRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly IConversationNotifier _notifier;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUser;
    private readonly IDocumentStorage _storage;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IDateTime _dateTime;
    private readonly ILogger<PaymentReceiptService> _logger;

    public PaymentReceiptService(
        IOwnerDashboardRepository ownerDashboardRepository,
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        IConversationNotifier notifier,
        UserManager<ApplicationUser> userManager,
        ICurrentUserService currentUser,
        IDocumentStorage storage,
        IUnitOfWork unitOfWork,
        IDateTime dateTime,
        ILogger<PaymentReceiptService> logger)
    {
        _ownerDashboardRepository = ownerDashboardRepository;
        _conversationRepository = conversationRepository;
        _messageRepository = messageRepository;
        _notifier = notifier;
        _userManager = userManager;
        _currentUser = currentUser;
        _storage = storage;
        _unitOfWork = unitOfWork;
        _dateTime = dateTime;
        _logger = logger;
    }

    public async Task<PaymentReceiptUploadResult> UploadPaymentReceiptAsync(
        Guid hallId,
        OwnerDocumentUpload upload,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var ownerId = await ResolveOwnerAsync(cancellationToken);

        // Tracking query so the payment fields below are persisted by SaveChangesAsync.
        var hall = await _ownerDashboardRepository.GetOwnedHallForUpdateAsync(hallId, ownerId, cancellationToken);

        if (hall is null)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        if (hall.Status != HallStatus.Approved)
        {
            throw new BusinessRuleException(
                "HallNotApproved",
                "A payment receipt can only be uploaded after the hall is approved; the hall is pending Admin review.");
        }

        if (hall.PaymentStatus == HallPaymentStatus.Paid)
        {
            throw new ConflictException(
                "This hall's subscription is already paid and active; no further receipt is needed.");
        }

        DocumentUploadValidator.EnsureValid(upload);

        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(upload.FileName).ToLowerInvariant()}";
        var relativeUrl = DocumentPath.HallReceiptRelativeUrl(hallId, fileName);

        var directory = _storage.HallReceiptsDirectory(hallId);
        Directory.CreateDirectory(directory);
        await File.WriteAllBytesAsync(Path.Combine(directory, fileName), upload.Content, cancellationToken);

        await TryDeletePreviousAsync(hall.PaymentReceiptUrl, cancellationToken);

        hall.PaymentReceiptUrl = relativeUrl;
        hall.PaymentReceiptUploadedAt = _dateTime.Now;
        hall.PaymentStatus = HallPaymentStatus.ReceiptUploaded;
        hall.UpdatedAt = _dateTime.Now;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await TryNotifyAdminAsync(hall, cancellationToken);

        return new PaymentReceiptUploadResult
        {
            HallId = hall.Id,
            HallName = hall.Name,
            PaymentStatus = hall.PaymentStatus,
            UploadedAt = hall.PaymentReceiptUploadedAt,
            HasReceipt = true
        };
    }

    public async Task<StoredDocument> GetPaymentReceiptAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var ownerId = await ResolveOwnerAsync(cancellationToken);

        var hall = await _ownerDashboardRepository.GetOwnedHallAsync(hallId, ownerId, cancellationToken);

        if (hall is null)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        if (string.IsNullOrWhiteSpace(hall.PaymentReceiptUrl))
        {
            throw new NotFoundException("No payment receipt has been uploaded for this hall.");
        }

        var fullPath = DocumentPath.ResolveFullPath(_storage.Root, hall.PaymentReceiptUrl);

        if (fullPath is null || !File.Exists(fullPath))
        {
            throw new NotFoundException("The payment receipt was not found.");
        }

        return new StoredDocument
        {
            RelativeUrl = hall.PaymentReceiptUrl,
            FullPath = fullPath,
            ContentType = InferContentType(fullPath),
            FileName = DocumentPath.FileNameFromUrl(hall.PaymentReceiptUrl) ?? Path.GetFileName(fullPath)
        };
    }

    private async Task<string> ResolveOwnerAsync(CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to manage your payment receipt.");
        }

        var user = await _userManager.FindByIdAsync(_currentUser.UserId);
        if (user is null)
        {
            throw new NotFoundException("User", _currentUser.UserId);
        }

        return user.Id;
    }

    private async Task TryNotifyAdminAsync(Hall hall, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(hall.OwnerId))
        {
            return;
        }

        try
        {
            var conversation = await _conversationRepository.GetByHallForOwnerAsync(hall.Id, hall.OwnerId, cancellationToken);

            if (conversation is null)
            {
                conversation = new Conversation
                {
                    HallId = hall.Id,
                    SenderUserId = hall.OwnerId,
                    HallOwnerId = hall.OwnerId
                };

                await _conversationRepository.AddAsync(conversation, cancellationToken);
            }

            var message = new Message
            {
                ConversationId = conversation.Id,
                SenderUserId = hall.OwnerId,
                Content = $"تم رفع إشعار دفع القاعة «{hall.Name}» بانتظار مراجعة المدير."
            };

            await _messageRepository.AddAsync(message, cancellationToken);
            await _messageRepository.SaveChangesAsync(cancellationToken);

            var senderName = await ResolveSenderNameAsync(hall.OwnerId, cancellationToken);

            try
            {
                await _notifier.NotifyMessageSentAsync(new MessageSentEvent
                {
                    MessageId = message.Id,
                    ConversationId = conversation.Id,
                    SenderUserId = message.SenderUserId,
                    SenderName = senderName,
                    Content = message.Content,
                    SentAt = message.CreatedAt
                }, cancellationToken);
            }
            catch
            {
                // Best-effort real-time push; the persisted inbox message remains the source of truth.
            }
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to notify payment receipt upload for hall {HallId}", hall.Id);
        }
    }

    private async Task<string> ResolveSenderNameAsync(string senderUserId, CancellationToken cancellationToken)
    {
        var users = await _conversationRepository.GetUserDisplayNamesAsync([senderUserId], cancellationToken);
        return users.FirstOrDefault(info => info.UserId == senderUserId)?.FullName ?? string.Empty;
    }

    private async Task TryDeletePreviousAsync(string? previousUrl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(previousUrl))
        {
            return;
        }

        var previousPath = DocumentPath.ResolveFullPath(_storage.Root, previousUrl);
        if (previousPath is not null && File.Exists(previousPath))
        {
            try
            {
                await Task.Run(() => File.Delete(previousPath), cancellationToken);
            }
            catch
            {
                // Best-effort cleanup; an orphaned file is harmless (never served publicly).
            }
        }
    }

    private static string InferContentType(string fullPath)
    {
        return Path.GetExtension(fullPath).ToLowerInvariant() switch
        {
            ".pdf" => "application/pdf",
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => "image/jpeg"
        };
    }
}