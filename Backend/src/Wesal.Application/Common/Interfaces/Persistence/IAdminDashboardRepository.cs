using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

/// <summary>
/// Read queries backing the Admin Panel hall-review and subscription dashboards
/// (US-ADMIN-01/09/11). All methods are admin-scoped; the admin role itself is
/// enforced at the controller/authorization layer and never here.
/// </summary>
public interface IAdminDashboardRepository
{
    Task<IReadOnlyList<AdminPendingHallDto>> GetPendingHallsAsync(
        int skip,
        int take,
        CancellationToken cancellationToken = default);

    Task<int> GetPendingHallsCountAsync(CancellationToken cancellationToken = default);

    Task<AdminHallDetailRow?> GetHallDetailForAdminAsync(
        Guid hallId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AdminSubscriptionHallRow>> GetSubscriptionOverviewAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Hall>> GetExpiredPaidCyclesAsync(
        DateOnly today,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Hall>> GetSubscriptionExpiryWarningCandidatesAsync(
        DateOnly today,
        int warningDays,
        CancellationToken cancellationToken = default);

    Task<string?> GetUserEmailAsync(
        string userId,
        CancellationToken cancellationToken = default);
}