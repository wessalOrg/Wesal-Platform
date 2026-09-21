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