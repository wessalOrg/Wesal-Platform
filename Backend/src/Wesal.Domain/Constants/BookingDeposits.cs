namespace Wesal.Domain.Constants;

/// <summary>
/// WESAL-TASK-8 (Edit 8): the money rules for a booking deposit (عربون). Shared by the
/// request validator and the acceptance service so the API and the domain can never
/// disagree about what a valid deposit is.
/// </summary>
public static class BookingDeposits
{
    /// <summary>A deposit must be at least this much, in ILS.</summary>
    public const decimal MinimumAmount = 0.01m;

    /// <summary>
    /// The largest deposit an owner may require, in ILS. A ceiling rather than an open
    /// range, so a mistyped amount cannot demand an unreasonable sum from a requester.
    /// </summary>
    public const decimal MaximumAmount = 1_000_000m;
}
