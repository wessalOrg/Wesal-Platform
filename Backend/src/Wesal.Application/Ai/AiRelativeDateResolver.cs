using System.Text.RegularExpressions;

namespace Wesal.Application.Ai;

/// <summary>
/// Deterministic resolution of the relative dates people actually type
/// ("اليوم", "بكرة", "بعد بكرة", "الجمعة", "next Friday", "tomorrow") into an explicit
/// <see cref="DateOnly"/> relative to a trusted "today". The model may interpret the
/// language, but the date used for an availability check always comes from here (or
/// from an explicit ISO date), never from a model guess.
///
/// Week semantics (documented and tested): a bare weekday ("الجمعة", "Friday") is the
/// next occurrence counting today, so asking on a Friday means today. A weekday marked
/// as upcoming ("الجمعة القادمة", "next Friday", "الجمعة الجاي") is always strictly after
/// today (+7 when today is that weekday).
/// </summary>
public static class AiRelativeDateResolver
{
    private static readonly Regex DayAfterTomorrow = new(
        @"بعد\s+(?:بكره|بكرا|غد|غدا)|day\s+after\s+tomorrow",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex Tomorrow = AiText.AnyWord(["بكره", "بكرا", "غد", "غدا", "tomorrow"]);

    private static readonly Regex Today = AiText.AnyWord(["اليوم", "النهارده", "النهاردة", "today", "tonight", "الليله", "الليلة"]);

    private static readonly Regex Upcoming = AiText.AnyWord([
        "القادم", "القادمه", "الجاي", "الجايه", "الجاى", "الجايي", "القادمة", "next", "upcoming", "coming"
    ]);

    private static readonly (DayOfWeek Day, Regex Pattern)[] Weekdays =
    [
        (DayOfWeek.Sunday, AiText.AnyWord(["الاحد", "احد", "sunday", "sun"])),
        (DayOfWeek.Monday, AiText.AnyWord(["الاثنين", "اثنين", "الاتنين", "monday", "mon"])),
        (DayOfWeek.Tuesday, AiText.AnyWord(["الثلاثاء", "ثلاثاء", "التلات", "الثلاثا", "tuesday", "tue"])),
        (DayOfWeek.Wednesday, AiText.AnyWord(["الاربعاء", "اربعاء", "الاربعا", "wednesday", "wed"])),
        (DayOfWeek.Thursday, AiText.AnyWord(["الخميس", "خميس", "thursday", "thu"])),
        (DayOfWeek.Friday, AiText.AnyWord(["الجمعه", "جمعه", "الجمعة", "friday", "fri"])),
        (DayOfWeek.Saturday, AiText.AnyWord(["السبت", "سبت", "saturday", "sat"]))
    ];

    public static DateOnly? Resolve(string? message, DateOnly today)
    {
        var text = AiText.Normalize(message);
        if (text.Length == 0)
        {
            return null;
        }

        if (DayAfterTomorrow.IsMatch(text))
        {
            return today.AddDays(2);
        }

        if (Tomorrow.IsMatch(text))
        {
            return today.AddDays(1);
        }

        if (Today.IsMatch(text))
        {
            return today;
        }

        foreach (var (day, pattern) in Weekdays)
        {
            if (!pattern.IsMatch(text))
            {
                continue;
            }

            var delta = ((int)day - (int)today.DayOfWeek + 7) % 7;
            if (delta == 0 && Upcoming.IsMatch(text))
            {
                delta = 7;
            }

            return today.AddDays(delta);
        }

        return null;
    }
}
