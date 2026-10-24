namespace Wesal.Application.Common.Models;

/// <summary>
/// Aggregate visitor engagement for all non-deleted halls owned by the authenticated
/// Hall Owner, comparing the current calendar month with the previous calendar month.
/// </summary>
public sealed class OwnerVisitorStatsDto
{
    public int VisitsThisMonth { get; init; }

    public int VisitsPreviousMonth { get; init; }

    public int FavoritesThisMonth { get; init; }

    public int FavoritesPreviousMonth { get; init; }

    public int BookingRequestsThisMonth { get; init; }

    public int BookingRequestsPreviousMonth { get; init; }

    /// <summary>Booking requests / visits × 100 for this month; 0 when visits are 0.</summary>
    public double ConversionRateThisMonth { get; init; }

    /// <summary>Booking requests / visits × 100 for the previous month; 0 when visits are 0.</summary>
    public double ConversionRatePreviousMonth { get; init; }

    /// <summary>Human-readable label for the current calendar month (e.g. "October 2026").</summary>
    public string? ThisMonthPeriodLabel { get; init; }

    /// <summary>Human-readable label for the previous calendar month.</summary>
    public string? PreviousMonthPeriodLabel { get; init; }
}
