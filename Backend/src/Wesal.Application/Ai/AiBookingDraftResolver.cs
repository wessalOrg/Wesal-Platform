using System.Globalization;
using System.Text.RegularExpressions;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Ai;

/// <summary>Extracts only explicit booking details for a bounded, non-submitting chat draft.</summary>
public static partial class AiBookingDraftResolver
{
    public static bool IsBookingRequest(string message)
    {
        var text = AiText.Normalize(message);
        return BookingRequestRegex().IsMatch(text);
    }

    public static DateOnly? ExtractDate(string message, DateOnly today)
        => AiDateRangeResolver.Resolve(message, today)?.Date
            ?? AiRelativeDateResolver.Resolve(message, today);

    public static (TimeOnly? Start, TimeOnly? End) ExtractTimeRange(string message)
    {
        var match = TimeRangeRegex().Match(message);
        if (!match.Success
            || !TimeOnly.TryParse(match.Groups["start"].Value, CultureInfo.InvariantCulture, out var start)
            || !TimeOnly.TryParse(match.Groups["end"].Value, CultureInfo.InvariantCulture, out var end)
            || start >= end)
            return (null, null);
        return (start, end);
    }

    public static string? ExtractCustomerName(string message)
    {
        var match = CustomerNameRegex().Match(message);
        var name = match.Success ? match.Groups["name"].Value.Trim().TrimEnd('.', '،', ',') : null;
        return string.IsNullOrWhiteSpace(name) || name.Length > 120 ? null : name;
    }

    [GeneratedRegex(@"(?:^|\s)(?:بدي|اريد|حابب|حابه|نفسي)\s+(?:احجز|احجزها|احجزه|احجزها|حجز|احجزلي)|(?:^|\s)(?:احجزها|احجزه|book\s+it|reserve\s+it)(?:\s|$)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex BookingRequestRegex();

    [GeneratedRegex(@"(?<start>\d{1,2}:\d{2})\s*(?:إلى|الى|حتى|لغاية|[-–]|to)\s*(?<end>\d{1,2}:\d{2})", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex TimeRangeRegex();

    [GeneratedRegex(@"(?:باسم|اسمي|الاسم|name\s+is|under\s+the\s+name\s+of)\s*[:：]?\s*(?<name>[^\r\n]+)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex CustomerNameRegex();
}
