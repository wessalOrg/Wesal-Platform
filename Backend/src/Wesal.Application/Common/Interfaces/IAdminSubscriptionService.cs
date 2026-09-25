using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Admin subscription overview across all halls and owners (US-ADMIN-11, FR-SUB-06).
/// Every value is computed live from the persisted hall records on each call — never
/// cached — so the dashboard always reflects the latest lock/payment state before the
/// Admin acts on it.
/// </summary>
public interface IAdminSubscriptionService
{
    Task<IReadOnlyList<AdminSubscriptionOwnerGroupDto>> GetSubscriptionOverviewAsync(
        AdminSubscriptionOverviewQueryDto query,
        CancellationToken cancellationToken = default);

    Task<AdminMarkPaidResultDto> MarkSubscriptionPaidAsync(
        Guid hallId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes a confirmed subscription payment (WESAL-TASK-4, Edit 4): sets
    /// <c>PaymentStatus = Unpaid</c> and clears the cycle dates. A direct administrative
    /// action, entirely independent of whether any payment-proof message exists.
    /// </summary>
    Task<AdminMarkPaidResultDto> MarkSubscriptionNotPaidAsync(
        Guid hallId,
        CancellationToken cancellationToken = default);
}