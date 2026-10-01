using System.Text.RegularExpressions;

namespace Wesal.Application.Ai;

/// <summary>What a payment-related question is actually about.</summary>
public enum AiPaymentIntent
{
    None,

    /// <summary>A Hall Owner paying or renewing the platform subscription for a hall.</summary>
    OwnerSubscription,

    /// <summary>A seeker paying a deposit / paying for a booking.</summary>
    BookingPayment,

    /// <summary>A payment question that does not say which payment (ask, don't guess).</summary>
    Ambiguous
}

/// <summary>
/// Disambiguates the three things the word "pay" can mean in Wesal. Subscription
/// words (اشتراك / subscription / تجديد / renew) always mean the hall-owner subscription;
/// booking words (حجز / booking / عربون / deposit) mean a booking payment; a bare
/// "كيف أدفع؟" is ambiguous. This replaces keyword matching where "كيف أدفع الحجز؟"
/// wrongly produced owner-subscription instructions.
/// </summary>
public static class AiPaymentIntentClassifier
{
    private static readonly Regex SubscriptionWords = AiText.AnyWord([
        "اشتراك", "اشتراكي", "اشتراكات", "subscription", "subscriptions", "تجديد", "جدد", "اجدد", "renew", "renewal", "رسوم الاشتراك"
    ]);

    private static readonly Regex PaymentWords = AiText.AnyWord([
        "دفع", "ادفع", "ندفع", "الدفع", "دفعه", "سداد", "اسدد", "pay", "payment", "paying", "payments"
    ]);

    private static readonly Regex BookingWords = AiText.AnyWord([
        "حجز", "الحجز", "حجزي", "احجز", "حجزت", "عربون", "العربون", "booking", "reservation", "reserve", "deposit", "book"
    ]);

    private static readonly Regex OwnerWords = AiText.AnyWord([
        "صاحب", "مالك", "قاعتي", "صالتي", "owner", "my hall", "hall owner"
    ]);

    public static AiPaymentIntent Classify(string? message)
    {
        var text = AiText.Normalize(message);
        if (text.Length == 0)
        {
            return AiPaymentIntent.None;
        }

        var subscription = SubscriptionWords.IsMatch(text);
        var payment = PaymentWords.IsMatch(text);
        var booking = BookingWords.IsMatch(text);
        var owner = OwnerWords.IsMatch(text);

        if (subscription)
        {
            return AiPaymentIntent.OwnerSubscription;
        }

        if (!payment)
        {
            return AiPaymentIntent.None;
        }

        if (booking)
        {
            return AiPaymentIntent.BookingPayment;
        }

        return owner ? AiPaymentIntent.OwnerSubscription : AiPaymentIntent.Ambiguous;
    }
}

/// <summary>
/// Recognizes requests for Wesal's own technical/customer support (official contact,
/// support hours, a problem with the website) as opposed to contacting a Hall Owner.
/// </summary>
public static class AiSupportIntentDetector
{
    private static readonly Regex OwnerContact = AiText.AnyWord(["صاحب", "مالك", "owner", "صاحبها", "صاحبه"]);

    private static readonly Regex[] Patterns =
    [
        new(@"(?:الدعم|دعم)\s*(?:ال)?(?:فني|تقني|وصال)", RegexOptions.Compiled | RegexOptions.CultureInvariant),
        new(@"(?:بدي|ابغى|اريد|ابي|احتاج|محتاج)\s+(?:ال)?(?:دعم|دعما)", RegexOptions.Compiled | RegexOptions.CultureInvariant),
        new(@"(?:رقم|واتس(?:اب)?|ايميل|بريد|هاتف|تلفون|جوال)\s+(?:ال)?(?:وصال|دعم|فريق)", RegexOptions.Compiled | RegexOptions.CultureInvariant),
        new(@"(?:تواصل|اتواصل|اكلم|احكي|اتصل)\s+(?:مع|ب|عبر)?\s*(?:ال)?(?:وصال|دعم|فريق\s+وصال|فريق\s+الدعم|الاداره)", RegexOptions.Compiled | RegexOptions.CultureInvariant),
        new(@"(?:مشكله|مشاكل|عطل|خلل|خطا)\s+(?:في|ب|عندي\s+في)?\s*(?:ال)?(?:موقع|تطبيق|منصه|وصال|حسابي)", RegexOptions.Compiled | RegexOptions.CultureInvariant),
        new(@"عندي\s+مشكله", RegexOptions.Compiled | RegexOptions.CultureInvariant),
        new(@"(?:ساعات|دوام|مواعيد)\s+(?:ال)?(?:دعم|عمل)", RegexOptions.Compiled | RegexOptions.CultureInvariant),
        new(@"(?:contact|reach|call|email|whatsapp)\s+(?:wesal|support|the\s+team|the\s+support)", RegexOptions.Compiled | RegexOptions.CultureInvariant),
        new(@"(?:technical|customer|wesal)\s+support|support\s+(?:team|number|hours|contact|email)|wesal\s+(?:number|phone|whatsapp|email|contact)", RegexOptions.Compiled | RegexOptions.CultureInvariant),
        new(@"(?:i\s+(?:have|got)\s+a\s+(?:problem|issue)|something\s+is\s+(?:wrong|broken)|website\s+(?:problem|issue|bug|not\s+working))", RegexOptions.Compiled | RegexOptions.CultureInvariant)
    ];

    private static readonly Regex HoursWords = AiText.AnyWord(["ساعات", "دوام", "مواعيد", "hours", "open", "متى"]);

    public static bool IsSupport(string? message)
    {
        var text = AiText.Normalize(message);
        if (text.Length == 0)
        {
            return false;
        }

        // "كيف أتواصل مع صاحب القاعة؟" is hall-owner messaging, not Wesal support.
        if (OwnerContact.IsMatch(text) && !text.Contains("وصال", StringComparison.Ordinal) && !text.Contains("wesal", StringComparison.Ordinal))
        {
            return false;
        }

        return Patterns.Any(pattern => pattern.IsMatch(text));
    }

    public static bool AsksForHours(string? message)
        => HoursWords.IsMatch(AiText.Normalize(message));
}

/// <summary>Which fact about a hall a (possibly pronoun-only) question asks for.</summary>
public enum AiHallQuestion
{
    None,
    Price,
    Capacity,
    Location,
    Services,
    Photos,
    Description,
    Details,
    Availability,
    BookingHowTo,
    ContactOwner
}

public static class AiHallQuestionClassifier
{
    private static readonly Regex Availability = AiText.AnyWord([
        "متاح", "متاحه", "متوفر", "متوفره", "فاضيه", "فاضي", "شاغره", "محجوزه", "محجوز", "available", "availability", "free", "booked"
    ]);

    private static readonly Regex HowToBook = new(
        @"(?:كيف|ازاي|شلون|طريقه|how\b).{0,20}(?:احجز|حجز|book|reserve)|(?:احجز|حجز).{0,3}(?:ها|ه|ني)?\s*(?:كيف|ازاي)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex Contact = new(
        @"(?:كيف|ازاي|شلون|how).{0,20}(?:اتواصل|تواصل|اكلم|احكي|contact|reach|message|call)|(?:اتواصل|اكلم|احكي)\s+(?:مع)?\s*(?:ه?م|ها|ه|صاحب)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex Price = AiText.AnyWord([
        "سعر", "سعرها", "سعره", "اسعار", "ثمن", "تكلفه", "تكلفتها", "بكم", "price", "cost", "costs", "pricing", "fee", "fees"
    ]);

    private static readonly Regex HowMuch = new(@"كم\s+(?:سعر|ثمن|تكلف|بتكلف|بدفع)|how\s+much", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex Capacity = new(
        @"(?:بتسع|بتتسع|تتسع|سعه|سعتها|سعته|كم\s+(?:شخص|نفر|فرد|ضيف|واحد)|عدد\s+(?:الاشخاص|الضيوف|المقاعد)|capacity|how\s+many\s+(?:people|guests|persons)|seat|fits?\b)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex Location = new(
        @"(?:وين|فين|مكان|موقع|عنوان|منطقه|بتقع|تقع|location|address|where|located|area)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex Services = new(
        @"(?:خدمات|خدماتها|مميزات|ميزات|مرافق|تجهيزات|امكانيات|features|amenities|services|facilities|offers?\b)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex Photos = new(
        @"(?:صور|صورها|صوره|معرض|photos?|pictures?|images?|gallery)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex Description = new(
        @"(?:وصف|وصفها|description|describe)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex Details = new(
        @"(?:تفاصيل|احكيلي|حكيلي|عرفني|اخبرني|معلومات|عنها|details|tell\s+me|about\s+(?:it|this|the)|info)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex PlatformWords = AiText.AnyWord([
        "وصال", "wesal", "المنصه", "منصه", "platform", "الموقع", "التطبيق", "الاشتراك", "اشتراك", "subscription"
    ]);

    /// <summary>True when the message is about the Wesal platform itself (not a hall).</summary>
    public static bool MentionsPlatform(string? message)
        => PlatformWords.IsMatch(AiText.Normalize(message));

    public static AiHallQuestion Classify(string? message)
    {
        var text = AiText.Normalize(message);
        if (text.Length == 0)
        {
            return AiHallQuestion.None;
        }

        if (Contact.IsMatch(text))
        {
            return AiHallQuestion.ContactOwner;
        }

        if (HowToBook.IsMatch(text))
        {
            return AiHallQuestion.BookingHowTo;
        }

        if (Availability.IsMatch(text))
        {
            return AiHallQuestion.Availability;
        }

        if (Price.IsMatch(text) || HowMuch.IsMatch(text))
        {
            return AiHallQuestion.Price;
        }

        if (Capacity.IsMatch(text))
        {
            return AiHallQuestion.Capacity;
        }

        if (Services.IsMatch(text))
        {
            return AiHallQuestion.Services;
        }

        if (Photos.IsMatch(text))
        {
            return AiHallQuestion.Photos;
        }

        if (Description.IsMatch(text))
        {
            return AiHallQuestion.Description;
        }

        if (Location.IsMatch(text))
        {
            return AiHallQuestion.Location;
        }

        return Details.IsMatch(text) ? AiHallQuestion.Details : AiHallQuestion.None;
    }
}

/// <summary>
/// Resolves "the second one" style references against the halls shown in the last
/// results, and finds an explicitly named hall inside a message so a pinned hall never
/// overrides what the user actually typed.
/// </summary>
public static class AiReferenceResolver
{
    private static readonly (int Index, Regex Pattern)[] Ordinals =
    [
        (0, AiText.AnyWord(["الاولى", "الاول", "اول", "اولى", "first", "1st", "الاولي"])),
        (1, AiText.AnyWord(["الثانيه", "الثاني", "ثاني", "ثانيه", "second", "2nd"])),
        (2, AiText.AnyWord(["الثالثه", "الثالث", "ثالث", "ثالثه", "third", "3rd"])),
        (3, AiText.AnyWord(["الرابعه", "الرابع", "رابع", "رابعه", "fourth", "4th"])),
        (4, AiText.AnyWord(["الخامسه", "الخامس", "خامس", "خامسه", "fifth", "5th"])),
        (-1, AiText.AnyWord(["الاخيره", "الاخير", "اخر", "اخيره", "last"]))
    ];

    private static readonly HashSet<string> NotAName = new(StringComparer.Ordinal)
    {
        // demonstratives / pronoun-ish
        "هذه", "هاي", "هاذي", "هذي", "هادي", "هاده", "هاد", "هاذه", "الحاليه", "الحالي", "this", "that", "the", "it", "a", "an", "my",
        // question / filler words that follow "hall" in questions
        "كم", "شو", "ايش", "وين", "متاحه", "متاح", "فيها", "فيه", "في", "ب", "بكم", "سعرها", "سعر", "سعتها", "هل", "مين", "كيف",
        "available", "price", "capacity", "has", "have", "is", "are", "for", "in", "at", "near", "how", "what", "where", "which", "does",
        // generic "hall" qualifiers
        "افراح", "الافراح", "اعراس", "مناسبات", "wedding", "weddings", "event", "events"
    };

    /// <summary>Zero-based index into the last shown halls, or -1 for "the last one"; null when none.</summary>
    public static int? TryGetOrdinal(string? message)
    {
        var text = AiText.Normalize(message);
        foreach (var (index, pattern) in Ordinals)
        {
            if (pattern.IsMatch(text))
            {
                return index;
            }
        }

        return null;
    }

    private static readonly Regex WordRegex = new(@"[\p{L}\p{N}]+", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    /// <summary>
    /// The hall name the user typed ("قاعة النخيل", "Orchid hall"), in the user's own
    /// spelling (so it can be searched), or null when the message only uses a pronoun
    /// or "this hall". Region words are not names.
    /// </summary>
    public static string? TryGetExplicitHallName(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return null;
        }

        var words = WordRegex.Matches(message).Select(m => m.Value).ToList();
        for (var i = 0; i < words.Count; i++)
        {
            var noun = StripDefinite(AiText.Normalize(words[i]));
            var isNoun = noun is "قاعه" or "صاله" or "hall";

            if (isNoun && i + 1 < words.Count && noun != "hall")
            {
                var candidate = words[i + 1];
                var normalized = AiText.Normalize(candidate);
                if (!NotAName.Contains(normalized) && !IsRegionOrLocationWord(normalized))
                {
                    return candidate;
                }
            }

            // English: the name comes BEFORE the noun ("Orchid hall").
            if (noun == "hall" && i > 0)
            {
                var candidate = words[i - 1];
                var normalized = AiText.Normalize(candidate);
                if (normalized.Length > 1 && normalized.All(c => c is >= 'a' and <= 'z' or >= '0' and <= '9')
                    && !NotAName.Contains(normalized))
                {
                    return candidate;
                }
            }
        }

        return null;
    }

    private static string StripDefinite(string token)
        => token.StartsWith("ال", StringComparison.Ordinal) && token.Length > 2 ? token[2..] : token;

    private static bool IsRegionOrLocationWord(string token)
    {
        var stripped = token.StartsWith("ب", StringComparison.Ordinal) || token.StartsWith("ف", StringComparison.Ordinal)
            ? token[1..]
            : token;
        return stripped is "غزه" or "شمال" or "جنوب" or "الوسطى" or "وسط" or "رفح" or "خانيونس" or "النصيرات"
            or "gaza" or "north" or "south" or "middle" or "رمال" or "الرمال";
    }
}
