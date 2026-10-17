using System.Text;
using System.Text.RegularExpressions;

namespace Wesal.Application.Ai;

/// <summary>
/// Shared text normalization for the deterministic assistant rules. Folds the
/// Arabic orthographic variants users actually type (hamza/alef forms, ta marbuta,
/// alef maqsura, diacritics, tatweel), lower-cases Latin text and replaces
/// punctuation with spaces, so keyword matching does not depend on spelling
/// accidents such as "الصالة" vs "الصاله" or "أحجز" vs "احجز".
/// </summary>
public static partial class AiText
{
    public static string Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return string.Empty;
        }

        var builder = new StringBuilder(input.Length);
        foreach (var raw in input.Trim().ToLowerInvariant())
        {
            var c = raw;
            if (IsArabicDiacritic(c) || c == 'ـ')
            {
                continue;
            }

            c = c switch
            {
                'أ' or 'إ' or 'آ' or 'ٱ' => 'ا', // أ إ آ ٱ -> ا
                'ى' => 'ي',                                      // ى -> ي
                'ة' => 'ه',                                      // ة -> ه
                'ؤ' => 'و',                                      // ؤ -> و
                'ئ' => 'ي',                                      // ئ -> ي
                _ => c
            };

            builder.Append(char.IsLetterOrDigit(c) || c is '-' or '/' ? c : ' ');
        }

        return WhitespaceRegex().Replace(builder.ToString(), " ").Trim();
    }

    /// <summary>
    /// Builds a pattern that matches <paramref name="word"/> as a whole word while
    /// tolerating the common Arabic clitic prefixes (ال, عال, بال, وال, لل, ل, ب, و, ف).
    /// The word must already be normalized.
    /// </summary>
    public static string WordWithArabicPrefixes(string normalizedWord)
        => $@"(?<![\p{{L}}\p{{N}}])(?:وال|بال|عال|فال|كال|لل|ال|ع|ب|ل|و|ف)?{Regex.Escape(normalizedWord)}(?![\p{{L}}\p{{N}}])";

    /// <summary>
    /// Wraps an alternation so it only matches whole words: without the guards
    /// a short word matches inside a longer one ("وين" inside "وينتا",
    /// "صور" inside "مصور"), producing wrong intents for Gazan phrasings.
    /// The inner pattern must already be normalized.
    /// </summary>
    public static string Bounded(string inner)
        => $@"(?<![\p{{L}}\p{{N}}])(?:{inner})(?![\p{{L}}\p{{N}}])";

    public static Regex AnyWord(IEnumerable<string> normalizedWords)
    {
        var alternatives = string.Join("|", normalizedWords
            .Select(Normalize)
            .Where(w => w.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .OrderByDescending(w => w.Length)
            .Select(WordWithArabicPrefixes));
        return new Regex(alternatives, RegexOptions.Compiled | RegexOptions.CultureInvariant);
    }

    public static IReadOnlyList<string> Tokens(string normalized)
        => normalized.Length == 0
            ? []
            : normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries);

    private static bool IsArabicDiacritic(char c)
        => c is >= 'ً' and <= 'ٟ' or 'ٰ';

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}
