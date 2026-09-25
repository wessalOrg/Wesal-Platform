namespace Wesal.Domain.Catalogs;

/// <summary>
/// The dependent Region → address list used by the hall creation/update flow
/// (US-HALL). The owner first selects one of <see cref="Wesal.Domain.Enums.HallRegion"/>
/// and then picks the hall's <b>Address</b> from that region's predefined list; the
/// address is never free-text typed by the owner. The hall's
/// <b>DetailedAddress</b> is the opposite: it is free text the owner types to give
/// the extra street/landmark detail the list value cannot express. The lists below are
/// the initial data set provided by the product team (duplicate entries normalized).
///
/// <see cref="NorthGazaAreas"/> is a small standard list added so North Gaza owners are
/// not blocked; it can be extended through the same catalog when more data is provided.
/// </summary>
public static class RegionAddressCatalog
{
    /// <summary>Max length of the list-backed <c>Address</c>; list values are short.</summary>
    public const int AddressMaxLength = 100;

    /// <summary>Max length of the owner-typed free-text <c>DetailedAddress</c>.</summary>
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
        "حي الشجاعية",
        "حي الزيتون",
        "حي الدرج والتفاح",
        "حي الشيخ رضوان",
        "حي الرمال",
        "تل الهوى",
        "النصر",
        "الكرامة",
        "جحر الديك",
        "مخيم الشاطئ",
        "حي الصبرة",
        "حي الشيخ عجلين",
        "حي المقوسي",
        "منطقة اليرموك",
        "أنصار والكتيبة",
        "حي تل المنطار",
        "السدرة",
        "الساحة",
        "عسقولة",
        "الزهراء",
        "المغراقة",
        "الجلاء"
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
        "منطقة البلد (المركز)",
        "مخيم خان يونس",
        "حي الأمل",
        "حي الكتيبة",
        "حي المحطة",
        "بني سهيلا",
        "عبسان الكبيرة",
        "عبسان الجديدة (الصغيرة)",
        "خزاعة",
        "الفخاري",
        "القرارة",
        "حي السطر (السطر الشرقي)",
        "حي السطر (السطر الغربي)",
        "منطقة المواصي",
        "حي الشيخ ناصر",
        "حي جورة العقاد",
        "حي معن",
        "حي المنارة",
        "حي قيزان النجار",
        "حي قيزان أبو رشوان",
        "حي بطن السمين",
        "حي السلام",
        "مدينة حمد بن خليفة آل ثاني السكنية"
    ];

    private static readonly Dictionary<Enums.HallRegion, string[]> Map = new()
    {
        [Enums.HallRegion.NorthGaza] = NorthGazaArray,
        [Enums.HallRegion.Gaza] = GazaArray,
        [Enums.HallRegion.MiddleArea] = MiddleArray,
        [Enums.HallRegion.SouthGaza] = SouthGazaArray
    };

    /// <summary>
    /// Returns the address list for a region, used to populate the Address dropdown.
    /// Empty when the region has no predefined list yet (callers then reject any
    /// non-empty Address, because an Address can never be free text).
    /// </summary>
    public static IReadOnlyList<string> GetAddresses(Enums.HallRegion region)
    {
        return Map.TryGetValue(region, out var list) ? list : [];
    }

    /// <summary>
    /// True when the given name belongs to the region's predefined address list, i.e.
    /// it is a legal value for the list-backed <c>Address</c>. Matching is exact
    /// (<see cref="StringComparer.Ordinal"/>) after trimming, so an owner must pick a
    /// value from the list rather than retype an equivalent spelling of it.
    /// </summary>
    public static bool Contains(Enums.HallRegion region, string? value)
    {
        return !string.IsNullOrWhiteSpace(value)
            && Map.TryGetValue(region, out var list)
            && list.Contains(value.Trim(), StringComparer.Ordinal);
    }
}