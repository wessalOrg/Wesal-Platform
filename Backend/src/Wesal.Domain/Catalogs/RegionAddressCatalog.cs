namespace Wesal.Domain.Catalogs;

/// <summary>
/// The dependent Region → detailed-address list used by the hall creation/update flow
/// (US-HALL). The owner first selects one of <see cref="Wesal.Domain.Enums.HallRegion"/>
/// and then picks a detailed address-area from that region's list; the detailed address
/// is never free-text typed by the owner. The lists below are the initial data set
/// provided by the product team (duplicate entries normalized).
///
/// <see cref="NorthGazaAreas"/> is a small standard list added so North Gaza owners are
/// not blocked; it can be extended through the same catalog when more data is provided.
/// </summary>
public static class RegionAddressCatalog
{
    public const int AddressMaxLength = 100;

    public const int DetailedAddressMaxLength = 150;

    private static readonly string[] NorthGazaArray =
    [
        "جباليا",
        "بيت حانون",
        "بيت لاهيا",
        "النزلة",
        "عزبة بيت حانون"
    ];

    private static readonly string[] GazaArray =
    [
        "الصبرة",
        "النصر",
        "الشجاعية",
        "المغراقة",
        "الرمال",
        "حي تل الهوا",
        "حي الرمال",
        "حي الزيتون",
        "حي التفاح",
        "حي الشيخ رضوان",
        "حي الشاطئ",
        "حي النصر",
        "حي صبرة",
        "حي الصبرة",
        "حي الشيخ عجلين"
    ];

    private static readonly string[] MiddleArray =
    [
        "المصدر",
        "النصيرات",
        "دير البلح",
        "المغازي"
    ];

    private static readonly string[] SouthGazaArray =
    [
        "خان يونس",
        "رفح",
        "بني سهيلا",
        "عبسان",
        "القرارة",
        "خزاعة",
        "عبسان الكبيرة",
        "عبسان الصغيرة",
        "كربات المنشار",
        "النزهة",
        "الشوكة"
    ];

    private static readonly Dictionary<Enums.HallRegion, string[]> Map = new()
    {
        [Enums.HallRegion.NorthGaza] = NorthGazaArray,
        [Enums.HallRegion.Gaza] = GazaArray,
        [Enums.HallRegion.MiddleArea] = MiddleArray,
        [Enums.HallRegion.SouthGaza] = SouthGazaArray
    };

    /// <summary>
    /// Returns the detailed-address list for a region. Empty when the region has no
    /// predefined list yet (callers treat an empty list as "details must stay empty").
    /// </summary>
    public static IReadOnlyList<string> GetAddresses(Enums.HallRegion region)
    {
        return Map.TryGetValue(region, out var list) ? list : [];
    }

    /// <summary>True when the given name belongs to the region's predefined list.</summary>
    public static bool Contains(Enums.HallRegion region, string? value)
    {
        return !string.IsNullOrWhiteSpace(value)
            && Map.TryGetValue(region, out var list)
            && list.Contains(value.Trim(), StringComparer.Ordinal);
    }
}