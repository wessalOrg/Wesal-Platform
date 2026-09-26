using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.OwnerDashboard;

namespace Wesal.Tests.TestDoubles;

/// <summary>
/// Records the owner-facing realtime notifications emitted by booking flows
/// (WESAL-TASK-8, Edit 8) and can be told to fail, so a test can assert that a
/// notification was attempted without caring about SignalR, and can prove the
/// delivery is best-effort by making it throw.
/// </summary>
internal sealed class RecordingOwnerBookingRequestNotifier : IOwnerBookingRequestNotifier
{
    public List<(string OwnerUserId, OwnerBookingRequestNotificationEvent Event)> Received { get; } = [];

    public List<(string OwnerUserId, OwnerBookingCancellationNotificationEvent Event)> Cancellations { get; } = [];

    /// <summary>When set, every delivery throws, standing in for a SignalR outage.</summary>
    public bool ShouldFail { get; set; }

    public Task NotifyBookingRequestReceivedAsync(
        string ownerUserId,
        OwnerBookingRequestNotificationEvent notification,
        CancellationToken cancellationToken = default)
    {
        if (ShouldFail)
        {
            throw new InvalidOperationException("Simulated notification transport failure.");
        }

        Received.Add((ownerUserId, notification));

        return Task.CompletedTask;
    }

    public Task NotifyBookingRequestCancelledAsync(
        string ownerUserId,
        OwnerBookingCancellationNotificationEvent notification,
        CancellationToken cancellationToken = default)
    {
        if (ShouldFail)
        {
            throw new InvalidOperationException("Simulated notification transport failure.");
        }

        Cancellations.Add((ownerUserId, notification));

        return Task.CompletedTask;
    }
}

/// <summary>
/// Stands in for <see cref="IBookingAcceptanceService"/> where the acceptance flow is not
/// what is under test (conversation reads, authorization checks). Its retry hook is a
/// no-op so a conversation read cannot accidentally depend on booking behaviour.
/// </summary>
internal sealed class NoOpBookingAcceptanceService : IBookingAcceptanceService
{
    public Task<AcceptBookingResultDto> AcceptBookingAsync(
        Guid hallId,
        Guid bookingId,
        AcceptBookingRequestDto request,
        CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Acceptance is not exercised by this test.");

    public Task<int> DeliverPendingAcceptanceNotificationsAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(0);
}

/// <summary>
/// Captures the approval notices a booking produces, so a test can assert the requester
/// was told how much to pay, on which conversation, and with which sender. It behaves like
/// a conversation store, which is what makes the notice inspectable.
/// </summary>
internal sealed class RecordingConversationRepository : IConversationRepository
{
    public List<Conversation> Conversations { get; } = [];

    public Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default)
    {
        Conversations.Add(conversation);

        return Task.CompletedTask;
    }

    public Task<Conversation?> GetByHallAndUserAsync(
        Guid hallId,
        string userId,
        CancellationToken cancellationToken = default)
        => Task.FromResult(Conversations.FirstOrDefault(conversation =>
            conversation.HallId == hallId
            && (string.Equals(conversation.SenderUserId, userId, StringComparison.OrdinalIgnoreCase)
                || string.Equals(conversation.HallOwnerId, userId, StringComparison.OrdinalIgnoreCase))));

    public Task<Conversation?> GetByIdAsync(Guid conversationId, CancellationToken cancellationToken = default)
        => Task.FromResult(Conversations.FirstOrDefault(conversation => conversation.Id == conversationId));

    public Task<Conversation?> GetByIdWithHallAsync(Guid conversationId, CancellationToken cancellationToken = default)
        => Task.FromResult(Conversations.FirstOrDefault(conversation => conversation.Id == conversationId));

    public Task<IReadOnlyList<Conversation>> GetParticipantConversationsAsync(
        string userId,
        CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<Conversation>>([]);

    public Task<IReadOnlyList<UserDisplayInfo>> GetUserDisplayNamesAsync(
        IReadOnlyCollection<string> userIds,
        CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<UserDisplayInfo>>([]);

    public Task UpsertReadStateAsync(
        Guid conversationId,
        string userId,
        DateTimeOffset lastReadAt,
        CancellationToken cancellationToken = default)
        => Task.CompletedTask;

    public Task HideConversationAsync(
        Guid conversationId,
        string userId,
        DateTimeOffset hiddenAt,
        CancellationToken cancellationToken = default)
        => Task.CompletedTask;

    public Task<int> GetUnreadConversationCountAsync(string userId, CancellationToken cancellationToken = default)
        => Task.FromResult(0);

    public Task<Dictionary<Guid, bool>> GetUnreadStatusAsync(
        string userId,
        IReadOnlyCollection<Guid> conversationIds,
        CancellationToken cancellationToken = default)
        => Task.FromResult(conversationIds.ToDictionary(id => id, _ => false));
}

/// <summary>Captures every message written, including the approval notice.</summary>
internal sealed class RecordingMessageRepository : IMessageRepository
{
    public List<Message> Messages { get; } = [];

    /// <summary>When set, every write throws, standing in for a failing message store.</summary>
    public bool FailWrites { get; set; }

    public Task AddAsync(Message message, CancellationToken cancellationToken = default)
    {
        if (FailWrites)
        {
            throw new InvalidOperationException("Simulated message store failure.");
        }

        Messages.Add(message);

        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<Message>> GetByConversationAsync(
        Guid conversationId,
        CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<Message>>(
            Messages.Where(message => message.ConversationId == conversationId).ToList());

    public Task<Message?> GetByIdAsync(Guid messageId, CancellationToken cancellationToken = default)
        => Task.FromResult(Messages.FirstOrDefault(message => message.Id == messageId));

    public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        => Task.CompletedTask;

    public Task<Message?> GetByClientRequestIdAsync(
        string senderUserId,
        string clientRequestId,
        CancellationToken cancellationToken = default)
        => Task.FromResult<Message?>(null);

    public Task<IReadOnlyList<Message>> GetByConversationIdsAsync(
        IReadOnlyCollection<Guid> conversationIds,
        CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<Message>>(
            Messages.Where(message => conversationIds.Contains(message.ConversationId)).ToList());
}

/// <summary>
/// An in-memory <see cref="IBookingRepository"/> that applies the same slot state machine
/// as the real one: Available -> Reserved on a request, Reserved -> Booked on payment
/// confirmation, and any held state -> Available on release. WESAL-TASK-8 (Edit 8) makes
/// the Reserved state load-bearing, so a fake that ignored it would let double-booking
/// regressions pass unnoticed.
/// </summary>
internal sealed class FakeHourlySlotStore : IBookingRepository
{
    private readonly Dictionary<(Guid HallId, DateOnly Date, TimeOnly Start), HallSlotStatus> _slots = [];

    public List<Booking> Bookings { get; } = [];

    public List<Booking> PendingAcceptanceNotifications { get; } = [];

    public List<Booking> PendingRejectionNotifications { get; } = [];

    /// <summary>When set, the next lifecycle write reports a lost race, as if another caller won.</summary>
    public bool SimulateLostRace { get; set; }

    public Dictionary<TimeOnly, HallSlotStatus> SlotsFor(Guid hallId, DateOnly date)
    {
        var result = new Dictionary<TimeOnly, HallSlotStatus>();

        foreach (var ((slotHallId, slotDate, start), status) in _slots)
        {
            if (slotHallId == hallId && slotDate == date)
            {
                result[start] = status;
            }
        }

        return result;
    }

    /// <summary>Puts a single hour into a known state, standing in for rows seeded in the database.</summary>
    public void Seed(Guid hallId, DateOnly date, TimeOnly start, HallSlotStatus status)
        => _slots[(hallId, date, start)] = status;

    /// <summary>Captures slot state so a test unit of work can roll a failed transaction back.</summary>
    public Dictionary<(Guid HallId, DateOnly Date, TimeOnly Start), HallSlotStatus> SnapshotSlots()
        => new(_slots);

    /// <summary>Restores a <see cref="SnapshotSlots"/> capture after a rolled-back transaction.</summary>
    public void RestoreSlots(Dictionary<(Guid HallId, DateOnly Date, TimeOnly Start), HallSlotStatus> snapshot)
    {
        _slots.Clear();

        foreach (var entry in snapshot)
        {
            _slots[entry.Key] = entry.Value;
        }
    }

    public Task AddAsync(Booking booking, CancellationToken cancellationToken = default)
    {
        Bookings.Add(booking);

        return Task.CompletedTask;
    }

    public Task<Booking?> GetByIdWithHallAsync(Guid bookingId, CancellationToken cancellationToken = default)
        => Task.FromResult(Bookings.FirstOrDefault(booking => booking.Id == bookingId));

    public Task<IReadOnlyList<Booking>> GetPendingAcceptanceNotificationsAsync(CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<Booking>>(PendingAcceptanceNotifications);

    public Task<IReadOnlyList<Booking>> GetPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<Booking>>(PendingRejectionNotifications);

    public Task<int> CancelPendingAsync(
        Guid bookingId,
        string requesterUserId,
        CancellationToken cancellationToken = default)
    {
        if (SimulateLostRace)
        {
            return Task.FromResult(0);
        }

        var booking = Bookings.FirstOrDefault(candidate =>
            candidate.Id == bookingId
            && candidate.RequesterUserId == requesterUserId
            && (candidate.Status == BookingStatus.Pending || candidate.Status == BookingStatus.Accepted)
            && candidate.DepositPaymentConfirmedAt is null);

        if (booking is null)
        {
            return Task.FromResult(0);
        }

        booking.Status = BookingStatus.Cancelled;

        return Task.FromResult(1);
    }

    public Task<int> AcceptPendingAsync(
        Guid bookingId,
        decimal depositAmount,
        CancellationToken cancellationToken = default)
    {
        if (SimulateLostRace)
        {
            return Task.FromResult(0);
        }

        var pending = Bookings.FirstOrDefault(booking =>
            booking.Id == bookingId
            && booking.Status == BookingStatus.Pending);

        if (pending is null)
        {
            return Task.FromResult(0);
        }

        pending.Status = BookingStatus.Accepted;
        pending.DepositAmount = depositAmount;

        return Task.FromResult(1);
    }

    public Task<int> ConfirmDepositPaymentAsync(
        Guid bookingId,
        DateTimeOffset confirmedAt,
        CancellationToken cancellationToken = default)
    {
        var approved = Bookings.FirstOrDefault(booking =>
            booking.Id == bookingId
            && booking.Status == BookingStatus.Accepted
            && booking.DepositPaymentConfirmedAt is null);

        if (approved is null)
        {
            return Task.FromResult(0);
        }

        approved.DepositPaymentConfirmedAt = confirmedAt;

        return Task.FromResult(1);
    }

    public Task<int> DeleteAsync(Guid bookingId, CancellationToken cancellationToken = default)
    {
        var booking = Bookings.FirstOrDefault(candidate => candidate.Id == bookingId);

        if (booking is null)
        {
            return Task.FromResult(0);
        }

        Bookings.Remove(booking);

        return Task.FromResult(1);
    }

    public Task<bool> IsDayOpenAsync(Guid hallId, DateOnly date, CancellationToken cancellationToken = default)
        => Task.FromResult(true);

    public Task<IReadOnlyList<HallDayAvailability>> GetDayGatesAsync(
        Guid hallId,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<HallDayAvailability>>([]);

    public Task<IReadOnlyList<HallSlotAvailability>> GetHourlySlotsAsync(
        Guid hallId,
        DateOnly date,
        CancellationToken cancellationToken = default)
    {
        var rows = SlotsFor(hallId, date)
            .Select(entry => new HallSlotAvailability
            {
                HallId = hallId,
                Date = date,
                StartTime = entry.Key,
                Status = entry.Value
            })
            .ToList();

        return Task.FromResult<IReadOnlyList<HallSlotAvailability>>(rows);
    }

    public Task<int> ReserveHourlySlotsAsync(
        Guid hallId,
        DateOnly date,
        IReadOnlyList<TimeOnly> startTimes,
        CancellationToken cancellationToken = default)
    {
        var claimed = 0;

        foreach (var start in startTimes)
        {
            var key = (hallId, date, start);

            if (_slots.TryGetValue(key, out var status) && status != HallSlotStatus.Available)
            {
                return Task.FromResult(claimed);
            }

            _slots[key] = HallSlotStatus.Reserved;
            claimed++;
        }

        return Task.FromResult(claimed);
    }

    public Task<int> ConfirmReservedHourlySlotsAsync(
        Guid hallId,
        DateOnly date,
        IReadOnlyList<TimeOnly> startTimes,
        CancellationToken cancellationToken = default)
    {
        var confirmed = 0;

        foreach (var start in startTimes)
        {
            var key = (hallId, date, start);

            // Mirrors the real conditional UPDATE: a slot that lost its hold (Available) is
            // never promoted, so the caller sees a short count and refuses to confirm.
            if (!_slots.TryGetValue(key, out var status) || status == HallSlotStatus.Available)
            {
                return Task.FromResult(confirmed);
            }

            _slots[key] = HallSlotStatus.Booked;
            confirmed++;
        }

        return Task.FromResult(confirmed);
    }

    public Task<int> ReleaseBookingSlotsAsync(
        Guid bookingId,
        Guid hallId,
        DateOnly date,
        IReadOnlyList<TimeOnly> slotStarts,
        CancellationToken cancellationToken = default)
    {
        var released = 0;

        foreach (var start in slotStarts)
        {
            var key = (hallId, date, start);

            if (!_slots.TryGetValue(key, out var status) || status == HallSlotStatus.Available)
            {
                continue;
            }

            _slots[key] = HallSlotStatus.Available;
            released++;
        }

        return Task.FromResult(released);
    }

    public Task SetDayOpenAsync(
        Guid hallId,
        DateOnly date,
        bool isOpen,
        CancellationToken cancellationToken = default)
        => Task.CompletedTask;

    public Task<bool> HasActiveBookingsOnDayAsync(
        Guid hallId,
        DateOnly date,
        CancellationToken cancellationToken = default)
        => Task.FromResult(false);

    public Task<bool> HasActiveHourlyBookingsOutsideWindowAsync(
        Guid hallId,
        TimeOnly windowStart,
        TimeOnly windowEnd,
        CancellationToken cancellationToken = default)
        => Task.FromResult(false);
}
