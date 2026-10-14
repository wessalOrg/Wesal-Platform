using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Wesal.Domain.Catalogs;
using Wesal.Domain.Enums;

namespace Wesal.Application.Ai;

/// <summary>
/// Resolves a neighborhood the user typed to a canonical
/// <see cref="Wesal.Domain.Catalogs.RegionAddressCatalog"/> address, tolerating the
/// spelling accidents people actually type:
/// <list type="bullet">
/// <item>attached or separate Arabic prepositions ("بالرمال", "في الرمال", "من الرمال");</item>
/// <item>an omitted descriptive prefix ("الرمال" for the catalog entry "حي الرمال").</item>
/// </list>
/// The catalog is the only source of truth: user text is never persisted as a new
/// neighborhood. Matching prefers the full canonical label, then the label with its
/// descriptive prefix removed. When several catalog entries would be equivalent the
/// result is reported as ambiguous rather than resolved arbitrarily, so the caller can
/// keep the requested region constraint or ask the user to clarify.
/// </summary>
public static class AiLocationResolver
{
    /// <summary>A resolved catalog address and the region it belongs to.</summary>
    public sealed record AreaMatch(string CanonicalLabel, HallRegion Region);

    /// <summary>Outcome of a resolution: at most one match, plus whether the input was ambiguous.</summary>
    public sealed record LocationResolution(AreaMatch? Area, bool IsAmbiguous)
    {
        public static readonly LocationResolution None = new(null, false);
    }

    /// <summary>Descriptive prefixes a catalog label may carry and a user may omit.</summary>
    private static readonly string[] DescriptivePrefixes = ["حي", "منطقه", "مخيم", "مدينه"];

    /// <summary>
    /// Cores that are common standalone Arabic words. Matching them without the
    /// descriptive prefix would produce wrong neighborhoods ("السلام عليكم" must not
    /// resolve to the South Gaza address "حي السلام"), so they are only matched as a
    /// full canonical label.
    /// </summary>
    private static readonly HashSet<string> NonDistinctiveCores = new(StringComparer.Ordinal)
    {
        "السلام", "الامل", "البلد", "المحطه", "الساحه"
    };

    private static readonly ConcurrentDictionary<string, Regex> PatternCache = new(StringComparer.Ordinal);

    /// <summary>Resolves against the platform address catalog.</summary>
    public static LocationResolution Resolve(string? message, HallRegion? regionContext = null)
        => Resolve(message, regionContext, CatalogEntries());

    /// <summary>
    /// Resolves against an explicit set of <c>(region, label)</c> entries. Exposed so the
    /// matching rules can be verified against duplicate/ambiguous labels that the shipped
    /// catalog does not currently contain.
    /// </summary>
    public static LocationResolution Resolve(
        string? message,
        HallRegion? regionContext,
        IEnumerable<(HallRegion Region, string Label)> entries)
    {
        var folded = AiText.Normalize(message);
        if (folded.Length == 0)
        {
            return LocationResolution.None;
        }

        var candidates = MatchByKey(folded, entries, fullLabel: true);
        if (candidates.Count == 0)
        {
            candidates = MatchByKey(folded, entries, fullLabel: false);
        }

        if (candidates.Count == 0)
        {
            return LocationResolution.None;
        }

        var distinct = candidates
            .DistinctBy(candidate => candidate.Label, StringComparer.Ordinal)
            .ToList();

        if (distinct.Count == 1)
        {
            return new LocationResolution(new AreaMatch(distinct[0].Label, distinct[0].Region), false);
        }

        if (regionContext is { } region)
        {
            var narrowed = distinct.Where(candidate => candidate.Region == region).ToList();
            if (narrowed.Count == 1)
            {
                return new LocationResolution(new AreaMatch(narrowed[0].Label, narrowed[0].Region), false);
            }
        }

        // Two catalog entries match equally well (or the region did not disambiguate):
        // never pick one arbitrarily.
        return new LocationResolution(null, true);
    }

    private static List<(HallRegion Region, string Label)> MatchByKey(
        string foldedMessage,
        IEnumerable<(HallRegion Region, string Label)> entries,
        bool fullLabel)
    {
        var results = new List<(HallRegion Region, string Label)>();
        foreach (var (region, label) in entries)
        {
            if (string.IsNullOrWhiteSpace(label))
            {
                continue;
            }

            var key = fullLabel ? AiText.Normalize(label) : CoreKey(label);
            if (key.Length == 0)
            {
                continue;
            }

            // A prefix-stripped core is only safe to match when it is long enough to be
            // distinctive and is not a common standalone word.
            if (!fullLabel && (key.Length < 4 || NonDistinctiveCores.Contains(key)))
            {
                continue;
            }

            if (PatternFor(key).IsMatch(foldedMessage))
            {
                results.Add((region, label));
            }
        }

        return results;
    }

    /// <summary>
    /// The label with its trailing parenthetical and leading descriptive prefix removed,
    /// normalized for comparison ("منطقة البلد (المركز)" -> "البلد", "حي الرمال" -> "الرمال").
    /// </summary>
    private static string CoreKey(string label)
    {
        var trimmed = label;
        var parenthesis = trimmed.IndexOf('(', StringComparison.Ordinal);
        if (parenthesis > 0)
        {
            trimmed = trimmed[..parenthesis];
        }

        var tokens = AiText.Tokens(AiText.Normalize(trimmed));
        if (tokens.Count > 1 && DescriptivePrefixes.Contains(tokens[0], StringComparer.Ordinal))
        {
            return string.Join(' ', tokens.Skip(1));
        }

        return string.Join(' ', tokens);
    }

    private static Regex PatternFor(string normalizedKey)
        => PatternCache.GetOrAdd(
            normalizedKey,
            static key => new Regex(
                AiText.WordWithArabicPrefixes(key),
                RegexOptions.Compiled | RegexOptions.CultureInvariant));

    private static IEnumerable<(HallRegion Region, string Label)> CatalogEntries()
        => Enum.GetValues<HallRegion>()
            .SelectMany(region => RegionAddressCatalog.GetAddresses(region)
                .Select(label => (Region: region, Label: label)));
}
