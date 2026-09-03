using System.Text.RegularExpressions;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;

namespace Wesal.Application.Ai;

public sealed partial class NaturalLanguageCriteriaExtractor : IRecommendationCriteriaExtractor
{
    public ExtractedCriteriaDto Extract(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
            return new ExtractedCriteriaDto(null, null, null, null, null);

        var normalized = message.Trim();

        var region = ExtractRegion(normalized);
        var area = ExtractArea(normalized, region);
        var date = ExtractDate(normalized);
        var period = ExtractBookingPeriod(normalized);
        var capacity = ExtractCapacity(normalized);

        return new ExtractedCriteriaDto(region, area, date, period, capacity);
    }

    private static string? ExtractRegion(string message)
    {
        var lower = message.ToLowerInvariant();
        // English regions
        if (lower.Contains("north gaza") || lower.Contains("north")) return HallRegion.NorthGaza.ToString();
        if (lower.Contains("south gaza") || lower.Contains("south")) return HallRegion.SouthGaza.ToString();
        if (lower.Contains("middle area") || lower.Contains("middle")) return HallRegion.MiddleArea.ToString();
        if (lower.Contains("gaza")) return HallRegion.Gaza.ToString();

        // Arabic regions + Gazan governorate/city colloquial references
        if (message.Contains("شمال غزة") || message.Contains("بيت حانون") || message.Contains("بيت لاهيا") || message.Contains("بيت لاهيه") || message.Contains("جباليا") || message.Contains("جبلية")) return HallRegion.NorthGaza.ToString();
        if (message.Contains("جنوب غزة") || message.Contains("جنوب") || message.Contains("رفح") || message.Contains("خان يونس") || message.Contains("خانيونس") || message.Contains("عبسان") || message.Contains("القرارة") || message.Contains("بني سهيلا")) return HallRegion.SouthGaza.ToString();
        if (message.Contains("الوسطى") || message.Contains("الوسطي") || message.Contains("وسط غزة") || message.Contains("دير البلح") || message.Contains("ديرالبلح") || message.Contains("النصيرات") || message.Contains("الزوايدة") || message.Contains("المغازي") || message.Contains("البريج") || message.Contains("وادي غزة")) return HallRegion.MiddleArea.ToString();
        if (message.Contains("غزة") || message.Contains("الرمال") || message.Contains("التفاح") || message.Contains("الشجاعية") || message.Contains("النصر") || message.Contains("الزيتون") || message.Contains("الصبرة")) return HallRegion.Gaza.ToString();

        return null;
    }

    private static string? ExtractArea(string message, string? region)
    {
        var match = AreaRegex().Match(message);
        if (match.Success)
        {
            var area = match.Groups[1].Value.Trim();
            if (string.IsNullOrWhiteSpace(area))
                return null;

            // Exact match (case-insensitive)
            if (string.Equals(area, region, StringComparison.OrdinalIgnoreCase))
                return null;

            // Cross-language match: "غزة" == "Gaza", "شمال غزة" == "NorthGaza", etc.
            if (IsSameRegion(area, region))
                return null;

            return area;
        }
        return null;
    }

    private static bool IsSameRegion(string area, string? region)
    {
        if (string.IsNullOrWhiteSpace(region))
            return false;

        return region.ToLowerInvariant() switch
        {
            "gaza" => area is "غزة" or "مدينة غزة",
            "northgaza" => area.Contains("شمال غزة") || area.Contains("شمال"),
            "southgaza" => area.Contains("جنوب غزة") || area.Contains("جنوب"),
            "middlearea" => area.Contains("الوسطى") || area.Contains("الوسطي") || area.Contains("وسط غزة"),
            _ => false
        };
    }

    private static DateOnly? ExtractDate(string message)
    {
        // Try ISO date yyyy-MM-dd
        var isoMatch = IsoDateRegex().Match(message);
        if (isoMatch.Success && DateOnly.TryParse(isoMatch.Value, out var isoDate))
            return isoDate;

        // Try dd/MM/yyyy or dd-MM-yyyy
        var dmyMatch = DmyDateRegex().Match(message);
        if (dmyMatch.Success)
        {
            var raw = dmyMatch.Value;
            if (DateOnly.TryParse(raw.Replace('-', '/'), out var dmyDate))
                return dmyDate;
            // Try parse with different separators
            if (DateOnly.TryParseExact(raw, "dd/MM/yyyy", out var exact1)) return exact1;
            if (DateOnly.TryParseExact(raw, "dd-MM-yyyy", out var exact2)) return exact2;
        }

        // Try Month name + day (e.g., August 30, 30 August)
        var monthDayMatch = MonthDayRegex().Match(message);
        if (monthDayMatch.Success)
        {
            var monthName = monthDayMatch.Groups["month"].Value;
            var dayStr = monthDayMatch.Groups["day"].Value;
            if (int.TryParse(dayStr, out var day) && day >= 1 && day <= 31)
            {
                if (TryParseMonth(monthName, out var month))
                {
                    var year = DateTime.UtcNow.Year;
                    // If date already passed this year, assume next year
                    try
                    {
                        var candidate = new DateOnly(year, month, day);
                        if (candidate < DateOnly.FromDateTime(DateTime.UtcNow))
                            candidate = candidate.AddYears(1);
                        return candidate;
                    }
                    catch { /* invalid date like Feb 30 */ }
                }
            }
        }

        // Try day + month (30 August)
        var dayMonthMatch = DayMonthRegex().Match(message);
        if (dayMonthMatch.Success)
        {
            var dayStr = dayMonthMatch.Groups["day"].Value;
            var monthName = dayMonthMatch.Groups["month"].Value;
            if (int.TryParse(dayStr, out var day) && day >= 1 && day <= 31)
            {
                if (TryParseMonth(monthName, out var month))
                {
                    var year = DateTime.UtcNow.Year;
                    try
                    {
                        var candidate = new DateOnly(year, month, day);
                        if (candidate < DateOnly.FromDateTime(DateTime.UtcNow))
                            candidate = candidate.AddYears(1);
                        return candidate;
                    }
                    catch { }
                }
            }
        }

        return null;
    }

    private static string? ExtractBookingPeriod(string message)
    {
        var lower = message.ToLowerInvariant();
        // English first period
        if (lower.Contains("first period") || lower.Contains("first") && lower.Contains("period") || lower.Contains("morning period") || lower.Contains("morning"))
            return BookingPeriodType.FirstPeriod.ToString();
        // English second period
        if (lower.Contains("second period") || lower.Contains("second") && lower.Contains("period") || lower.Contains("evening period") || lower.Contains("evening") || lower.Contains("afternoon"))
            return BookingPeriodType.SecondPeriod.ToString();

        // Arabic
        if (message.Contains("الفترة الأولى") || message.Contains("الفترة الاولى") || message.Contains("صباح") || message.Contains("الفترة الصباحية") || message.Contains("فترة أولى"))
            return BookingPeriodType.FirstPeriod.ToString();
        if (message.Contains("الفترة الثانية") || message.Contains("الفترة الثانيه") || message.Contains("مساء") || message.Contains("الفترة المسائية") || message.Contains("فترة ثانية"))
            return BookingPeriodType.SecondPeriod.ToString();

        return null;
    }

    private static int? ExtractCapacity(string message)
    {
        var match = CapacityRegex().Match(message);
        if (match.Success)
        {
            var val = !string.IsNullOrEmpty(match.Groups[1].Value) ? match.Groups[1].Value : match.Groups[2].Value;
            if (int.TryParse(val, out var cap) && cap > 0 && cap < 10000)
                return cap;
        }
        return null;
    }

    private static bool TryParseMonth(string name, out int month)
    {
        month = 0;
        var lower = name.ToLowerInvariant();
        return lower switch
        {
            "january" or "jan" or "يناير" => (month = 1) == 1,
            "february" or "feb" or "فبراير" => (month = 2) == 2,
            "march" or "mar" or "مارس" => (month = 3) == 3,
            "april" or "apr" or "أبريل" or "ابريل" => (month = 4) == 4,
            "may" or "مايو" => (month = 5) == 5,
            "june" or "jun" or "يونيو" => (month = 6) == 6,
            "july" or "jul" or "يوليو" => (month = 7) == 7,
            "august" or "aug" or "أغسطس" or "اغسطس" => (month = 8) == 8,
            "september" or "sep" or "sept" or "سبتمبر" => (month = 9) == 9,
            "october" or "oct" or "أكتوبر" or "اكتوبر" => (month = 10) == 10,
            "november" or "nov" or "نوفمبر" => (month = 11) == 11,
            "december" or "dec" or "ديسمبر" => (month = 12) == 12,
            _ => false
        };
    }

    [GeneratedRegex(@"(?:in|at|في)\s+([A-Za-z\u0600-\u06FF]+)", RegexOptions.IgnoreCase)]
    private static partial Regex AreaRegex();

    [GeneratedRegex(@"\d{4}-\d{2}-\d{2}")]
    private static partial Regex IsoDateRegex();

    [GeneratedRegex(@"\d{2}[\/\-]\d{2}[\/\-]\d{4}")]
    private static partial Regex DmyDateRegex();

    [GeneratedRegex(@"(?<month>january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(?<day>\d{1,2})\b", RegexOptions.IgnoreCase)]
    private static partial Regex MonthDayRegex();

    [GeneratedRegex(@"\b(?<day>\d{1,2})\s+(?<month>january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b", RegexOptions.IgnoreCase)]
    private static partial Regex DayMonthRegex();

    [GeneratedRegex(@"(?:capacity\s*[:\-]?\s*|سعة\s*[:\-]?\s*|لكذا|بـ?سعة\s*|for\s+)(\d{2,4})\b|(\d{2,4})\s*(?:people|persons|person|guest|شخص|أشخاص|ناس|فرد|نفر|ضيف)", RegexOptions.IgnoreCase)]
    private static partial Regex CapacityRegex();
}
