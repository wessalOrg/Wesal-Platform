using Wesal.Domain.Entities;

namespace Wesal.Domain.Notifications;

/// <summary>
/// Builds the placeholder values shared by every booking-related notification
/// (WESAL-TASK-13, Edit 13).
/// </summary>
/// <remarks>
/// Centralised so the acceptance, rejection, cancellation and new-request notices cannot
/// drift apart in how they render a date, a time range or an amount — the exact class of
/// silent divergence this project has been bitten by before.
/// <para>
/// Formatting is deliberately culture-invariant (<c>yyyy-MM-dd</c>, <c>HH:mm</c>,
/// <c>0.##</c>). The number a user reads must not change shape with the server's locale,
/// and the currency word is carried by the template's own wording ("شيكل" / "ILS") rather
/// than by a culture-specific currency symbol.
/// </para>
/// </remarks>
public static class BookingNotificationValues
{
    public const string DateFormat = "yyyy-MM-dd";
    public const string TimeFormat = "HH:mm";

    /// <summary>
    /// The booking's occupied range: the earliest slot's start to the latest slot's end.
    /// Falls back to the booking's own range string when no slots are loaded, so a
    /// notification never renders an empty time range.
    /// </summary>
    public static (string StartTime, string EndTime) ResolveTimeRange(Booking booking)
    {
        if (booking.Slots is { Count: > 0 })
        {
            var starts = booking.Slots.Select(slot => slot.StartTime).OrderBy(time => time).ToList();
            var ends = booking.Slots.Select(slot => slot.EndTime).OrderBy(time => time).ToList();

            return (
                starts[0].ToString(TimeFormat, System.Globalization.CultureInfo.InvariantCulture),
                ends[^1].ToString(TimeFormat, System.Globalization.CultureInfo.InvariantCulture));
        }

        return (booking.HourlyTimeRange ?? string.Empty, string.Empty);
    }

    public static Dictionary<string, string?> ForBooking(
        Booking booking,
        string? requesterName = null,
        string? reason = null)
    {
        var (startTime, endTime) = ResolveTimeRange(booking);

        var values = new Dictionary<string, string?>
        {
            [NotificationTokens.HallName] = booking.Hall?.Name,
            [NotificationTokens.Date] = booking.Date.ToString(DateFormat, System.Globalization.CultureInfo.InvariantCulture),
            [NotificationTokens.StartTime] = startTime,
            [NotificationTokens.EndTime] = endTime
        };

        if (requesterName is not null)
        {
            values[NotificationTokens.RequesterName] = requesterName;
            values[NotificationTokens.CancellerName] = requesterName;
        }

        if (reason is not null)
        {
            values[NotificationTokens.Reason] = reason;
        }

        if (booking.DepositAmount is { } amount)
        {
            values[NotificationTokens.Amount] = amount.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);
        }

        return values;
    }
}
