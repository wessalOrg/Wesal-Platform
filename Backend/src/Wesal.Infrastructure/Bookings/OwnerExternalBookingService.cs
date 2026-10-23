using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Authorization;

namespace Wesal.Infrastructure.Bookings;

public sealed class OwnerExternalBookingService(
    IExternalBookingRepository repository, IBookingRepository bookings, IOwnerDashboardRepository owners,
    IUnitOfWork unit, ICurrentUserService current, IDateTime clock,
    IAccountLockService accountLocks, UserManager<ApplicationUser> users,
    IValidator<ExternalBookingRequest> validator) : IOwnerExternalBookingService
{
    private static readonly TimeZoneInfo HallZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Hebron");

    public Task<ExternalBookingDto> CreateAsync(Guid hallId, ExternalBookingRequest request, string key, CancellationToken ct = default)
        => MutateAsync(hallId, null, Normalize(request), null, key, null, ct);

    public Task<ExternalBookingDto> UpdateAsync(Guid hallId, Guid bookingId, ExternalBookingRequest request, string key, long revision, CancellationToken ct = default)
        => MutateAsync(hallId, bookingId, Normalize(request), null, key, revision, ct);

    public Task<ExternalBookingDto> CancelAsync(Guid hallId, Guid bookingId, CancelExternalBookingRequest request, string key, long revision, CancellationToken ct = default)
        => MutateAsync(hallId, bookingId, null, request with { Reason = request.Reason?.Trim() ?? "" }, key, revision, ct);

    private async Task<ExternalBookingDto> MutateAsync(Guid hallId, Guid? id, ExternalBookingRequest? request,
        CancelExternalBookingRequest? cancel, string key, long? revision, CancellationToken ct)
    {
        var actor = await ActorAsync(ct);
        if (!Guid.TryParse(key, out var parsedKey)) throw Error(400, "IdempotencyKeyRequired", "A UUID Idempotency-Key is required.");
        key = parsedKey.ToString();
        if (request is not null)
        {
            var validation = await validator.ValidateAsync(request, ct);
            if (!validation.IsValid) throw new Wesal.Domain.Exceptions.ValidationException(validation.Errors
                .GroupBy(x => x.PropertyName).ToDictionary(x => x.Key, x => x.Select(e => e.ErrorMessage).ToArray()));
        }
        if (cancel?.Reason.Length > 1000) throw Error(400, "InvalidCancellationReason", "The reason must not exceed 1000 characters.");
        var operation = cancel is not null ? $"cancel:{id}" : id.HasValue ? $"update:{id}" : "create";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { request, cancel, revision }))));

        return await unit.ExecuteInTransactionAsync(async () =>
        {
            repository.ResetTracking();
            if (!await bookings.LockHallForAvailabilityChangeAsync(hallId, ct)) throw new NotFoundException(nameof(Hall), hallId);
            var hall = await OwnedHallAsync(hallId, actor, ct);
            var receipt = await repository.ReceiptAsync(hallId, actor, operation, key, ct);
            if (receipt is not null)
            {
                if (receipt.RequestHash != hash) throw Error(409, "IdempotencyKeyReused", "This key was already used for a different request.");
                return JsonSerializer.Deserialize<ExternalBookingDto>(receipt.ResponseJson)!;
            }

            var booking = id.HasValue ? await repository.GetAsync(hallId, id.Value, ct)
                ?? throw new NotFoundException(nameof(Booking), id.Value) : null;
            var before = booking is null ? null : JsonSerializer.Serialize(Map(booking));
            var now = clock.Now;
            if (booking is not null && !(cancel is not null && booking.Status == BookingStatus.Cancelled))
            {
                if (revision is null or <= 0) throw Error(428, "RevisionRequired", "If-Match is required.");
                if (booking.Revision != revision) throw Error(412, "RevisionConflict", "This booking changed. Reload it before retrying.");
                if (booking.Status != BookingStatus.Confirmed) throw Error(409, "ExternalBookingCancelled", "A cancelled booking cannot be edited.");
            }

            if (cancel is not null)
            {
                if (booking!.Status != BookingStatus.Cancelled)
                {
                    booking.Status = BookingStatus.Cancelled;
                    booking.ExternalDetails!.CancelledAt = now;
                    booking.ExternalDetails.CancelledBy = actor;
                    booking.ExternalDetails.CancellationReason = cancel.Reason;
                    booking.Revision++;
                    booking.UpdatedAt = now;
                    booking.UpdatedBy = actor;
                    await unit.SaveChangesAsync(ct);
                    await bookings.ReleaseBookingSlotsAsync(booking.Id, hallId, booking.Date, booking.Slots.Select(x => x.StartTime).ToArray(), ct);
                    Audit(booking, "Cancelled", actor, now, before);
                }
            }
            else
            {
                var starts = request!.SlotStarts.ToArray();
                var oldDate = booking?.Date;
                var oldStarts = booking?.Slots.Select(x => x.StartTime).ToArray() ?? [];
                var scheduleChanged = booking is null || oldDate != request.Date || !oldStarts.Order().SequenceEqual(starts);
                if (scheduleChanged)
                {
                    EnsureEligible(hall);
                    ValidateSchedule(hall, request.Date, starts, now);
                    if (!await bookings.IsDayOpenAsync(hallId, request.Date, ct)) throw Error(409, "DayBlocked", "This day is blocked.");
                    var added = oldDate == request.Date ? starts.Except(oldStarts).ToArray() : starts;
                    if (await repository.BookAvailableAsync(hallId, request.Date, added, ct) != added.Length)
                        throw Error(409, "SlotUnavailable", "One or more selected hours are unavailable.");
                }
                var isNew = booking is null;
                booking ??= new Booking { HallId = hallId, Source = BookingSource.ExternalManual,
                    Status = BookingStatus.Confirmed, RequesterUserId = null, CreatedAt = now, CreatedBy = actor,
                    ExternalDetails = new ExternalBookingDetails { ConfirmedAt = now } };
                if (!isNew) { booking.Revision++; booking.UpdatedAt = now; booking.UpdatedBy = actor; }
                booking.Date = request.Date;
                ApplyDetails(booking.ExternalDetails!, request);
                repository.ReplaceSlots(booking, starts);
                if (isNew) repository.Add(booking);
                await unit.SaveChangesAsync(ct);
                if (oldDate.HasValue && scheduleChanged)
                {
                    var removed = oldDate == request.Date ? oldStarts.Except(starts).ToArray() : oldStarts;
                    await bookings.ReleaseBookingSlotsAsync(booking.Id, hallId, oldDate.Value, removed, ct);
                }
                Audit(booking, isNew ? "Created" : "Updated", actor, now, before);
            }

            var response = Map(booking!);
            repository.AddReceipt(new BookingMutationReceipt { HallId = hallId, ActorUserId = actor,
                Operation = operation, Key = key, RequestHash = hash, ResponseJson = JsonSerializer.Serialize(response), CreatedAt = now });
            await unit.SaveChangesAsync(ct);
            return response;
        }, ct);
    }

    public async Task<ExternalBookingDto> GetAsync(Guid hallId, Guid bookingId, CancellationToken ct = default)
    {
        await OwnedHallAsync(hallId, await ActorAsync(ct), ct);
        return Map(await repository.GetAsync(hallId, bookingId, ct) ?? throw new NotFoundException(nameof(Booking), bookingId));
    }

    public async Task<ExternalBookingPage> ListAsync(Guid hallId, DateOnly fromDate, DateOnly toDate, int page, int pageSize, CancellationToken ct = default)
    {
        await OwnedHallAsync(hallId, await ActorAsync(ct), ct);
        if (fromDate == default || toDate < fromDate || toDate.DayNumber - fromDate.DayNumber > 366 || page is < 1 or > 10000 || pageSize is < 1 or > 100)
            throw Error(400, "InvalidPage", "Use a date range of at most 366 days, page 1–10000, and pageSize 1–100.");
        return new ExternalBookingPage((await repository.ListAsync(hallId, fromDate, toDate, (page - 1) * pageSize, pageSize, ct)).Select(Map).ToArray(), page, pageSize);
    }

    public async Task<IReadOnlyList<ExternalBookingAuditDto>> HistoryAsync(Guid hallId, Guid bookingId, CancellationToken ct = default)
    {
        await GetAsync(hallId, bookingId, ct);
        return (await repository.HistoryAsync(bookingId, ct)).Select(x => new ExternalBookingAuditDto(x.Revision, x.Operation, x.ActorUserId, x.OccurredAt, x.BeforeJson, x.AfterJson)).ToArray();
    }

    private async Task<string> ActorAsync(CancellationToken ct)
    {
        if (!current.IsAuthenticated || string.IsNullOrWhiteSpace(current.UserId)) throw new UnauthorizedException("Sign in to manage external bookings.");
        if (!current.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase)) throw new ForbiddenException("Hall owner access is required.");
        var user = await users.FindByIdAsync(current.UserId) ?? throw new UnauthorizedException("The account no longer exists.");
        await OwnerBookingSecurity.EnsureUnlockedAsync(users, user, accountLocks, ct);
        return current.UserId;
    }

    private async Task<Hall> OwnedHallAsync(Guid hallId, string actor, CancellationToken ct)
    {
        var hall = await owners.GetOwnedHallAsync(hallId, actor, ct) ?? throw new NotFoundException(nameof(Hall), hallId);
        if (hall.IsAdminLocked) throw Error(403, "HallLocked", "This hall is administratively locked.");
        return hall;
    }

    private void EnsureEligible(Hall hall)
    {
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.Now, HallZone).DateTime);
        if (hall.Status != HallStatus.Approved) throw Error(409, "HallNotApproved", "This hall is not approved.");
        if (hall.PaymentStatus != HallPaymentStatus.Paid || hall.SystemLocked || hall.SubscriptionCycleEnd is null || hall.SubscriptionCycleEnd < today)
            throw Error(409, "SubscriptionExpired", "An active paid subscription is required.");
    }

    internal static void ValidateSchedule(Hall hall, DateOnly date, IReadOnlyList<TimeOnly> starts, DateTimeOffset now)
    {
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, HallZone).DateTime);
        if (date < today) throw Error(400, "HourAlreadyStarted", "Every selected hour must be in the future in Asia/Hebron.");
        var start = HallBookingWindow.EffectiveStart(hall);
        var end = HallBookingWindow.EffectiveEnd(hall);
        if (start.Ticks % TimeSpan.TicksPerHour != 0 || end.Ticks % TimeSpan.TicksPerHour != 0 || start >= end)
            throw Error(409, "InvalidHallWindow", "The hall's working hours must be valid whole hours.");
        if (starts.Count == 0 || starts.Distinct().Count() != starts.Count) throw Error(400, "InvalidHours", "Select distinct hourly slots.");
        for (var i = 0; i < starts.Count; i++)
        {
            var slot = starts[i];
            if (slot.Ticks % TimeSpan.TicksPerHour != 0 || slot < start || slot >= end || slot.Hour == 23 || slot.AddHours(1) > end)
                throw Error(400, "InvalidHours", "Select whole hours inside the working window on one day.");
            var localStart = date.ToDateTime(slot, DateTimeKind.Unspecified);
            var localEnd = date.ToDateTime(slot.AddHours(1), DateTimeKind.Unspecified);
            if (HallZone.IsInvalidTime(localStart) || HallZone.IsAmbiguousTime(localStart) || HallZone.IsInvalidTime(localEnd) || HallZone.IsAmbiguousTime(localEnd))
                throw Error(400, "InvalidLocalTime", "The selected hours cross a clock change.");
            if (TimeZoneInfo.ConvertTimeToUtc(localStart, HallZone) <= now.UtcDateTime)
                throw Error(400, "HourAlreadyStarted", "Every selected hour must be in the future in Asia/Hebron.");
        }
    }

    private static ExternalBookingRequest Normalize(ExternalBookingRequest x) => x with {
        CustomerName = x.CustomerName?.Trim() ?? "", Phone = x.Phone?.Trim() ?? "", EventType = x.EventType?.Trim() ?? "",
        Notes = x.Notes?.Trim() ?? "", SlotStarts = x.SlotStarts?.Order().ToArray() ?? [] };

    private static void ApplyDetails(ExternalBookingDetails x, ExternalBookingRequest r)
    {
        x.CustomerName = r.CustomerName; x.Phone = r.Phone; x.EventType = r.EventType; x.Guests = r.Guests;
        x.Notes = r.Notes; x.TotalAmount = r.TotalAmount; x.AmountReceivedExternally = r.AmountReceivedExternally;
    }

    private void Audit(Booking booking, string operation, string actor, DateTimeOffset now, string? before) => repository.AddAudit(new BookingAuditEvent {
        BookingId = booking.Id, Revision = booking.Revision, Operation = operation, ActorUserId = actor,
        OccurredAt = now, BeforeJson = before, AfterJson = JsonSerializer.Serialize(Map(booking)) });

    private static ExternalBookingDto Map(Booking b)
    {
        var x = b.ExternalDetails!;
        return new(b.Id, b.HallId, "ExternalManual", b.Status.ToString(), b.Date, b.Slots.OrderBy(x => x.StartTime).Select(x => x.StartTime).ToArray(),
            b.HourlyTimeRange, b.Revision, x.CustomerName, x.Phone, x.EventType, x.Guests, x.Notes, x.TotalAmount,
            x.AmountReceivedExternally, x.ConfirmedAt, x.CancelledAt, x.CancellationReason, b.Status == BookingStatus.Confirmed, b.Status == BookingStatus.Confirmed);
    }

    private static ExternalBookingException Error(int status, string code, string message) => new(status, code, message);
}
