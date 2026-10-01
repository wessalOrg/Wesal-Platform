using System.Text.RegularExpressions;

namespace Wesal.Application.Ai.Navigation;

public enum AiNavigationMode
{
    /// <summary>Show a call-to-action button; the user decides.</summary>
    Suggest,

    /// <summary>The user explicitly asked to be taken there; the client may navigate.</summary>
    Auto
}

public sealed record AiNavigationMatch(WesalPage Page, AiNavigationMode Mode);

/// <summary>A service the user asked for that has no real Wesal page (yet).</summary>
public sealed record AiUnavailableTopic(string Key, string LabelAr, string LabelEn);

/// <summary>
/// Deterministic navigation understanding. It separates information questions
/// ("شو هي صفحة الصالات؟"), discovery ("بدي صالة", "وين الأسئلة الشائعة؟") and explicit
/// navigation ("وديني عالصالات"). It can only ever return a page that exists in
/// <see cref="WesalNavigationRegistry"/>, so it cannot produce an invented route.
/// Messages that carry real search criteria or a data question (price, capacity,
/// availability, booking...) are deliberately NOT treated as navigation.
/// </summary>
public static class AiNavigationIntentDetector
{
    private const int MaxExplicitTokens = 9;
    private const int MaxDiscoveryTokens = 7;

    private static readonly Regex ExplicitVerbs = AiText.AnyWord([
        "وديني", "وصلني", "خديني", "خدني", "روحني", "افتح", "افتحلي", "افتحلى", "افتحلنا",
        "روح", "اذهب", "انتقل", "ودني", "سجلني", "take", "open", "navigate", "bring", "redirect", "go"
    ]);

    private static readonly Regex ShowAllRegex = new(
        @"(?:ورجيني|وريني|اعرض|show\s+me)\s+(?:لي\s+|لنا\s+)?(?:كل|جميع|all)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex DiscoveryMarkers = AiText.AnyWord([
        "بدي", "ابغى", "اريد", "ابي", "وين", "فين", "بلاقي", "الاقي", "ابحث", "ورجيني", "وريني",
        "اعرض", "where", "find", "show", "want", "need", "looking", "see", "browse", "wanna"
    ]);

    private static readonly Regex InfoMarkers = new(
        @"(?:شو|ما|ايش|what).{0,12}(?:صفحه|page)|(?:صفحه|page).{0,12}(?:شو|ايش|what)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex LoginAutoRegex = new(
        @"(?:سجلني|log\s+me\s+in|sign\s+me\s+in)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    // A message about price/capacity/availability/booking/etc. is a data or how-to
    // question, never "take me to a page".
    private static readonly Regex DataQuestionBlockers = AiText.AnyWord([
        "كم", "سعر", "اسعار", "ثمن", "تكلفه", "سعه", "بتسع", "متاح", "متاحه", "متوفر", "متوفره",
        "حجز", "احجز", "احجزها", "حجزت", "تفاصيل", "كيف", "ليش", "لماذا", "متى",
        "price", "cost", "capacity", "available", "availability", "book", "booking", "details",
        "how", "why", "when", "much"
    ]);

    private static readonly Regex HowRegex = AiText.AnyWord(["كيف", "how"]);

    private static readonly (AiUnavailableTopic Topic, Regex Pattern)[] UnavailableTopics =
    [
        (new AiUnavailableTopic("photography", "تصوير", "photography"),
            AiText.AnyWord(["تصوير", "مصور", "مصورين", "فوتوغراف", "photography", "photographer", "photographers", "photo", "photos", "videography"])),
        (new AiUnavailableTopic("catering", "ضيافة وبوفيه", "catering"),
            AiText.AnyWord(["بوفيه", "ضيافه", "كاترينج", "طعام", "catering", "buffet"])),
        (new AiUnavailableTopic("invitations", "تصميم دعوات", "invitation design"),
            AiText.AnyWord(["دعوات", "بطاقات", "invitation", "invitations", "cards"])),
        (new AiUnavailableTopic("suit_rental", "تأجير بدل", "suit rental"),
            AiText.AnyWord(["بدل", "بدله", "فستان", "فساتين", "suit", "suits", "dress", "dresses"])),
        (new AiUnavailableTopic("planners", "منسقي أفراح", "wedding planners"),
            AiText.AnyWord(["منسق", "منسقه", "منسقين", "planner", "planners", "decorator", "decorators"]))
    ];

    /// <summary>
    /// Returns the registry page the message is asking about, with how forcefully it
    /// asked, or null when the message is not a navigation request.
    /// </summary>
    public static AiNavigationMatch? Detect(string? message)
    {
        var text = AiText.Normalize(message);
        if (text.Length == 0)
        {
            return null;
        }

        var tokens = AiText.Tokens(text);
        var page = FindPage(text);
        if (page is null)
        {
            return null;
        }

        var blocked = DataQuestionBlockers.IsMatch(text);

        if (page.Key == WesalNavigationRegistry.Login && LoginAutoRegex.IsMatch(text))
        {
            return new AiNavigationMatch(page, AiNavigationMode.Auto);
        }

        if (ExplicitVerbs.IsMatch(text) && tokens.Count <= MaxExplicitTokens && !blocked)
        {
            return new AiNavigationMatch(page, AiNavigationMode.Auto);
        }

        if (ShowAllRegex.IsMatch(text) && tokens.Count <= MaxExplicitTokens && !blocked)
        {
            return new AiNavigationMatch(page, AiNavigationMode.Auto);
        }

        if (InfoMarkers.IsMatch(text) && tokens.Count <= MaxDiscoveryTokens)
        {
            return new AiNavigationMatch(page, AiNavigationMode.Suggest);
        }

        // A lone page name ("الصالات", "FAQ", "صفحة المساعدة") is a navigation wish; a
        // noun followed by a name ("قاعة النخيل") is a hall reference and must not be.
        var bareNoun = tokens.Count == 1
            || (tokens.Count == 2 && (tokens[0] == "صفحه" || tokens[0] == "page" || tokens[1] == "page"));
        if ((DiscoveryMarkers.IsMatch(text) || bareNoun) && tokens.Count <= MaxDiscoveryTokens && !blocked)
        {
            return new AiNavigationMatch(page, AiNavigationMode.Suggest);
        }

        return null;
    }

    /// <summary>
    /// Page a how-to / knowledge answer can usefully point at (always Suggest). Used to
    /// add a CTA to answers such as "كيف أبحث عن صالة؟" (halls) or "كيف أسجل؟" (register).
    /// </summary>
    public static AiNavigationMatch? DetectSuggestion(string? message)
    {
        var text = AiText.Normalize(message);
        if (text.Length == 0)
        {
            return null;
        }

        var direct = Detect(message);
        if (direct is not null)
        {
            return direct with { Mode = AiNavigationMode.Suggest };
        }

        if (AiText.Tokens(text).Count > 12 || !HowRegex.IsMatch(text))
        {
            return null;
        }

        var page = FindPage(text);
        return page is null || page.Key == WesalNavigationRegistry.HallDetails
            ? null
            : new AiNavigationMatch(page, AiNavigationMode.Suggest);
    }

    /// <summary>
    /// Detects a request for a service Wesal has no page for. Returns null when a real
    /// registry page matched the same words or when the message is not a wish/navigation.
    /// </summary>
    public static AiUnavailableTopic? DetectUnavailableTopic(string? message)
    {
        var text = AiText.Normalize(message);
        if (text.Length == 0 || AiText.Tokens(text).Count > MaxExplicitTokens)
        {
            return null;
        }

        if (!DiscoveryMarkers.IsMatch(text) && !ExplicitVerbs.IsMatch(text))
        {
            return null;
        }

        foreach (var (topic, pattern) in UnavailableTopics)
        {
            if (pattern.IsMatch(text) && FindPage(text) is null)
            {
                return topic;
            }
        }

        return null;
    }

    private static WesalPage? FindPage(string text)
    {
        WesalPage? best = null;
        var bestLength = 0;

        foreach (var page in WesalNavigationRegistry.NavigablePages)
        {
            foreach (var noun in page.NounsAr.Concat(page.NounsEn))
            {
                if (noun.Length <= bestLength)
                {
                    continue;
                }

                if (Regex.IsMatch(text, AiText.WordWithArabicPrefixes(noun), RegexOptions.CultureInvariant))
                {
                    best = page;
                    bestLength = noun.Length;
                }
            }
        }

        return best;
    }
}
