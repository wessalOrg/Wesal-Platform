using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.OwnerDashboard;

public sealed class OwnerAvailabilityService : IOwnerAvailabilityService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUser;
    private readonly IOwnerDashboardRepository _ownerDashboardRepository;
    private readonly IHallRepository _hallRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly IUnitOfWork _unitOfWork;

    public OwnerAvailabilityService(
        UserManager<ApplicationUser> userManager,
        ICurrentUserService currentUser,
        IOwnerDashboardRepository ownerDashboardRepository,
        IHallRepository hallRepository,
        IBookingRepository bookingRepository,
        IUnitOfWork unitOfWork)
    {
        _userManager = userManager;
        _currentUser = currentUser;
        _ownerDashboardRepository = ownerDashboardRepository;
        _hallRepository = hallRepository;
        _bookingRepository = bookingRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<OwnerAvailabilityCalendarDto> GetAvailabilityAsync(Guid hallId, DateOnly fromDate, DateOnly toDate, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var ownerId = await ResolveOwnerAsync(cancellationToken);

        if (toDate < fromDate)
            throw new ValidationException(new Dictionary<string, string[]> { ["ToDate"] = new[] { "End date must not be before start date." } });
        if ((toDate.DayNumber - fromDate.DayNumber) > 62)
            throw new ValidationException(new Dictionary<string, string[]> { ["ToDate"] = new[] { "Date range must not exceed 62 days." } });

        var hall = await _ownerDashboardRepository.GetOwnedHallWithDetailsAsync(hallId, ownerId, cancellationToken);
        if (hall is null)
            throw new NotFoundException(nameof(Hall), hallId);

        HallManagementAccess.EnsureAllowed(hall);

        var periods = await _hallRepository.GetBookingPeriodsAsync([hallId], cancellationToken);
        var availability = await _hallRepository.GetAvailabilityAsync([hallId], fromDate, toDate, cancellationToken);
        var availabilityByKey = availability.ToDictionary(a => (a.Date, a.PeriodType), a => a.Status);

        var days = new List<OwnerAvailabilityDayDto>();
        for (var date = fromDate; date <= toDate; date = date.AddDays(1))
        {
            var dayPeriods = periods
                .OrderBy(p => p.Type)
                .Select(p => new OwnerAvailabilityPeriodDto
                {
                    PeriodType = p.Type,
                    StartTime = p.StartTime,
                    EndTime = p.EndTime,
                    Status = availabilityByKey.TryGetValue((date, p.Type), out var status) ? status : AvailabilityStatus.Available
                }).ToList();
            days.Add(new OwnerAvailabilityDayDto { Date = date, Periods = dayPeriods });
        }

        return new OwnerAvailabilityCalendarDto { HallId = hallId, FromDate = fromDate, ToDate = toDate, Days = days };
    }

    public async Task<OwnerAvailabilityPeriodDto> UpdateAvailabilityAsync(Guid hallId, UpdateOwnerAvailabilityRequest request, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var ownerId = await ResolveOwnerAsync(cancellationToken);

        var hall = await _ownerDashboardRepository.GetOwnedHallForUpdateAsync(hallId, ownerId, cancellationToken);
        if (hall is null)
            throw new NotFoundException(nameof(Hall), hallId);

        HallManagementAccess.EnsureAllowed(hall);

        var periods = await _hallRepository.GetBookingPeriodsAsync([hallId], cancellationToken);
        var template = periods.FirstOrDefault(p => p.Type == request.PeriodType);
        if (template is null)
            throw new ValidationException(new Dictionary<string, string[]> { ["PeriodType"] = new[] { "Booking period does not belong to this hall." } });

        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            if (request.Status == AvailabilityStatus.Booked)
            {
                var reserved = await _bookingRepository.ReservePeriodAsync(hallId, request.Date, request.PeriodType, cancellationToken);
                if (reserved == 0)
                {
                    // Already booked - idempotent success, verify state
                }
            }
            else
            {
                // Booked -> Available: reject if genuinely occupied by active booking
                var hasActive = await _bookingRepository.HasOtherActiveBookingsAsync(hallId, request.Date, request.PeriodType, Guid.Empty, cancellationToken);
                if (hasActive)
                    throw new ConflictException("Period is occupied by an active booking and cannot be released manually.");

                await _bookingRepository.ReleasePeriodAsync(hallId, request.Date, request.PeriodType, cancellationToken);
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);

        // Return authoritative persisted state
        var availability = await _hallRepository.GetAvailabilityAsync([hallId], request.Date, request.Date, cancellationToken);
        var status = availability.FirstOrDefault(a => a.PeriodType == request.PeriodType)?.Status ?? AvailabilityStatus.Available;

        return new OwnerAvailabilityPeriodDto
        {
            PeriodType = template.Type,
            StartTime = template.StartTime,
            EndTime = template.EndTime,
            Status = status
        };
    }

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
