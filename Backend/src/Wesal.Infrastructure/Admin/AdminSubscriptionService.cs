using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.AiAssistant;

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
    private readonly IDateTime _dateTime;

    public AdminSubscriptionService(
        IAdminDashboardRepository adminDashboardRepository,
        IHallRepository hallRepository,
        IOptions<SubscriptionPaymentOptions> subscriptionPaymentOptions,
        IUnitOfWork unitOfWork,
        IDateTime dateTime)
    {
        _adminDashboardRepository = adminDashboardRepository;
        _hallRepository = hallRepository;
        _subscriptionPaymentOptions = subscriptionPaymentOptions;
        _unitOfWork = unitOfWork;
        _dateTime = dateTime;
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