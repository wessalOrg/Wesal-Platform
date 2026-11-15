using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IEventRequestService
{
    Task<IReadOnlyList<EventTypeConfiguration>> GetConfigurationAsync(CancellationToken cancellationToken = default);
    Task<EventRequestResponse> CreateAsync(EventRequestCreateRequest request, CancellationToken cancellationToken = default);
    Task<PagedResult<AdminEventRequestResponse>> GetAdminRequestsAsync(int page, int pageSize, DateOnly? from, DateOnly? to, string? eventType, string? seekerId, CancellationToken cancellationToken = default);
    Task ProcessPendingAsync(CancellationToken cancellationToken = default);
    Task<AdminEventRequestResponse?> GetAdminRequestAsync(Guid id, CancellationToken cancellationToken = default);
}
