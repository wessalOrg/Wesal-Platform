using System.Globalization;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.OwnerDashboard;

/// <summary>
/// Aggregates hall page visits, favorites, and booking requests for the authenticated
/// Hall Owner across all non-deleted owned halls, comparing the current calendar month
/// with the previous calendar month.
/// </summary>
public sealed class OwnerVisitorStatsService : IOwnerVisitorStatsService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUser;
    private readonly IOwnerDashboardRepository _ownerDashboardRepository;
    private readonly IHallRepository _hallRepository;
    private readonly IHallPageViewRepository _hallPageViewRepository;
    private readonly IHallFavoriteRepository _hallFavoriteRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly IDateTime _dateTime;
    private readonly ILogger<OwnerVisitorStatsService> _logger;

    public OwnerVisitorStatsService(
        UserManager<ApplicationUser> userManager,
        ICurrentUserService currentUser,
        IOwnerDashboardRepository ownerDashboardRepository,
        IHallRepository hallRepository,
        IHallPageViewRepository hallPageViewRepository,
        IHallFavoriteRepository hallFavoriteRepository,
        IBookingRepository bookingRepository,
        IDateTime dateTime,
        ILogger<OwnerVisitorStatsService> logger)
    {
        _userManager = userManager;
        _currentUser = currentUser;
        _ownerDashboardRepository = ownerDashboardRepository;
        _hallRepository = hallRepository;
        _hallPageViewRepository = hallPageViewRepository;
        _hallFavoriteRepository = hallFavoriteRepository;
        _bookingRepository = bookingRepository;
        _dateTime = dateTime;
        _logger = logger;
    }

    public async Task RecordHallPageViewAsync(Guid hallId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        try
        {
            var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken);
            if (!HallPublicVisibility.IsPubliclyVisible(hall))
            {
                return;
            }

            await _hallPageViewRepository.AddAsync(hallId, _dateTime.Now, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Public hall details must still succeed when view persistence fails.
            _logger.LogWarning(ex, "Failed to record hall page view for hall {HallId}.", hallId);
        }
    }

    public async Task<OwnerVisitorStatsDto> GetVisitorStatsAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var ownerId = await ResolveOwnerAsync(cancellationToken);
        var halls = await _ownerDashboardRepository.GetOwnedHallsAsync(ownerId, cancellationToken);
        var hallIds = halls.Select(hall => hall.Id).ToList();

        var (thisMonthStart, nextMonthStart, previousMonthStart) = ResolveMonthBounds(_dateTime.Now);

        var visitsThisMonth = await _hallPageViewRepository.CountForHallsInRangeAsync(
            hallIds, thisMonthStart, nextMonthStart, cancellationToken);
        var visitsPreviousMonth = await _hallPageViewRepository.CountForHallsInRangeAsync(
            hallIds, previousMonthStart, thisMonthStart, cancellationToken);

        var favoritesThisMonth = await _hallFavoriteRepository.CountForHallsInRangeAsync(
            hallIds, thisMonthStart, nextMonthStart, cancellationToken);
        var favoritesPreviousMonth = await _hallFavoriteRepository.CountForHallsInRangeAsync(
            hallIds, previousMonthStart, thisMonthStart, cancellationToken);

        var bookingRequestsThisMonth = await _bookingRepository.CountCreatedForHallsInRangeAsync(
            hallIds, thisMonthStart, nextMonthStart, cancellationToken);
        var bookingRequestsPreviousMonth = await _bookingRepository.CountCreatedForHallsInRangeAsync(
            hallIds, previousMonthStart, thisMonthStart, cancellationToken);

        return new OwnerVisitorStatsDto
        {
            VisitsThisMonth = visitsThisMonth,
            VisitsPreviousMonth = visitsPreviousMonth,
            FavoritesThisMonth = favoritesThisMonth,
            FavoritesPreviousMonth = favoritesPreviousMonth,
            BookingRequestsThisMonth = bookingRequestsThisMonth,
            BookingRequestsPreviousMonth = bookingRequestsPreviousMonth,
            ConversionRateThisMonth = ComputeConversionRate(bookingRequestsThisMonth, visitsThisMonth),
            ConversionRatePreviousMonth = ComputeConversionRate(bookingRequestsPreviousMonth, visitsPreviousMonth),
            ThisMonthPeriodLabel = FormatPeriodLabel(thisMonthStart),
            PreviousMonthPeriodLabel = FormatPeriodLabel(previousMonthStart)
        };
    }

    private static double ComputeConversionRate(int bookingRequests, int visits)
        => visits == 0 ? 0d : bookingRequests / (double)visits * 100d;

    private static (DateTimeOffset ThisMonthStart, DateTimeOffset NextMonthStart, DateTimeOffset PreviousMonthStart)
        ResolveMonthBounds(DateTimeOffset now)
    {
        var utc = now.UtcDateTime;
        var thisMonthStart = new DateTimeOffset(utc.Year, utc.Month, 1, 0, 0, 0, TimeSpan.Zero);
        return (thisMonthStart, thisMonthStart.AddMonths(1), thisMonthStart.AddMonths(-1));
    }

    private static string FormatPeriodLabel(DateTimeOffset monthStart)
        => monthStart.ToString("MMMM yyyy", CultureInfo.InvariantCulture);

    private async Task<string> ResolveOwnerAsync(CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to view visitor statistics.");
        }

        var user = await _userManager.FindByIdAsync(_currentUser.UserId);
        if (user is null)
        {
            throw new NotFoundException("User", _currentUser.UserId);
        }

        return _currentUser.UserId;
    }
}
