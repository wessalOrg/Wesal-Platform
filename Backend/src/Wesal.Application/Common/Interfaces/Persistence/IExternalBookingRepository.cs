using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IExternalBookingRepository
{
    // External operations own their unit of work. Clear tracked state at the start of
    // every execution-strategy attempt so retries reload the committed database state.
    void ResetTracking();
    Task<Booking?> GetAsync(Guid hallId, Guid bookingId, CancellationToken ct);
    Task<IReadOnlyList<Booking>> ListAsync(Guid hallId, DateOnly from, DateOnly to, int skip, int take, CancellationToken ct);
    Task<BookingMutationReceipt?> ReceiptAsync(Guid hallId, string actor, string operation, string key, CancellationToken ct);
    Task<IReadOnlyList<BookingAuditEvent>> HistoryAsync(Guid bookingId, CancellationToken ct);
    void Add(Booking booking);
    void AddAudit(BookingAuditEvent audit);
    void AddReceipt(BookingMutationReceipt receipt);
    void ReplaceSlots(Booking booking, IReadOnlyList<TimeOnly> starts);
    Task<int> BookAvailableAsync(Guid hallId, DateOnly date, IReadOnlyList<TimeOnly> starts, CancellationToken ct);
}
