using System.Globalization;
using System.Text.RegularExpressions;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Ai;

public sealed record AiResolvedDateIntent(DateOnly? Date, AiDateRange? Range, AiMonth? Month);

/// <summary>Resolves relative dates and bounded calendar ranges from a trusted local date.</summary>
public static partial class AiDateRangeResolver
{
    public static AiResolvedDateIntent? Resolve(string? message, DateOnly today)
    {
        var text = message?.Trim() ?? string.Empty;
        if (text.Length == 0)
            return null;

        var normalized = AiText.Normalize(text);
        if (DateTokenRegex().Matches(text).Count >= 2)
        {
            return TryExplicitRange(text, out var explicitRange)
                ? new AiResolvedDateIntent(null, explicitRange, MonthOf(explicitRange.Start))
                : null;
        }

        var criteriaDate = new NaturalLanguageCriteriaExtractor().Extract(text, today, allowBareCapacity: false).Date;
        var relativeDate = AiRelativeDateResolver.Resolve(text, today);
        var exactDate = relativeDate ?? criteriaDate ?? TryArabicMonthDay(text, today);
        if (exactDate is { } date)
            return new AiResolvedDateIntent(date, null, new AiMonth(date.Year, date.Month));

        if (ContainsAny(normalized, "الشهر الجاي", "الشهر القادم", "الشهر المقبل", "next month"))
        {
            var nextMonth = new DateOnly(today.Year, today.Month, 1).AddMonths(1);
            return MonthRange(nextMonth.Year, nextMonth.Month);
        }

        if (ContainsAny(normalized, "هذا الشهر", "الشهر الحالي", "this month"))
            return MonthRange(today.Year, today.Month);

        if (ContainsAny(normalized, "نهاية الاسبوع", "اخر الاسبوع", "الويكند", "weekend", "end of week"))
        {
            var friday = NextWeekday(today, DayOfWeek.Friday, includeToday: true);
            var range = new AiDateRange(friday, friday.AddDays(1));
            return new AiResolvedDateIntent(null, range, null);
        }

        if (ContainsAny(normalized, "الاسبوع الجاي", "الاسبوع القادم", "الاسبوع المقبل", "next week"))
        {
            // Gaza's calendar week starts Sunday; the following week is bounded Sunday through Saturday.
            var daysUntilSunday = ((int)DayOfWeek.Sunday - (int)today.DayOfWeek + 7) % 7;
            var start = today.AddDays(daysUntilSunday == 0 ? 7 : daysUntilSunday);
            return new AiResolvedDateIntent(null, new AiDateRange(start, start.AddDays(6)), null);
        }

        if (ContainsAny(normalized, "اول الشهر", "بداية الشهر", "first of the month", "early this month"))
            return SegmentOfMonth(today, 1, 10);

        if (ContainsAny(normalized, "نص الشهر", "منتصف الشهر", "middle of the month", "mid-month"))
            return SegmentOfMonth(today, 11, 20);

        if (ContainsAny(normalized, "اخر الشهر", "نهاية الشهر", "last part of the month", "end of the month"))
            return SegmentOfMonth(today, 21, DateTime.DaysInMonth(today.Year, today.Month));

        if (TryMonth(text, today, out var month))
            return MonthRange(month.Year, month.Month);

        return null;
    }

    private static AiResolvedDateIntent MonthRange(int year, int month)
    {
        var start = new DateOnly(year, month, 1);
        var end = new DateOnly(year, month, DateTime.DaysInMonth(year, month));
        return new AiResolvedDateIntent(null, new AiDateRange(start, end), new AiMonth(year, month));
    }

    private static AiResolvedDateIntent SegmentOfMonth(DateOnly today, int firstDay, int lastDay)
    {
        var last = Math.Min(lastDay, DateTime.DaysInMonth(today.Year, today.Month));
        var start = new DateOnly(today.Year, today.Month, firstDay);
        return new AiResolvedDateIntent(null, new AiDateRange(start, new DateOnly(today.Year, today.Month, last)), MonthOf(start));
    }

    private static AiMonth MonthOf(DateOnly date) => new(date.Year, date.Month);

    private static DateOnly NextWeekday(DateOnly today, DayOfWeek target, bool includeToday)
    {
        var delta = ((int)target - (int)today.DayOfWeek + 7) % 7;
        if (delta == 0 && !includeToday)
            delta = 7;
        return today.AddDays(delta);
    }

    private static bool TryExplicitRange(string text, out AiDateRange range)
    {
        range = default!;
        var matches = DateTokenRegex().Matches(text);
        if (matches.Count < 2 || !TryDate(matches[0].Value, out var first) || !TryDate(matches[1].Value, out var second))
            return false;

        if (second < first)
            (first, second) = (second, first);
        if (second.DayNumber - first.DayNumber > 30)
            return false;

        range = new AiDateRange(first, second);
        return true;
    }

    private static bool TryDate(string value, out DateOnly date)
        => DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date)
            || DateOnly.TryParseExact(value, ["dd/MM/yyyy", "dd-MM-yyyy"], CultureInfo.InvariantCulture, DateTimeStyles.None, out date);

    private static DateOnly? TryArabicMonthDay(string text, DateOnly today)
    {
        var match = ArabicMonthDayRegex().Match(text);
        if (!match.Success || !int.TryParse(match.Groups["day"].Value, out var day)
            || !TryParseMonth(match.Groups["month"].Value, out var month))
            return null;

        var year = int.TryParse(match.Groups["year"].Value, out var explicitYear)
            ? explicitYear
            : month < today.Month ? today.Year + 1 : today.Year;
        try { return new DateOnly(year, month, day); }
        catch (ArgumentOutOfRangeException) { return null; }
    }

    private static bool TryMonth(string text, DateOnly today, out AiMonth month)
    {
        month = default!;
        var match = MonthOnlyRegex().Match(text);
        if (!match.Success || !TryParseMonth(match.Groups["month"].Value, out var number))
            return false;

        var year = int.TryParse(match.Groups["year"].Value, out var explicitYear)
            ? explicitYear
            : number < today.Month ? today.Year + 1 : today.Year;
        month = new AiMonth(year, number);
        return true;
    }

    private static bool TryParseMonth(string value, out int month)
    {
        var name = AiText.Normalize(value).ToLowerInvariant();
        month = name switch
        {
            "يناير" or "january" or "jan" => 1,
            "فبراير" or "february" or "feb" => 2,
            "مارس" or "march" or "mar" => 3,
            "ابريل" or "april" or "apr" => 4,
            "مايو" or "may" => 5,
            "يونيو" or "june" or "jun" => 6,
            "يوليو" or "july" or "jul" => 7,
            "اغسطس" or "august" or "aug" => 8,
            "سبتمبر" or "september" or "sep" or "sept" => 9,
            "اكتوبر" or "october" or "oct" => 10,
            "نوفمبر" or "november" or "nov" => 11,
            "ديسمبر" or "december" or "dec" => 12,
            _ => 0
        };
        return month != 0;
    }

    private static bool ContainsAny(string text, params string[] phrases)
        => phrases.Any(phrase => text.Contains(AiText.Normalize(phrase), StringComparison.OrdinalIgnoreCase));

    [GeneratedRegex(@"\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4}", RegexOptions.CultureInvariant)]
    private static partial Regex DateTokenRegex();

    [GeneratedRegex(@"(?<day>\d{1,2})\s+(?<month>يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)(?:\s+(?<year>\d{4}))?", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex ArabicMonthDayRegex();

    [GeneratedRegex(@"(?<!\p{L})(?<month>january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)(?:\s+(?<year>\d{4}))?(?!\p{L})", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex MonthOnlyRegex();
}
