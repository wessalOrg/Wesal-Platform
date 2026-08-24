namespace Wesal.Application.Ai;

/// <summary>
/// Structured, maintainable platform knowledge based ONLY on actually implemented functionality.
/// Source of truth is repository implementation, not SRS future features.
/// </summary>
public static class WesalPlatformKnowledge
{
    public static IReadOnlyList<KnowledgeItem> GetImplementedFeatures(string language = "ar")
    {
        var isArabic = string.Equals(language, "ar", StringComparison.OrdinalIgnoreCase);
        return AllFeatures.Select(f => new KnowledgeItem(
            f.Key,
            isArabic ? f.TitleAr : f.TitleEn,
            isArabic ? f.DescriptionAr : f.DescriptionEn,
            f.HowToAr != null && f.HowToEn != null ? (isArabic ? f.HowToAr : f.HowToEn) : null,
            f.IsAvailable
        )).Where(f => f.IsAvailable).ToList();
    }

    public static string BuildContextPrompt(string language = "ar")
    {
        var features = GetImplementedFeatures(language);
        var header = language == "en"
            ? "You are Wesal AI assistant. Only guide users about these implemented features:"
            : "أنت مساعد وصال. وجه المستخدمين فقط حول هذه الميزات المنفذة فعلياً:";

        var lines = features.Select((f, i) => $"{i + 1}. {f.Title}: {f.Description}" + (f.HowTo != null ? $" - How to: {f.HowTo}" : ""));
        return header + "\n" + string.Join("\n", lines) + "\n" + (language == "en"
            ? "Do not describe unimplemented features as available. If unsure, provide fallback guidance."
            : "لا تصف ميزات غير منفذة كأنها متوفرة. إذا لم تكن متأكداً، قدم توجيهاً احتياطياً.");
    }

    private static readonly IReadOnlyList<Feature> AllFeatures = new List<Feature>
    {
        new("browse_halls", "تصفح القاعات", "Browse halls",
            "عرض قائمة القاعات المتاحة مع الصور والأسعار", "View list of available halls with images and prices",
            "اذهب إلى صفحة القاعات واستعرض البطاقات", "Go to Halls page and browse cards", true),

        new("search_halls", "البحث عن القاعات", "Search halls",
            "البحث بالاسم والمنطقة والتاريخ وفترة الحجز", "Search by name, region, date and booking period",
            "استخدم فلاتر البحث في صفحة القاعات", "Use search filters on Halls page", true),

        new("hall_details", "عرض تفاصيل القاعة", "View hall details",
            "عرض صور القاعة ووصفها وسعتها وسعرها وحالة الحجز", "View hall images, description, capacity, price and availability",
            "اضغط على أي قاعة لعرض تفاصيلها", "Click any hall to view details", true),

        new("hall_availability", "التحقق من التوفر", "Check availability",
            "معرفة توفر القاعة حسب التاريخ والفترة", "Check hall availability by date and period",
            "في صفحة التفاصيل اختر التاريخ والفترة", "On details page select date and period", true),

        new("booking_validation", "التحقق من الحجز", "Validate booking request",
            "التحقق من صحة طلب الحجز قبل التأكيد", "Validate booking request before confirmation",
            "اختر التاريخ والفترات واضغط تحقق", "Select date and periods and click validate", true),

        new("ratings", "تقييم القاعات", "Rate halls",
            "إضافة أو تحديث تقييم من 1 إلى 5", "Add or update rating from 1 to 5",
            "في صفحة القاعة استخدم قسم التقييمات", "On hall page use ratings section", true),

        new("comments", "التعليقات", "Comments",
            "إضافة تعليق وعرض تعليقات الآخرين", "Add comment and view others' comments",
            "في صفحة القاعة استخدم قسم التعليقات", "On hall page use comments section", true),

        new("conversations", "التواصل مع صاحب القاعة", "Contact hall owner",
            "بدء محادثة مع صاحب القاعة", "Start conversation with hall owner",
            "اضغط زر التواصل في صفحة القاعة", "Click contact button on hall page", true),

        new("authentication", "تسجيل الدخول والتسجيل", "Authentication",
            "إنشاء حساب وتسجيل الدخول بأدوار مختلفة", "Create account and login with different roles",
            "استخدم صفحتي التسجيل والدخول", "Use Register and Login pages", true),

        new("language", "تغيير اللغة", "Language preferences",
            "التبديل بين العربية والإنجليزية", "Switch between Arabic and English",
            "استخدم مبدل اللغة في الشريط العلوي", "Use language switcher in navbar", true),

        new("navigation", "التنقل في الموقع", "Site navigation",
            "التنقل بين الصفحات الرئيسية", "Navigate between main pages",
            "استخدم القائمة العلوية", "Use top navigation menu", true),

        new("ai_assistant", "المساعد الذكي", "AI Assistant",
            "فتح المساعد من الزر العائم في كل الصفحات", "Open assistant via floating button on every page",
            "اضغط زر المساعد العائم", "Click floating assistant button", true),
    };

    private sealed record Feature(string Key, string TitleAr, string TitleEn, string DescriptionAr, string DescriptionEn, string? HowToAr, string? HowToEn, bool IsAvailable);

    public sealed record KnowledgeItem(string Key, string Title, string Description, string? HowTo, bool IsAvailable);
}
