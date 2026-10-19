using System.Globalization;
using System.Text.RegularExpressions;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Ai;

/// <summary>Extracts explicit price constraints without treating an unqualified number as price or capacity.</summary>
public static partial class AiPriceBudgetExtractor
{
    public static AiPriceBudget ApplyConversationalAmendment(string? message, AiPriceBudget current, AiPriceBudget? prior)
    {
        if (current.IsSpecified || prior is null)
            return current;

        var text = NormalizeNumerals(message?.Trim() ?? string.Empty);
        if (!AmendmentLanguageRegex().IsMatch(AiText.Normalize(text))
            || ReplacementAmountRegex().Match(text) is not { Success: true } match
            || !TryAmount(match.Groups["amount"].Value, out var amount))
            return current;

        if (prior.AroundPrice.HasValue)
            return new AiPriceBudget(AroundPrice: amount);
        if (prior.MaximumPrice.HasValue)
            return new AiPriceBudget(MaximumPrice: amount);
        if (prior.MinimumPrice.HasValue)
            return new AiPriceBudget(MinimumPrice: amount);
        return current;
    }

    public static (AiPriceBudget Budget, AiPriceSortPreference SortPreference) Extract(string? message)
    {
        var text = NormalizeNumerals(message?.Trim() ?? string.Empty);
        if (text.Length == 0)
            return (new AiPriceBudget(), AiPriceSortPreference.Relevance);

        decimal? minimum = null;
        decimal? maximum = null;
        decimal? around = null;

        if (PriceRangeRegex().Match(text) is { Success: true } range
            && TryAmount(range.Groups["first"].Value, out var first)
            && TryAmount(range.Groups["second"].Value, out var second))
        {
            minimum = Math.Min(first, second);
            maximum = Math.Max(first, second);
        }
        else if (AroundAmountRegex().Match(text) is { Success: true } aroundMatch
            && TryAmount(aroundMatch.Groups["amount"].Value, out var target))
        {
            around = target;
        }
        else if (MaximumAmountRegex().Match(text) is { Success: true } maxMatch
            && TryAmount(maxMatch.Groups["amount"].Value, out var maxAmount))
        {
            maximum = maxAmount;
        }
        else if (MinimumAmountRegex().Match(text) is { Success: true } minMatch
            && TryAmount(minMatch.Groups["amount"].Value, out var minAmount))
        {
            minimum = minAmount;
        }
        else if (CurrencyAmountRegex().Match(text) is { Success: true } currencyMatch
            && TryAmount(currencyMatch.Groups["amount"].Value, out var currencyAmount))
        {
            maximum = currencyAmount;
        }
        else if (BoundHallPriceRegex().Match(text) is { Success: true } boundMatch
            && TryAmount(boundMatch.Groups["amount"].Value, out var boundAmount))
        {
            // "بدي صالة ب1500" is a maximum-budget request. A bare "1500" is not.
            maximum = boundAmount;
        }

        var folded = AiText.Normalize(text);
        var sort = around.HasValue
            ? AiPriceSortPreference.ClosestToTarget
            : folded.Contains("اغلي", StringComparison.Ordinal)
                || folded.Contains("اكثر سعر", StringComparison.Ordinal)
                || folded.Contains("most expensive", StringComparison.OrdinalIgnoreCase)
                || folded.Contains("highest price", StringComparison.OrdinalIgnoreCase)
                    ? AiPriceSortPreference.HighestPrice
                    : maximum.HasValue || folded.Contains("ارخص", StringComparison.Ordinal)
                            || folded.Contains("اقل سعر", StringComparison.Ordinal)
                            || folded.Contains("رخيص", StringComparison.Ordinal)
                            || folded.Contains("cheapest", StringComparison.OrdinalIgnoreCase)
                            || folded.Contains("lowest price", StringComparison.OrdinalIgnoreCase)
                            || folded.Contains("cheap", StringComparison.OrdinalIgnoreCase)
                                ? AiPriceSortPreference.LowestPrice
                                : AiPriceSortPreference.Relevance;

        return (new AiPriceBudget(minimum, maximum, around), sort);
    }

    private static bool TryAmount(string raw, out decimal amount)
    {
        var normalized = raw.Replace(",", string.Empty, StringComparison.Ordinal);
        return decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out amount)
            && amount > 0
            && amount <= 1_000_000;
    }

    private static string NormalizeNumerals(string text)
        => string.Create(text.Length, text, static (buffer, value) =>
        {
            for (var i = 0; i < value.Length; i++)
            {
                var character = value[i];
                buffer[i] = character switch
                {
                    >= '\u0660' and <= '\u0669' => (char)('0' + character - '\u0660'),
                    >= '\u06F0' and <= '\u06F9' => (char)('0' + character - '\u06F0'),
                    _ => character
                };
            }
        });

    [GeneratedRegex(@"(?:بين|من|between|from)\s*(?<first>\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:و|الى|إلى|and|to|-)\s*(?<second>\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)(?:\s*(?:₪|شيكل(?:ات)?|شواكل|شيقل(?:ات)?|ILS|NIS))?", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex PriceRangeRegex();

    [GeneratedRegex(@"(?:حوالي|حوال[ىي]|حدود|بحدود|تقريبا|تقريباً|around|about|approximately)\s*(?:₪\s*)?(?<amount>\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)(?:\s*(?:₪|شيكل(?:ات)?|شواكل|شيقل(?:ات)?|ILS|NIS))?", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex AroundAmountRegex();

    [GeneratedRegex(@"(?:₪|ILS|NIS)\s*(?<amount>\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)|(?<amount>\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:₪|شيكل(?:ات)?|شواكل|شيقل(?:ات)?|ILS|NIS)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex CurrencyAmountRegex();

    [GeneratedRegex(@"(?<![\p{L}\p{N}])(?:ميزاني(?:ة|ه|تي)|بميزاني(?:ة|ه|تي)|بسعر|سعرها|سعر|أقل\s+من|اقل\s+من|تحت|لحد|حدي|حد\s*(?:أقصى|اقصى)?|ما\s+بدي\s+(?:أتجاوز|اتجاوز)|معي|under|below|budget(?:\s+of)?|price(?:\s+of)?|not\s+over|up\s+to)\s*(?:[:=]\s*)?(?<amount>\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex MaximumAmountRegex();

    [GeneratedRegex(@"(?:أكثر\s+من|اكثر\s+من|فوق|ابتداء\s+من|على\s+الأقل|عالأقل|at\s+least|more\s+than|over|above)\s*(?<amount>\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex MinimumAmountRegex();

    [GeneratedRegex(@"(?:^|[\s،])ب(?:ـ)?(?<amount>\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)(?=$|[\s،]|شيكل|شيقل|NIS|ILS)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex BoundHallPriceRegex();

    [GeneratedRegex(@"(?<amount>\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex ReplacementAmountRegex();

    [GeneratedRegex(@"(?:لا|ممكن|بدل|غير|خلينا|actually|instead|maybe|rather)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex AmendmentLanguageRegex();
}
