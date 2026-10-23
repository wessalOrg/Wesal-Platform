using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IOwnerExternalBookingService
{
    Task<ExternalBookingDto> CreateAsync(Guid hallId, ExternalBookingRequest request, string key, CancellationToken ct = default);
    Task<ExternalBookingDto> UpdateAsync(Guid hallId, Guid bookingId, ExternalBookingRequest request, string key, long revision, CancellationToken ct = default);
    Task<ExternalBookingDto> CancelAsync(Guid hallId, Guid bookingId, CancelExternalBookingRequest request, string key, long revision, CancellationToken ct = default);
    Task<ExternalBookingDto> GetAsync(Guid hallId, Guid bookingId, CancellationToken ct = default);
    Task<ExternalBookingPage> ListAsync(Guid hallId, DateOnly fromDate, DateOnly toDate, int page, int pageSize, CancellationToken ct = default);
    Task<IReadOnlyList<ExternalBookingAuditDto>> HistoryAsync(Guid hallId, Guid bookingId, CancellationToken ct = default);
}
