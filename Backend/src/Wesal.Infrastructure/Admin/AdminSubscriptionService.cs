using System.Globalization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Infrastructure.Conversations;

namespace Wesal.Infrastructure.Admin;

/// <summary>
/// Admin subscription overview (US-ADMIN-11, FR-SUB-06). Aggregates every hall across
/// all owners into a single grouped, filterable, sortable view exposing HallStatus,
/// PaymentStatus, SystemLocked, AdminLocked, the current cycle end date (days
/// remaining) and the last payment date. All values are computed live from the
/// persisted hall records on every call, so the dashboard never shows stale lock or
/// payment state before an Admin acts (the inline Lock/Unlock/Paid actions remain the
/// existing US-ADMIN-05/06/10 endpoints — no parallel duplicates are created here).
///
/// Marking a subscription as paid (US-ADMIN-10, FR-SUB-04) is only valid for an
/// Approved hall, sets PaymentStatus = Paid, clears the automatic SystemLocked flag,
/// and starts a fresh 30-day / 120-ILS cycle (StartDate = today, EndDate = today + 30).
/// The independent manual <see cref="Wesal.Domain.Entities.Hall.IsAdminLocked"/> flag is
/// never touched — an unpaid subscription's lock is lifted by payment confirmation only.
/// </summary>
public sealed class AdminSubscriptionService : IAdminSubscriptionService
{
    private readonly IAdminDashboardRepository _adminDashboardRepository;
    private readonly IHallRepository _hallRepository;
    private readonly IOptions<SubscriptionPaymentOptions> _subscriptionPaymentOptions;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IConversationRepository _conversationRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly IConversationNotifier _notifier;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _dateTime;
    private readonly ILogger<AdminSubscriptionService> _logger;
    private readonly INotificationService _notificationService;

    public AdminSubscriptionService(
        IAdminDashboardRepository adminDashboardRepository,
        IHallRepository hallRepository,
        IOptions<SubscriptionPaymentOptions> subscriptionPaymentOptions,
        IUnitOfWork unitOfWork,
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        IConversationNotifier notifier,
        ICurrentUserService currentUser,
        IDateTime dateTime,
        ILogger<AdminSubscriptionService> logger,
        INotificationService notificationService)
    {
        _adminDashboardRepository = adminDashboardRepository;
        _hallRepository = hallRepository;
        _subscriptionPaymentOptions = subscriptionPaymentOptions;
        _unitOfWork = unitOfWork;
        _conversationRepository = conversationRepository;
        _messageRepository = messageRepository;
        _notifier = notifier;
        _currentUser = currentUser;
        _dateTime = dateTime;
        _logger = logger;
        _notificationService = notificationService;
    }

    public async Task<IReadOnlyList<AdminSubscriptionOwnerGroupDto>> GetSubscriptionOverviewAsync(
        AdminSubscriptionOverviewQueryDto query,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var rows = await _adminDashboardRepository.GetSubscriptionOverviewAsync(cancellationToken);

        var filtered = rows
            .Where(row => query.ApprovalStatus is null || row.Status == query.ApprovalStatus)
            .Where(row => query.PaymentStatus is null || row.PaymentStatus == query.PaymentStatus)
            .Where(row => query.Locked is null || (row.SystemLocked || row.AdminLocked) == query.Locked.Value)
            .ToList();

        var today = DateOnly.FromDateTime(_dateTime.Now.UtcDateTime);

        var groups = filtered
            .GroupBy(row => new AdminOwnerKey(
                row.OwnerId,
                row.OwnerFullName,
                row.OwnerPhoneNumber,
                row.OwnerEmail))
            .Select(group => new AdminSubscriptionOwnerGroupDto
            {
                OwnerId = group.Key.OwnerId,
                OwnerFullName = group.Key.OwnerFullName,
                OwnerPhoneNumber = group.Key.OwnerPhoneNumber,
                OwnerEmail = group.Key.OwnerEmail,
                Halls = OrderHalls(group.Select(row => MapHall(row, today)), query.SortBy)
            })
            .ToList();

        return OrderGroups(groups, query.SortBy);
    }

    public async Task<AdminMarkPaidResultDto> MarkSubscriptionPaidAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var hall = await _hallRepository.GetHallByIdForUpdateAsync(hallId, cancellationToken);

        if (hall is null || hall.IsDeleted)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        if (hall.Status != HallStatus.Approved)
        {
            throw new BusinessRuleException(
                "HallNotApproved",
                $"Only an Approved hall can be marked as paid; hall {hallId} has status {hall.Status}.");
        }

        var today = DateOnly.FromDateTime(_dateTime.Now.UtcDateTime);

        if (hall.PaymentStatus == HallPaymentStatus.Paid
            && hall.SubscriptionCycleEnd is not null
            && hall.SubscriptionCycleEnd >= today)
        {
            // Idempotent no-op: the hall already has a confirmed, still-active cycle.
            // A second call must never create an overlapping cycle or clear a separate
            // manual Admin lock.
            return new AdminMarkPaidResultDto
            {
                HallId = hall.Id,
                Name = hall.Name,
                PaymentStatus = hall.PaymentStatus,
                SystemLocked = hall.SystemLocked,
                AdminLocked = hall.IsAdminLocked,
                CycleStart = hall.SubscriptionCycleStart,
                CycleEnd = hall.SubscriptionCycleEnd,
                AmountIls = _subscriptionPaymentOptions.Value.SubscriptionPriceIls,
                AlreadyPaidWithActiveCycle = true
            };
        }

        var cycleDays = _subscriptionPaymentOptions.Value.SubscriptionCycleDays;

        hall.PaymentStatus = HallPaymentStatus.Paid;
        hall.SystemLocked = false;
        hall.SubscriptionCycleStart = today;
        hall.SubscriptionCycleEnd = today.AddDays(cycleDays);
        hall.UpdatedAt = _dateTime.Now;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Notify the owner through the hall's conversation inbox that their payment was
        // confirmed and the hall is now live (US-ADMIN-10). Best-effort: never fails the
        // payment confirmation.
        await TryNotifyOwnerAsync(hall, cancellationToken);

        return new AdminMarkPaidResultDto
        {
            HallId = hall.Id,
            Name = hall.Name,
            PaymentStatus = hall.PaymentStatus,
            SystemLocked = hall.SystemLocked,
            AdminLocked = hall.IsAdminLocked,
            CycleStart = hall.SubscriptionCycleStart,
            CycleEnd = hall.SubscriptionCycleEnd,
            AmountIls = _subscriptionPaymentOptions.Value.SubscriptionPriceIls,
            AlreadyPaidWithActiveCycle = false
        };
    }

    /// <summary>
    /// Revokes a confirmed subscription payment (WESAL-TASK-4, Edit 4). This is a direct
    /// administrative action and is deliberately independent of any payment-proof message:
    /// the Admin can revoke a payment with or without an uploaded proof.
    ///
    /// <para>
    /// Semantics match <see cref="MarkSubscriptionPaidAsync"/>: the payment status becomes
    /// Unpaid and both cycle dates are cleared, so <c>DaysRemaining</c> returns to
    /// <c>null</c> (never paid) on every read surface. The idempotent no-op applies
    /// symmetrically — revoking an already-unpaid hall is a no-op that never discards a
    /// partially-set cycle twice.
    /// </para>
    ///
    /// <para>
    /// Note that this is <b>not</b> the unconditional inverse of
    /// <see cref="MarkSubscriptionPaidAsync"/>: marking paid additionally requires the hall
    /// to be <see cref="HallStatus.Approved"/>, so a hall that was never approved can have its
    /// payment revoked but cannot be marked paid in the first place. Revoking is still
    /// accepted for any hall, approved or not, so an Admin can always undo a mistaken
    /// confirmation. The Approved requirement is also what makes the "your hall is now
    /// active" confirmation notice truthful: only an approved hall is ever told it is active.
    /// </para>
    ///
    /// <para>
    /// Locks are intentionally left alone: <see cref="HallManagementAccess"/> evaluates
    /// the payment requirement BEFORE the system-lock requirement, so an unpaid hall is
    /// already blocked with the accurate <c>PaymentRequired</c> code, and forcing
    /// SystemLocked here would report two reasons for one condition. A manual Admin lock
    /// is never touched by any payment action.
    /// </para>
    /// </summary>
    public async Task<AdminMarkPaidResultDto> MarkSubscriptionNotPaidAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var hall = await _hallRepository.GetHallByIdForUpdateAsync(hallId, cancellationToken);

        if (hall is null || hall.IsDeleted)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        var alreadyUnpaid = hall.PaymentStatus == HallPaymentStatus.Unpaid
            && hall.SubscriptionCycleStart is null
            && hall.SubscriptionCycleEnd is null;

        if (alreadyUnpaid)
        {
            return new AdminMarkPaidResultDto
            {
                HallId = hall.Id,
                Name = hall.Name,
                PaymentStatus = hall.PaymentStatus,
                SystemLocked = hall.SystemLocked,
                AdminLocked = hall.IsAdminLocked,
                CycleStart = hall.SubscriptionCycleStart,
                CycleEnd = hall.SubscriptionCycleEnd,
                AmountIls = _subscriptionPaymentOptions.Value.SubscriptionPriceIls,
                AlreadyPaidWithActiveCycle = false
            };
        }

        hall.PaymentStatus = HallPaymentStatus.Unpaid;
        hall.SubscriptionCycleStart = null;
        hall.SubscriptionCycleEnd = null;
        hall.UpdatedAt = _dateTime.Now;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Subscription payment for hall {HallId} was revoked by admin {AdminId}",
            hallId,
            _currentUser.UserId);

        return new AdminMarkPaidResultDto
        {
            HallId = hall.Id,
            Name = hall.Name,
            PaymentStatus = hall.PaymentStatus,
            SystemLocked = hall.SystemLocked,
            AdminLocked = hall.IsAdminLocked,
            CycleStart = hall.SubscriptionCycleStart,
            CycleEnd = hall.SubscriptionCycleEnd,
            AmountIls = _subscriptionPaymentOptions.Value.SubscriptionPriceIls,
            AlreadyPaidWithActiveCycle = false
        };
    }

    private async Task TryNotifyOwnerAsync(Hall hall, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(hall.OwnerId))
        {
            return;
        }

        try
        {
            var conversation = await _conversationRepository.GetByHallForOwnerAsync(hall.Id, hall.OwnerId, cancellationToken);

            var adminUserId = _currentUser.IsAuthenticated && !string.IsNullOrWhiteSpace(_currentUser.UserId)
                ? _currentUser.UserId!
                : "admin";

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

            // WESAL-TASK-13 (Edit 13): rendered from the catalog in the OWNER's own stored
            // language, so an English-speaking owner is no longer told their payment landed in
            // Arabic only. The old fixed Arabic also claimed the hall was "published to
            // interested people", which described the publish step removed with the legacy
            // two-period model; the new wording does not mention it.
            var content = await _notificationService.BuildAsync(
                NotificationKind.SubscriptionPaidForOwner,
                hall.OwnerId,
                new Dictionary<string, string?>
                {
                    [NotificationTokens.HallName] = hall.Name,
                    [NotificationTokens.Date] = hall.SubscriptionCycleEnd?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty
                },
                cancellationToken: cancellationToken);

            var message = new Message
            {
                ConversationId = conversation.Id,
                SenderUserId = adminUserId,
                Content = content.Body
            };

            await _messageRepository.AddAsync(message, cancellationToken);
            await _messageRepository.SaveChangesAsync(cancellationToken);

            try
            {
                var senderName = string.Empty;
                var users = await _conversationRepository.GetUserDisplayNamesAsync([adminUserId], cancellationToken);
                senderName = users.FirstOrDefault(info => info.UserId == adminUserId)?.FullName ?? string.Empty;

                await _notifier.NotifyMessageSentAsync(new MessageSentEvent
                {
                    MessageId = message.Id,
                    ConversationId = conversation.Id,
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
                _logger.LogWarning(ex, "Failed to push the payment-confirmed message for hall {HallId}", hall.Id);
            }
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to notify the owner of confirmed payment for hall {HallId}", hall.Id);
        }
    }

    private static List<AdminSubscriptionHallDto> OrderHalls(
        IEnumerable<AdminSubscriptionHallDto> halls,
        string sortBy)
    {
        return sortBy.Equals(AdminSubscriptionOverviewQueryDto.SortByDaysRemaining, StringComparison.OrdinalIgnoreCase)
            ? halls
                .OrderBy(hall => hall.DaysRemaining ?? int.MaxValue)
                .ThenBy(hall => hall.Name, StringComparer.OrdinalIgnoreCase)
                .ToList()
            : halls
                .OrderBy(hall => hall.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();
    }

    private static IReadOnlyList<AdminSubscriptionOwnerGroupDto> OrderGroups(
        List<AdminSubscriptionOwnerGroupDto> groups,
        string sortBy)
    {
        return sortBy.Equals(AdminSubscriptionOverviewQueryDto.SortByDaysRemaining, StringComparison.OrdinalIgnoreCase)
            ? groups
                .OrderBy(group => group.Halls.Min(hall => hall.DaysRemaining ?? int.MaxValue))
                .ThenBy(group => group.OwnerFullName ?? group.OwnerId, StringComparer.OrdinalIgnoreCase)
                .ToList()
            : groups
                .OrderBy(group => group.OwnerFullName ?? group.OwnerId, StringComparer.OrdinalIgnoreCase)
                .ToList();
    }

    private static AdminSubscriptionHallDto MapHall(AdminSubscriptionHallRow row, DateOnly today)
        => new()
        {
            HallId = row.HallId,
            Name = row.Name,
            ApprovalStatus = row.Status,
            PaymentStatus = row.PaymentStatus,
            SystemLocked = row.SystemLocked,
            AdminLocked = row.AdminLocked,
            NextBillingDate = row.NextBillingDate,
            DaysRemaining = row.NextBillingDate is null
                ? null
                : row.NextBillingDate.Value.DayNumber - today.DayNumber,
            LastPaymentDate = row.LastPaymentDate,
            LockedAt = row.LockedAt,
            LockedByAdminUserId = row.LockedByAdminUserId
        };

    private sealed record AdminOwnerKey(
        string OwnerId,
        string? OwnerFullName,
        string? OwnerPhoneNumber,
        string? OwnerEmail);
}