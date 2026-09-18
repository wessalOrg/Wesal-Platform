using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Infrastructure.Admin;

namespace Wesal.Infrastructure.Warnings;

/// <summary>
/// Delivers the 3-day subscription-expiry warning to hall owners (US-ADMIN-08,
/// FR-SUB-02). Each hall's cycle is independent and the warning fires when the cycle
/// end date is exactly <see cref="WarningDays"/> away. Idempotency per cycle: the
/// in-app warning is recorded (via <see cref="Hall.WarningSentForCycleEnd"/>) the first
/// time it is delivered, so a repeated daily run never warns the same cycle twice; a
/// failed e-mail send is retried each run — with escalation once attempts cross the
/// configured threshold — until it succeeds or the cycle ends.
/// </summary>
public sealed class SubscriptionExpiryWarningService : ISubscriptionExpiryWarningService
{
    /// <summary>Same synthetic system sender used by the automatic expiry lock, so all system notices share one thread per hall.</summary>
    public const string SystemSenderUserId = SubscriptionExpiryLockService.SystemSenderUserId;

    private const int WarningDays = 3;

    private readonly IAdminDashboardRepository _adminDashboardRepository;
    private readonly IConversationRepository _conversationRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly IEmailService _emailService;
    private readonly SubscriptionExpiryWarningOptions _options;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IDateTime _dateTime;
    private readonly ILogger<SubscriptionExpiryWarningService> _logger;

    public SubscriptionExpiryWarningService(
        IAdminDashboardRepository adminDashboardRepository,
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        IEmailService emailService,
        IOptions<SubscriptionExpiryWarningOptions> options,
        IUnitOfWork unitOfWork,
        IDateTime dateTime,
        ILogger<SubscriptionExpiryWarningService> logger)
    {
        _adminDashboardRepository = adminDashboardRepository;
        _conversationRepository = conversationRepository;
        _messageRepository = messageRepository;
        _emailService = emailService;
        _options = options.Value;
        _unitOfWork = unitOfWork;
        _dateTime = dateTime;
        _logger = logger;
    }

    public async Task<int> WarnCyclesEndingSoonAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var today = DateOnly.FromDateTime(_dateTime.Now.UtcDateTime);
        var candidates = await _adminDashboardRepository.GetSubscriptionExpiryWarningCandidatesAsync(
            today, WarningDays, cancellationToken);

        var delivered = 0;

        foreach (var hall in candidates)
        {
            var cycleEnd = hall.SubscriptionCycleEnd!.Value;
            var isFirstWarning = hall.WarningSentForCycleEnd != cycleEnd;

            if (isFirstWarning)
            {
                await DeliverInAppWarningAsync(hall, cycleEnd, today, cancellationToken);
                hall.WarningSentForCycleEnd = cycleEnd;
                hall.UpdatedAt = _dateTime.Now;
            }

            var daysRemaining = cycleEnd.DayNumber - today.DayNumber;
            var emailDelivered = await TrySendEmailWarningAsync(hall, cycleEnd, daysRemaining, cancellationToken);

            if (emailDelivered)
            {
                hall.WarningSentAttempts = 0;
                delivered++;
            }
            else
            {
                hall.WarningSentAttempts += 1;
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            if (emailDelivered)
            {
                _logger.LogInformation(
                    "Subscription expiry warning delivered for hall {HallId} (cycle ends {CycleEnd})",
                    hall.Id,
                    cycleEnd);
            }
            else if (hall.WarningSentAttempts >= _options.EscalationThreshold)
            {
                _logger.LogError(
                    "ESCALATION: subscription expiry warning for hall {HallId} (\u0022{HallName}\u0022, cycle ends {CycleEnd}, {DaysRemaining} days remaining) could not be e-mailed after {Attempts} attempts",
                    hall.Id,
                    hall.Name,
                    cycleEnd,
                    daysRemaining,
                    hall.WarningSentAttempts);
            }
            else
            {
                _logger.LogWarning(
                    "Subscription expiry warning e-mail for hall {HallId} failed, attempt {Attempts} of threshold {Threshold}",
                    hall.Id,
                    hall.WarningSentAttempts,
                    _options.EscalationThreshold);
            }
        }

        return delivered;
    }

    private async Task DeliverInAppWarningAsync(
        Hall hall,
        DateOnly cycleEnd,
        DateOnly today,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(hall.OwnerId))
        {
            return;
        }

        var daysRemaining = cycleEnd.DayNumber - today.DayNumber;

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
            Content = $"Your subscription for \u0022{hall.Name}\u0022 ends on {cycleEnd.ToString("yyyy-MM-dd")} ({daysRemaining} days remaining). "
                + "Please renew your subscription to keep management access to this hall active."
        };

        await _messageRepository.AddAsync(message, cancellationToken);
    }

    private async Task<bool> TrySendEmailWarningAsync(
        Hall hall,
        DateOnly cycleEnd,
        int daysRemaining,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(hall.OwnerId))
        {
            return false;
        }

        var ownerEmail = await _adminDashboardRepository.GetUserEmailAsync(hall.OwnerId, cancellationToken);
        var emailDelivered = false;

        if (!string.IsNullOrWhiteSpace(ownerEmail))
        {
            emailDelivered = await _emailService.TrySendAsync(
                ownerEmail,
                $"Wesal: your subscription for {hall.Name} ends soon",
                $"Your Wesal hall \u0022{hall.Name}\u0022 subscription cycle ends on {cycleEnd.ToString("yyyy-MM-dd")} "
                    + $"({daysRemaining} days remaining). Please renew your subscription to keep management access active.",
                cancellationToken);
        }

        return emailDelivered;
    }
}