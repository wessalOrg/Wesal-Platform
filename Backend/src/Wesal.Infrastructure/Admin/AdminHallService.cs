using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Admin;

/// <summary>
/// Approves a hall submission (US-ADMIN-02, FR-ADM-03). Approval ONLY changes the
/// HallStatus from PendingReview to Approved — it never touches PaymentStatus and never
/// starts a SubscriptionCycle (that is exclusively US-ADMIN-10 / FR-SUB-04). The action
/// is idempotent: approving an already-Approved hall is a no-op that returns 200 without
/// delivering a duplicate owner notification. On the first approval the owner receives
/// an in-app confirmation stating that management features stay locked until payment is
/// confirmed (US-ADMIN-07). Approval triggers search re-indexing post-commit; indexing
/// failure never rolls back the approval (the hall is already visible through the
/// approved-halls queries, which are driven by the persisted Status flag).
/// </summary>
public class AdminHallService : IAdminHallService
{
    private readonly IHallRepository _hallRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IHallSearchIndexer _indexer;
    private readonly IConversationRepository _conversationRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _dateTime;
    private readonly ILogger<AdminHallService> _logger;

    public AdminHallService(
        IHallRepository hallRepository,
        IUnitOfWork unitOfWork,
        IHallSearchIndexer indexer,
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        ICurrentUserService currentUser,
        IDateTime dateTime,
        ILogger<AdminHallService> logger)
    {
        _hallRepository = hallRepository;
        _unitOfWork = unitOfWork;
        _indexer = indexer;
        _conversationRepository = conversationRepository;
        _messageRepository = messageRepository;
        _currentUser = currentUser;
        _dateTime = dateTime;
        _logger = logger;
    }

    public async Task<HallApprovalResponse> ApproveHallAsync(Guid hallId, CancellationToken cancellationToken = default)
    {
        var hall = await _hallRepository.GetHallByIdForUpdateAsync(hallId, cancellationToken);
        if (hall == null || hall.IsDeleted)
            throw new NotFoundException("Hall", hallId);

        if (hall.Status == HallStatus.Approved)
        {
            // Idempotent - already approved, ensure indexed; no duplicate owner notification.
            await TryIndexAsync(hall, cancellationToken);
            return new HallApprovalResponse { HallId = hall.Id, HallName = hall.Name, Status = hall.Status, ApprovedAt = hall.UpdatedAt ?? hall.CreatedAt };
        }

        if (hall.Status != HallStatus.PendingReview)
            throw new BusinessRuleException("HallNotPending", $"Hall with status {hall.Status} cannot be approved.");

        hall.Status = HallStatus.Approved;
        hall.UpdatedAt = _dateTime.Now;
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Hall {HallId} approved, triggering search indexing", hallId);

        // Trigger indexing after successful commit - never rollback approval on indexing failure
        await TryIndexAsync(hall, cancellationToken);

        // Notify the owner that approval succeeded and that management features remain
        // locked until payment is confirmed. Best-effort: never rolls back the approval.
        await TryNotifyOwnerAsync(hall, cancellationToken);

        return new HallApprovalResponse { HallId = hall.Id, HallName = hall.Name, Status = hall.Status, ApprovedAt = hall.UpdatedAt ?? DateTimeOffset.UtcNow };
    }

    private async Task TryIndexAsync(Wesal.Domain.Entities.Hall hall, CancellationToken cancellationToken)
    {
        try
        {
            var dto = new HallSearchIndexDto
            {
                HallId = hall.Id,
                HallName = hall.Name,
                Region = hall.Region,
                Address = hall.Address,
                Description = hall.Description,
                Capacity = hall.Capacity,
                Price = hall.Price,
                Status = hall.Status
            };
            await _indexer.IndexHallAsync(dto, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Search indexing failed for hall {HallId}, will retry", hall.Id);
            // Do not throw - approval remains Approved, indexing is retryable
        }
    }

    private async Task TryNotifyOwnerAsync(Wesal.Domain.Entities.Hall hall, CancellationToken cancellationToken)
    {
        try
        {
            await NotifyOwnerAsync(hall, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to notify the owner of approval for hall {HallId}", hall.Id);
        }
    }

    private async Task NotifyOwnerAsync(Wesal.Domain.Entities.Hall hall, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(hall.OwnerId))
        {
            return;
        }

        var adminUserId = ResolveAdminUserId();

        var conversation = await _conversationRepository.GetByHallAndUserAsync(hall.Id, adminUserId, cancellationToken);

        if (conversation is null)
        {
            conversation = new Wesal.Domain.Entities.Conversation
            {
                HallId = hall.Id,
                SenderUserId = adminUserId,
                HallOwnerId = hall.OwnerId!
            };

            await _conversationRepository.AddAsync(conversation, cancellationToken);
        }

        var message = new Wesal.Domain.Entities.Message
        {
            ConversationId = conversation.Id,
            SenderUserId = adminUserId,
            Content = $"Congratulations! Your hall \"{hall.Name}\" has been approved and is now visible to visitors. "
                + "Management features (calendar, bookings, messaging and dashboard) remain locked until your subscription payment is confirmed."
        };

        await _messageRepository.AddAsync(message, cancellationToken);
        await _messageRepository.SaveChangesAsync(cancellationToken);
    }

    private string ResolveAdminUserId()
        => _currentUser.IsAuthenticated && !string.IsNullOrWhiteSpace(_currentUser.UserId)
            ? _currentUser.UserId
            : "admin";
}