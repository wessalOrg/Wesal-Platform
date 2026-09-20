namespace Wesal.Domain.Catalogs;

/// <summary>
/// Predefined feature catalog for the hall creation/update flow (US-HALL). The owner
/// picks features from this list (each stored as its canonical Arabic name) and may add
/// a strictly length-limited set of custom features via the hall's
/// <c>OtherFeatures</c> field. The same catalog drives the validation and the public
/// hall-details representation, so stored names are always canonical Arabic strings.
/// </summary>
public static class HallFeatureCatalog
{
    public const int FeatureNameMaxLength = 100;

    public const int OtherFeaturesMaxLength = 200;

    public const int MaxFeaturesPerHall = 30;

    public static readonly IReadOnlyList<string> PredefinedFeatures =
    [
        "مولد كهرباء",
        "كهرباء متواصلة",
        "تكييف",
        "مراوح",
        "جلسة للرجال",
        "جلسة للنساء",
        "إنترنت (واي فاي)",
        "ميكرفون ومكبر صوت",
        "كراسي جاهزة",
        "طاولات",
        "موقف سيارات",
        "مظلات خارجية"
    ];

    /// <summary>True when the given name is one of the predefined features.</summary>
    public static bool IsPredefined(string? value)
    {
        return !string.IsNullOrWhiteSpace(value)
            && PredefinedFeatures.Contains(value.Trim(), StringComparer.Ordinal);
    }

    /// <summary>
    /// Normalizes a candidate feature set: trims entries, de-duplicates, removes blank
    /// entries and caps cardinality to <see cref="MaxFeaturesPerHall"/>.
    /// </summary>
    public static IReadOnlyList<string> Normalize(IEnumerable<string>? values)
    {
        if (values is null)
        {
            return [];
        }

        var seen = new HashSet<string>(StringComparer.Ordinal);
        var result = new List<string>();
        foreach (var value in values)
        {
            var trimmed = value?.Trim();
            if (string.IsNullOrEmpty(trimmed) || trimmed.Length > FeatureNameMaxLength)
            {
                continue;
            }

            if (seen.Add(trimmed))
            {
                result.Add(trimmed);
            }

            if (result.Count >= MaxFeaturesPerHall)
            {
                break;
            }
        }

        return result;
    }
}