using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class ExternalBookingRepository(ApplicationDbContext db) : IExternalBookingRepository
{
    public void ResetTracking() => db.ChangeTracker.Clear();

    public Task<Booking?> GetAsync(Guid hallId, Guid bookingId, CancellationToken ct) => db.Bookings
        .Include(x => x.Slots).Include(x => x.ExternalDetails)
        .SingleOrDefaultAsync(x => x.Id == bookingId && x.HallId == hallId && x.Source == BookingSource.ExternalManual, ct);

    public async Task<IReadOnlyList<Booking>> ListAsync(Guid hallId, DateOnly from, DateOnly to, int skip, int take, CancellationToken ct)
        => await db.Bookings.AsNoTracking().Include(x => x.Slots).Include(x => x.ExternalDetails)
            .Where(x => x.HallId == hallId && x.Source == BookingSource.ExternalManual && x.Date >= from && x.Date <= to)
            .OrderBy(x => x.Date).ThenBy(x => x.Id).Skip(skip).Take(take).ToListAsync(ct);

    public Task<BookingMutationReceipt?> ReceiptAsync(Guid hallId, string actor, string operation, string key, CancellationToken ct)
        => db.Set<BookingMutationReceipt>().AsNoTracking().SingleOrDefaultAsync(x => x.HallId == hallId &&
            x.ActorUserId == actor && x.Operation == operation && x.Key == key, ct);

    public async Task<IReadOnlyList<BookingAuditEvent>> HistoryAsync(Guid bookingId, CancellationToken ct)
        => await db.Set<BookingAuditEvent>().AsNoTracking().Where(x => x.BookingId == bookingId)
            .OrderBy(x => x.Revision).ToListAsync(ct);

    public void Add(Booking booking) => db.Bookings.Add(booking);
    public void AddAudit(BookingAuditEvent audit) => db.Set<BookingAuditEvent>().Add(audit);
    public void AddReceipt(BookingMutationReceipt receipt) => db.Set<BookingMutationReceipt>().Add(receipt);

    public void ReplaceSlots(Booking booking, IReadOnlyList<TimeOnly> starts)
    {
        foreach (var old in booking.Slots.Where(x => !starts.Contains(x.StartTime)).ToArray())
        {
            db.BookingSlots.Remove(old);
            booking.Slots.Remove(old);
        }
        foreach (var start in starts.Where(x => booking.Slots.All(s => s.StartTime != x)))
        {
            // These entities generate GUIDs in their constructor. Explicitly mark a new
            // slot Added; graph discovery on an existing booking otherwise treats its
            // non-default key as an existing row and attempts an UPDATE.
            var slot = new BookingSlot { BookingId = booking.Id, StartTime = start, EndTime = start.AddHours(1) };
            booking.Slots.Add(slot);
            db.BookingSlots.Add(slot);
        }
    }

    public async Task<int> BookAvailableAsync(Guid hallId, DateOnly date, IReadOnlyList<TimeOnly> starts, CancellationToken ct)
    {
        var claimed = 0;
        foreach (var start in starts.Order())
        {
            if (db.Database.IsRelational())
            {
                claimed += await db.Database.ExecuteSqlInterpolatedAsync($"""
                    INSERT INTO wesal."HallSlotAvailabilities" ("Id", "HallId", "Date", "StartTime", "Status", "CreatedAt", "UpdatedAt")
                    VALUES ({Guid.NewGuid()}, {hallId}, {date}, {start}, {(int)HallSlotStatus.Booked}, {DateTimeOffset.UtcNow}, {DateTimeOffset.UtcNow})
                    ON CONFLICT ("HallId", "Date", "StartTime") DO UPDATE
                    SET "Status" = {(int)HallSlotStatus.Booked}, "UpdatedAt" = {DateTimeOffset.UtcNow}
                    WHERE wesal."HallSlotAvailabilities"."Status" = {(int)HallSlotStatus.Available};
                    """, ct);
            }
            else
            {
                var slot = await db.HallSlotAvailabilities.SingleOrDefaultAsync(x => x.HallId == hallId && x.Date == date && x.StartTime == start, ct);
                if (slot is null) { db.HallSlotAvailabilities.Add(new HallSlotAvailability { HallId = hallId, Date = date, StartTime = start, Status = HallSlotStatus.Booked }); claimed++; }
                else if (slot.Status == HallSlotStatus.Available) { slot.Status = HallSlotStatus.Booked; claimed++; }
            }
        }
        return claimed;
    }
}
