using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;

namespace Wesal.Infrastructure.Admin;

/// <summary>
/// Applies the automatic system lock for halls whose current paid subscription cycle
/// end date passed with no confirmed payment for the next cycle (US-ADMIN-09,
/// FR-SUB-03). Only <see cref="Hall.SystemLocked"/> is set — <see cref="Hall.IsAdminLocked"/>
/// is never altered. Each lock is applied inside its own transaction that re-reads the
/// hall and re-validates the whole payment state before writing, so a payment confirmed
/// at the exact deadline moment (FR-SUB-04) is never wrongly locked. The owner is
/// notified in their Messages inbox after the lock commits; notification is best-effort
/// and never rolls back the lock.
/// </summary>
public sealed class SubscriptionExpiryLockService : ISubscriptionExpiryLockService
{
    /// <summary>
    /// Synthetic sender used for system-originated inbox messages (e.g. the automatic
    /// non-payment lock notice). No real admin/owner account is required to deliver an
    /// in-app message; the owner is always a participant of the conversation.
    /// </summary>
    public const string SystemSenderUserId = "system";

    private readonly IAdminDashboardRepository _adminDashboardRepository;
    private readonly IHallRepository _hallRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IConversationRepository _conversationRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly IDateTime _dateTime;
    private readonly ILogger<SubscriptionExpiryLockService> _logger;

    public SubscriptionExpiryLockService(
        IAdminDashboardRepository adminDashboardRepository,
        IHallRepository hallRepository,
        IUnitOfWork unitOfWork,
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        IDateTime dateTime,
        ILogger<SubscriptionExpiryLockService> logger)
    {
        _adminDashboardRepository = adminDashboardRepository;
        _hallRepository = hallRepository;
        _unitOfWork = unitOfWork;
        _conversationRepository = conversationRepository;
        _messageRepository = messageRepository;
        _dateTime = dateTime;
        _logger = logger;
    }

    public async Task<int> LockExpiredCyclesAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var today = DateOnly.FromDateTime(_dateTime.Now.UtcDateTime);

        var candidates = await _adminDashboardRepository.GetExpiredPaidCyclesAsync(today, cancellationToken);

        var locked = 0;

        foreach (var candidate in candidates)
        {
            await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);

            try
            {
                // Atomic payment-state check + lock-set: re-read the freshest committed
                // state inside the transaction and re-validate every predicate so a
                // payment that landed since the candidate scan is never locked.
                var hall = await _hallRepository.GetHallByIdForUpdateAsync(candidate.Id, cancellationToken);

                if (hall is null
                    || hall.IsDeleted
                    || hall.Status != HallStatus.Approved
                    || hall.PaymentStatus != HallPaymentStatus.Paid
                    || hall.SystemLocked
                    || hall.SubscriptionCycleEnd is null
                    || hall.SubscriptionCycleEnd >= today)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    continue;
                }

                hall.SystemLocked = true;
                hall.UpdatedAt = _dateTime.Now;

                await _unitOfWork.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                locked++;

                await TryNotifyOwnerAsync(hall, cancellationToken);

                _logger.LogInformation("Hall {HallId} automatically locked for expired subscription cycle", hall.Id);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                _logger.LogWarning(ex, "Failed to automatically lock hall {HallId} for an expired subscription cycle", candidate.Id);
            }
        }

        if (locked > 0)
        {
            _logger.LogInformation("Automatic subscription-lock job locked {Count} halls", locked);
        }

        return locked;
    }

    private async Task TryNotifyOwnerAsync(Hall hall, CancellationToken cancellationToken)
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
            _logger.LogWarning(ex, "Failed to notify owner of automatic lock for hall {HallId}", hall.Id);
        }
    }

    private async Task NotifyOwnerAsync(Hall hall, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(hall.OwnerId))
        {
            return;
        }

        var conversation = await _conversationRepository.GetByHallAndUserAsync(hall.Id, SystemSenderUserId, cancellationToken);

        if (conversation is null)
        {
            conversation = new Conversation
            {
                HallId = hall.Id,
                SenderUserId = SystemSenderUserId,
                HallOwnerId = hall.OwnerId!
            };

            await _conversationRepository.AddAsync(conversation, cancellationToken);
        }

        var message = new Message
        {
            ConversationId = conversation.Id,
            SenderUserId = SystemSenderUserId,
            Content = $"Your subscription for \"{hall.Name}\" has ended without a confirmed renewal. "
                + "Access to this hall has been automatically restricted. Please renew your subscription to reactivate the hall."
        };

        await _messageRepository.AddAsync(message, cancellationToken);
        await _messageRepository.SaveChangesAsync(cancellationToken);
    }
}