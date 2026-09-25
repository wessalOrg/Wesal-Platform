using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Entities;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.OwnerDashboard;

/// <summary>
/// Owner-facing hourly-slot availability management (WESAL-TASK-1). Mirrors the
/// ownership and access conventions of <see cref="OwnerAvailabilityService"/>: the owner
/// id is resolved exclusively from the authenticated session, the hall is fetched through
/// the ownership-scoped repository (so a wrong-owner call surfaces as not-found rather
/// than leaking another owner's hall), and <see cref="HallManagementAccess"/> gates the
/// change on the hall's lock/payment state.
/// </summary>
public sealed class OwnerHourlyAvailabilityService : IOwnerHourlyAvailabilityService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUser;
    private readonly IOwnerDashboardRepository _ownerDashboardRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly IUnitOfWork _unitOfWork;

    public OwnerHourlyAvailabilityService(
        UserManager<ApplicationUser> userManager,
        ICurrentUserService currentUser,
        IOwnerDashboardRepository ownerDashboardRepository,
        IBookingRepository bookingRepository,
        IUnitOfWork unitOfWork)
    {
        _userManager = userManager;
        _currentUser = currentUser;
        _ownerDashboardRepository = ownerDashboardRepository;
        _bookingRepository = bookingRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<OwnerDayBlockResultDto> SetDayBlockAsync(
        Guid hallId,
        OwnerDayBlockRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var ownerId = await ResolveOwnerAsync(cancellationToken);

        var hall = await _ownerDashboardRepository.GetOwnedHallForUpdateAsync(hallId, ownerId, cancellationToken)
            ?? throw new NotFoundException(nameof(Hall), hallId);

        HallManagementAccess.EnsureAllowed(hall);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        if (request.Date < today)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Date"] = ["A day can only be blocked or unblocked for today or a future date."]
            });
        }

        // Blocking must never silently orphan a live booking. Reuse the codebase's
        // existing rule for an occupied unit (Pending or Accepted is "active") and
        // refuse the block with the same ConflictException shape the legacy period
        // release path uses.
        if (!request.IsOpen && await _bookingRepository.HasActiveBookingsOnDayAsync(hallId, request.Date, cancellationToken))
        {
            throw new ConflictException(
                $"This day already has an active booking and cannot be blocked. Cancel or complete the booking first.");
        }

        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _bookingRepository.SetDayOpenAsync(hallId, request.Date, request.IsOpen, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);

        return new OwnerDayBlockResultDto
        {
            HallId = hallId,
            Date = request.Date,
            IsOpen = request.IsOpen
        };
    }

    public async Task<OwnerHourlySettingsDto> UpdateHourlySettingsAsync(
        Guid hallId,
        UpdateOwnerHourlySettingsRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var ownerId = await ResolveOwnerAsync(cancellationToken);

        var hall = await _ownerDashboardRepository.GetOwnedHallForUpdateAsync(hallId, ownerId, cancellationToken)
            ?? throw new NotFoundException(nameof(Hall), hallId);

        HallManagementAccess.EnsureAllowed(hall);

        // Merge the partial request over the current persisted values so an omitted
        // property is left untouched, then validate the *effective* window.
        var effectiveStart = request.HourlySlotStart ?? hall.HourlySlotStart ?? DefaultWindowStart;
        var effectiveEnd = request.HourlySlotEnd ?? hall.HourlySlotEnd ?? DefaultWindowEnd;

        if (effectiveStart >= effectiveEnd)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["HourlySlotStart"] = ["The bookable window must start before it ends (HourlySlotStart < HourlySlotEnd)."]
            });
        }

        if (request.ShowBookedSlots.HasValue)
        {
            hall.ShowBookedSlots = request.ShowBookedSlots.Value;
        }

        if (request.HourlySlotStart.HasValue)
        {
            hall.HourlySlotStart = request.HourlySlotStart.Value;
        }

        if (request.HourlySlotEnd.HasValue)
        {
            hall.HourlySlotEnd = request.HourlySlotEnd.Value;
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new OwnerHourlySettingsDto
        {
            HallId = hallId,
            ShowBookedSlots = hall.ShowBookedSlots,
            HourlySlotStart = hall.HourlySlotStart ?? DefaultWindowStart,
            HourlySlotEnd = hall.HourlySlotEnd ?? DefaultWindowEnd
        };
    }

    private static readonly TimeOnly DefaultWindowStart = new(9, 0);
    private static readonly TimeOnly DefaultWindowEnd = new(22, 0);

    private async Task<string> ResolveOwnerAsync(CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
            throw new UnauthorizedException("You must be logged in to manage availability.");

        var user = await _userManager.FindByIdAsync(_currentUser.UserId);

        if (user is null)
            throw new NotFoundException("User", _currentUser.UserId);

        return _currentUser.UserId;
    }
}
