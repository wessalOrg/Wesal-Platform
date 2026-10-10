using System.Text.RegularExpressions;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.AiAssistant;

public sealed partial class HowToService : IHowToService
{
    private const string DefaultLanguage = "ar";

    /// <summary>
    /// Official-fact knowledge categories that win over the deterministic feature
    /// matcher: platform/about, FAQ/price and policies. Feature how-tos
    /// (user-guide, hall-owner) stay with the tailored deterministic answers.
    /// </summary>
    private static readonly HashSet<string> OfficialFactCategories = new(
        ["platform", "faq", "policies"],
        StringComparer.OrdinalIgnoreCase);

    private static readonly string[] SupportContactMarkers =
    [
        "wesal", "وصال", "support", "دعم", "whatsapp", "واتساب", "phone", "هاتف",
        "email", "بريد", "tel", "رقم", "تواصل مع وصال"
    ];

    private readonly ISubscriptionPaymentService _subscriptionPaymentService;
    private readonly IAiLanguageDetector _languageDetector;
    private readonly ISubscriptionPaymentIntentDetector _paymentIntentDetector;
    private readonly IGeminiService? _geminiService;
    private readonly IWesalKnowledgeService? _knowledgeService;

    public HowToService(
        ISubscriptionPaymentService subscriptionPaymentService,
        IAiLanguageDetector? languageDetector = null,
        ISubscriptionPaymentIntentDetector? paymentIntentDetector = null,
        IGeminiService? geminiService = null,
        IWesalKnowledgeService? knowledgeService = null)
    {
        _subscriptionPaymentService = subscriptionPaymentService;
        _languageDetector = languageDetector ?? new AiLanguageDetector();
        _paymentIntentDetector = paymentIntentDetector ?? new SubscriptionPaymentIntentDetector();
        _geminiService = geminiService;
        _knowledgeService = knowledgeService;
    }

    public async Task<HowToResponse> AskHowToAsync(
        string question,
        string? language,
        CancellationToken cancellationToken = default,
        bool allowModel = true)
    {
        var detected = _languageDetector.Detect(question);
        var effectiveLanguage = detected ?? (string.IsNullOrWhiteSpace(language) ? DefaultLanguage : language);

        if (IsOtherHallBookingPolicyQuestion(question))
        {
            return new HowToResponse(
                effectiveLanguage == "en"
                    ? "Whether a Hall Owner can book another hall is not confirmed yet. Please contact Wesal support."
                    : "سياسة حجز صاحب القاعة لقاعة أخرى غير مؤكدة عندي حاليًا، تواصل مع دعم وصال للتأكد.",
                "policies", effectiveLanguage, DateTime.UtcNow);
        }

        // Payment questions are disambiguated BEFORE anything else: a hall-owner
        // subscription is answered from trusted configuration, a booking payment from
        // the booking knowledge, and a bare "how do I pay" asks which one is meant.
        var payment = AiPaymentIntentClassifier.Classify(question);
        if (payment == AiPaymentIntent.OwnerSubscription || _paymentIntentDetector.IsSubscriptionPaymentIntent(question))
        {
            var details = _subscriptionPaymentService.GetPaymentDetails();
            var paymentAnswer = effectiveLanguage == "en"
                ? $"To pay your subscription as a Hall Owner: contact the Admin via WhatsApp at {details.AdminWhatsAppContact} to arrange payment. The subscription is {details.SubscriptionPriceIls:F0} ILS per {details.SubscriptionCycleDays}-day cycle per hall. Once the Admin confirms your payment, your hall's management features unlock."
                : $"لدفع اشتراكك كصاحب قاعة: تواصل مع المدير عبر واتساب على الرقم {details.AdminWhatsAppContact} لترتيب الدفع. الاشتراك {details.SubscriptionPriceIls:F0} شيكل لكل {details.SubscriptionCycleDays} يوم لكل قاعة. بمجرد تأكيد المدير للدفع، يتم فتح ميزات إدارة قاعدتك.";
            return new HowToResponse(paymentAnswer, "payment", effectiveLanguage, DateTime.UtcNow);
        }

        if (payment == AiPaymentIntent.BookingPayment)
        {
            return new HowToResponse(AiPaymentTexts.BookingFallback(effectiveLanguage), "booking-payment", effectiveLanguage, DateTime.UtcNow);
        }

        if (payment == AiPaymentIntent.Ambiguous)
        {
            var ask = AiPaymentTexts.Ambiguous(effectiveLanguage, _subscriptionPaymentService.GetPaymentDetails());
            return new HowToResponse(ask, "payment", effectiveLanguage, DateTime.UtcNow);
        }

        if (IsCreatorQuestion(question))
        {
            var creatorAnswer = effectiveLanguage == "en"
                ? "I’m Wesal’s smart assistant 😄🇵🇸\n" +
                  "I was specially created to help you find the perfect wedding hall and answer your questions about halls, bookings, and the Wesal platform.\n\n" +
                  "In short… the Wesal team built me to make your search easier and save you the headache of looking around 😂."
                : "أنا مساعد وصال الذكي 😄🇵🇸\n" +
                  "انعملت خصيصًا عشان أساعدك تلاقي صالة أفراح مناسبة، وأجاوبك عن الصالات والحجز والمنصة.\n" +
                  "يعني باختصار… فريق وصال صنعني، وأنا هون أخفف عنك وجعة راس البحث 😂.";
            return new HowToResponse(creatorAnswer, "creator", effectiveLanguage, DateTime.UtcNow);
        }

        // Official knowledge first (platform/faq/policies): the Knowledge Base is
        // the authoritative source for static Wesal facts (about, team, contact,
        // support hours, FAQ/price, privacy). It is checked before Gemini so the
        // exact official answer always wins without depending on model availability.
        // The contact guard prevents support contact info from hijacking questions
        // about messaging a hall owner (a feature how-to).
        if (_knowledgeService is not null)
        {
            var articles = await _knowledgeService.SearchAsync(
                question,
                effectiveLanguage,
                maxResults: 3,
                cancellationToken);

            // Respect retrieval rank. Searching the whole short list for any
            // "official" article let a broad platform page (for example the
            // homepage overview) override a higher-ranked feature guide.
            var official = articles.FirstOrDefault();
            if (official is not null
                && OfficialFactCategories.Contains(official.Category)
                && !IsContactInterference(official, question))
            {
                return new HowToResponse(
                    ComposeAnswer(official, effectiveLanguage),
                    official.Category,
                    effectiveLanguage,
                    DateTime.UtcNow);
            }
        }

        // Wesal's own support/contact question that the Knowledge Base could not answer:
        // point to the Help Center instead of falling through to hall-owner messaging.
        if (AiSupportIntentDetector.IsSupport(question))
        {
            var supportAnswer = effectiveLanguage == "en"
                ? "You can reach the Wesal team through the Help Center page."
                : "تقدر توصل لفريق وصال من صفحة مركز المساعدة.";
            return new HowToResponse(supportAnswer, "support", effectiveLanguage, DateTime.UtcNow);
        }

        // Try Gemini first when enabled and a key is configured. Any failure
        // (unavailable, error, timeout, empty/invalid response) falls through to
        // the existing deterministic keyword matching below.
        if (allowModel && _geminiService?.IsAvailable == true)
        {
            var geminiAnswer = await _geminiService.GenerateTextAsync(question, effectiveLanguage, cancellationToken);
            if (!string.IsNullOrWhiteSpace(geminiAnswer))
            {
                return new HowToResponse(geminiAnswer, "general", effectiveLanguage, DateTime.UtcNow);
            }
        }

        var normalized = Normalize(question);

        var (answer, category) = effectiveLanguage == "en"
            ? MatchEnglish(normalized)
            : MatchArabic(normalized);

        return new HowToResponse(
            answer,
            category,
            effectiveLanguage,
            DateTime.UtcNow);
    }

    public async Task<HowToResponse?> TryAnswerKnownQuestionAsync(
        string question,
        string? language,
        CancellationToken cancellationToken = default,
        AiConversationContext? context = null)
    {
        var normalized = Normalize(question);
        var hallQuestion = AiHallQuestionClassifier.Classify(question);
        var platformOverview = AiHallQuestionClassifier.MentionsPlatform(question)
            && !ContainsAny(normalized, "قاعه", "قاعات", "hall", "halls");
        if (!IsTeamQuestion(normalized) && !IsCreatorQuestion(question) && !platformOverview
            && hallQuestion is not AiHallQuestion.None and not AiHallQuestion.BookingHowTo and not AiHallQuestion.ContactOwner)
            return null;
        // Recommendation requests and bare search commands must retain structured
        // hall results and the read-only tool path. Only explicit search-how-to asks
        // are handled here.
        var explicitSearchHowTo = ContainsAny(normalized, "كيف ابحث", "كيف ادور", "how do i search", "how to search", "how can i find");
        if (!explicitSearchHowTo && (ContainsAny(normalized, "دور", "ابحث", "بحث", "search", "find", "browse", "استكشف", "هات قاعات", "جيب قاعات")
            || LooksLikeLiveHallSearch(normalized)))
            return null;
        var priorText = context is null ? string.Empty : string.Join(" ", context.Turns.Select(t => t.Text));
        var inAddHallFlow = ContainsAny(Normalize(priorText), "اضافه قاعه", "اضيف قاعه", "add a hall", "add hall", "hall owner")
            || ContainsAny(Normalize(priorText), "dashboard") && ContainsAny(Normalize(priorText), "hall");

        if (inAddHallFlow && ContainsAny(normalized, "شو بطلب مني", "شو لازم", "شو بطلب", "what do i need", "what is required"))
            return new HowToResponse(AddHallRequirements(language), "hall-owner", language ?? DefaultLanguage, DateTime.UtcNow);
        if (inAddHallFlow && ContainsAny(normalized, "بعد ما", "بعد ما ارسل", "وبعدها", "what happens after", "after i submit"))
            return new HowToResponse(AddHallReview(language), "hall-approval", language ?? DefaultLanguage, DateTime.UtcNow);
        if (inAddHallFlow && ContainsAny(normalized, "ليش", "ليه", "مش ظاهره", "مش ظاهرة", "not visible", "not showing"))
            return new HowToResponse(AddHallVisibility(language), "hall-approval", language ?? DefaultLanguage, DateTime.UtcNow);

        var answer = await AskHowToAsync(question, language, cancellationToken, allowModel: false);
        return IsKnownAnswerCategory(answer.Category) ? answer : null;
    }

    /// <summary>
    /// Categories that carry trusted, deterministic product knowledge (official KB
    /// articles, support/payment configuration, creator fact, and tailored feature
    /// how-tos). Anything else from <see cref="AskHowToAsync"/> is either a trusted
    /// narrow deterministic answer (photos/pricing/capacity/month-hint/hours/
    /// payment/greeting) or the generic no-information fallback ("general").
    /// </summary>
    internal static bool IsKnownAnswerCategory(string? category)
        => KnownAnswerCategories.Contains(category ?? string.Empty);

    private static readonly HashSet<string> KnownAnswerCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "platform", "faq", "policies", "support", "creator", "booking", "booking-cancel",
        "booking-rejected", "registration", "login", "hall-owner", "hall-approval", "language",
        "install", "ratings", "comments", "messaging", "subscription", "availability", "booking-status",
        "hall-management", "hall-details", "search", "capabilities"
    };

    /// <summary>
    /// Learning-loop gap predicate (Mabrouk side, no Studio dependency): true only
    /// for the generic no-trusted-information fallback. Narrow deterministic answers
    /// (known categories above, plus photos/pricing/capacity/month-hint/hours/
    /// payment/greeting) are trusted product behavior, not missing knowledge.
    /// The future gap recorder must only fire for turns the assistant resolves
    /// through the deterministic HowTo path with this predicate true.
    /// </summary>
    internal static bool IsGenericFallbackAnswer(HowToResponse? answer)
        => string.Equals(answer?.Category, "general", StringComparison.OrdinalIgnoreCase);

    private static bool IsTeamQuestion(string normalized)
        => ContainsAny(normalized, "مين مطور", "من مطور", "مين طور وصال", "من طور وصال", "مين عمل وصال", "مين عمل منصة وصال",
            "who developed wesal", "who built wesal", "who are the developers", "wesal technical team");

    private static bool LooksLikeLiveHallSearch(string normalized)
        => ContainsAny(normalized, "قاعة", "قاعات", "hall", "halls")
            && (ContainsAny(normalized, "غزه", "شمال", "وسطى", "جنوب", "region", "capacity", "شخص", "نفر", "ضيف")
                || Regex.IsMatch(normalized, @"\d", RegexOptions.CultureInvariant));

    private static bool IsOtherHallBookingPolicyQuestion(string question)
    {
        var normalized = Normalize(question);
        return (ContainsAny(normalized, "صاحب القاعه", "مالك القاعه", "hall owner")
                && ContainsAny(normalized, "يحجز", "احجز", "حجز", "book", "booking"))
            && ContainsAny(normalized, "اخرى", "ثانيه", "غيرها", "another", "other hall");
    }

    private static string AddHallRequirements(string? language) => language == "en"
        ? "You need an authenticated Hall Owner account and an identity document uploaded to your profile. In the owner dashboard, choose Add Hall and enter the name, contact phone, region and matching address, capacity, and any optional price, description, features, hourly window, and photos."
        : "لازم يكون عندك حساب صاحب قاعة ومسجل دخول، وترفع وثيقة إثبات الهوية في ملفك قبل الإضافة. من لوحة صاحب القاعة اختار «إضافة قاعة»، وأدخل الاسم ورقم التواصل والمنطقة والعنوان المناسب لها والسعة. السعر والوصف والمزايا ومواعيد الساعات والصور حقول اختيارية حسب النموذج.";

    private static string AddHallReview(string? language) => language == "en"
        ? "After you submit the hall, it enters Pending Review. An Admin reviews it and approves or rejects it; you can follow its status from your owner dashboard."
        : "بعد الإرسال بتدخل القاعة حالة «قيد المراجعة». المدير بيراجعها وبيوافق عليها أو برفضها، وبتقدر تتابع حالتها من لوحة صاحب القاعة.";

    private static string AddHallVisibility(string? language) => language == "en"
        ? "For the hall to appear publicly, it must be approved, its subscription payment must be confirmed by an Admin, it must not be locked, and it must not be deleted."
        : "عشان تظهر القاعة للناس لازم تكون معتمدة، واشتراكها مدفوع ومؤكد من المدير، وما تكون مقفلة أو محذوفة.";

    /// <summary>
    /// Shared normalization (AiText): folds hamza/alef forms, ta marbuta,
    /// alef maqsura and diacritics, so keyword lists are written in the folded
    /// form and match "أبحث/ابحث"، "صورة/صوره"، "قيّم/قيم" alike.
    /// </summary>
    private static string Normalize(string input) => AiText.Normalize(input);

    /// <summary>
    /// When the top knowledge hit is the official support-contact article and the
    /// user is actually asking about messaging a Hall Owner, skip the KB answer so
    /// the tailored deterministic messaging guidance wins.
    /// </summary>
    private static bool IsContactInterference(WesalKnowledgeArticle article, string question)
    {
        if (!string.Equals(article.Category, "platform", StringComparison.OrdinalIgnoreCase)
            || !article.Title.Contains("contact", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var normalized = Normalize(question);
        return !ContainsAny(normalized, SupportContactMarkers);
    }

    private static string ComposeAnswer(WesalKnowledgeArticle article, string language)
    {
        return WesalKnowledgeAnswerComposer.Compose(article, language);
    }

    private (string Answer, string Category) MatchEnglish(string question)
    {
        if (ContainsAny(question, "search", "find", "look for", "browse halls", "filter"))
            return ("To search for halls: go to the Browse & Search page from the navigation bar. You can filter halls by region (North Gaza, Gaza, Middle Area, South Gaza), by area, by date, or by hall name. You can combine multiple filters. Only approved halls appear in results.", "search");

        if (ContainsAny(question, "book", "reserve", "booking", "book a hall"))
            return ("To book a hall: sign in to your registered account as a Registered User, open the hall details page, select a date and one or more 60-minute slots, then submit your request. It starts as Pending while the Hall Owner reviews it, and you can follow it in My Bookings.", "booking");

        if (ContainsAny(question, "rate", "rating", "star", "rate a hall"))
            return ("Rating eligibility and requirements are not confirmed in the current product information. Please contact Wesal support to confirm.", "ratings");

        if (ContainsAny(question, "comment", "review", "feedback", "add comment"))
            return ("Comment eligibility and visibility requirements are not confirmed in the current product information. Please contact Wesal support to confirm.", "comments");

        if (ContainsAny(question, "contact", "message", "owner", "chat", "contact owner"))
            return ("To contact a hall owner: open the hall details page while logged in as a Registered User. Tap the Contact Hall Owner button next to the Book button. This opens a conversation with the owner where you can ask about pricing, availability, or any other details.", "messaging");

        if (ContainsAny(question, "register", "sign up", "create account", "account"))
            return ("To create an account: tap Create Account in the navigation bar. Choose between Regular User (to book, rate, comment, and message) or Hall Owner (to list and manage your own halls). Fill in your name, email, phone, and password.", "registration");

        if (ContainsAny(question, "login", "log in", "sign in"))
            return ("To log in: tap Login in the navigation bar. Enter your registered email address or phone number along with your password. You will be redirected to the homepage with full access to your account features.", "login");

        if (ContainsAny(question, "hall detail", "hall info", "photo", "gallery", "ameniti", "capacity", "hall page"))
            return ("To view hall details: tap any hall card from the search results or homepage. The details page shows the photo gallery, description, capacity, location, contact information, available amenities, pricing, and an interactive availability calendar.", "hall-details");

        if (ContainsAny(question, "availability", "calendar", "available", "slot", "hour", "free date"))
            return ("To check availability: open a hall's details page and select a date. The page shows the hall's hourly slots for that day. Available slots are shown in green and booked slots in red, or hidden when the owner chooses not to show them.", "availability");

        if (ContainsAny(question, "add hall", "add my hall", "register my hall", "hall owner", "manage hall", "dashboard"))
            return ("To add a hall, sign in with a Hall Owner account and upload an identity document to your profile. In the owner dashboard, choose Add Hall and enter the hall name, contact phone, region and matching address, and capacity. Price, description, features, hourly window, and photos are optional in the form. After submission, the hall enters Pending Review for Admin approval. Public visibility also requires confirmed subscription payment and that the hall is not locked or deleted.", "hall-owner");

        if (ContainsAny(question, "language", "arabic", "english", "toggle"))
            return ("To switch the site language: tap the language toggle button in the top navigation bar. The site supports Arabic (default, RTL) and English (LTR). All content and layout adjust automatically when you switch.", "language");

        if (ContainsAny(question, "install", "download app", "add to home screen", "pwa"))
            return ("If the Install Wesal button is available in your browser, use it to install. On iPhone/iPad Safari, use Share, then Add to Home Screen. The install option may not appear on every browser or device.", "install");

        if (ContainsAny(question, "payment", "subscription", "pay", "ils"))
        {
            var details = _subscriptionPaymentService.GetPaymentDetails();
            return ($"To pay your subscription as a Hall Owner: contact the Admin via WhatsApp at {details.AdminWhatsAppContact} to arrange payment. The subscription is {details.SubscriptionPriceIls:F0} ILS per {details.SubscriptionCycleDays}-day cycle per hall. Once the Admin confirms your payment, your hall's management features unlock.", "payment");
        }

        if (ContainsAny(question, "how to use", "how do i", "help", "guide", "tutorial", "what can", "what is wesal", "about wesal", "about this site"))
            return ("Wesal helps people in Gaza browse approved wedding halls, view their details and current availability, and submit booking requests. Photographers and wedding planners are Coming Soon and cannot currently be booked; catering is not available. Sign in with a Registered User account to submit a booking request.", "general");

        if (ContainsAny(question, "cancel", "cancellation"))
            return ("From My Bookings, open the request and cancel it if it is Pending or Accepted and the deposit has not been confirmed as paid. The system blocks cancellation after payment confirmation. Refund amounts, fees, and timing require confirmation from Wesal support.", "booking-cancel");

        return ("I can help you with how to use Wesal. You can ask about: searching for halls, booking a hall, viewing hall details, rating and commenting on halls, contacting hall owners, registration, login, language switching, and more. What would you like to know?", "general");
    }

    /// <summary>
    /// A month was named without a day ("بشهر 10", "أكتوبر"): availability needs
    /// an exact date, so ask for the day instead of guessing or falling back to
    /// the generic answer. Month names are word-bounded ("اب" must not match
    /// inside "باب"/"جواب"، and bare "شهر" must not match "اشهر").
    /// </summary>
    private static readonly Regex MonthHint = new(
        AiText.Bounded(@"بشهر|بالشهر|الشهر|هالشهر|بهالشهر|يناير|كانون الثاني|فبراير|شباط|مارس|اذار|ابريل|نيسان|مايو|ماي|ايار|يونيو|حزيران|يوليو|تموز|اغسطس|اب|سبتمبر|ايلول|اكتوبر|تشرين|نوفمبر|تشرين الثاني|ديسمبر|كانون|كانون اول|كانون الاول|شهر\s+\d|january|february|march|april|may|june|july|august|september|october|november|december"),
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private (string Answer, string Category) MatchArabic(string question)
    {
        // Photo gallery questions come before search so that "فرجيني صور
        // القاعة" (show me the photos) does not get a search answer.
        // Guard: "مصور/تصوير/فوتوغراف" contain "صور" as a substring but mean
        // photographer, which Wesal does not offer (unavailable topic).
        if (ContainsAny(question, "صور", "صورها", "صوره", "الصور", "معرض الصور", "about photos", "about gallery", "about pictures")
            && !ContainsAny(question, "مصور", "مصورين", "مصوره", "تصوير", "فوتوغراف", "فيديو"))
            return ("صور كل قاعة موجودة في معرض الصور بصفحة تفاصيلها: افتح القاعة واضغط على أي صورة عشان تشوفها بالحجم الكامل وتتنقل بينهم. إذا الصور ما ظهرت عندك جرّب تحدّث الصفحة أو تواصل معنا من مركز المساعدة.", "photos");

        if (ContainsAny(question, "بحث", "ابحث", "دور", "دورلي", "بدور", "فرجيني", "ورجيني", "وريني", "جيبلي", "هات", "هاتلي", "بلاقي", "الاقي", "وين بلاقي", "شو عندكم", "استعرض", "استعراض", "اعرض", "اعرضلي", "عرض", "شوف", "شوفلي", "تصفيه", "about search", "about filter", "search", "find", "browse", "filter"))
            return ("للبحث عن قاعات: انتقل إلى صفحة الاستكشاف والبحث من شريط التنقل. يمكنك تصفية القاعات حسب المنطقة (شمال غزة، غزة، الوسطى، جنوب المنطقة)، المنطقة الفئة، التاريخ، أو اسم القاعة. يمكنك الجمع بين عدة مرشحات. فقط القاعات المعتمدة تظهر في النتائج.", "search");

        // Cancellation / backing out comes BEFORE booking: "بدي الغي الحجز"
        // contains حجز and must not receive booking instructions.
        if ((ContainsAny(question, "الغاء", "الغي", "الغيه", "يلغي", "بطلت", "بلاش") && ContainsAny(question, "حجز", "حجزي", "الحجز"))
            || (ContainsAny(question, "مش", "ما") && ContainsAny(question, "بدي") && ContainsAny(question, "حجز", "احجز")))
            return ("من صفحة حجوزاتي افتح الطلب وألغيه إذا كان «معلق» أو «مقبول» ولم يتم تأكيد دفع العربون. بعد تأكيد الدفع لا يسمح النظام بالإلغاء. تفاصيل الرسوم أو المبالغ المستردة ومواعيدها غير مؤكدة عندي؛ تواصل مع دعم وصال للتأكد.", "booking-cancel");

        // "ليش الحجز مرفوض؟" needs the reason, not booking instructions.
        if (ContainsAny(question, "ليش", "ليه", "لماذا") && ContainsAny(question, "مرفوض", "رفض", "انرفض", "الحجز", "حجزي"))
            return ("سبب الرفض بيوصلك في الإشعارات مع تفاصيل طلب الحجز. افتح صفحة حجوزاتك أو الإشعارات وشوف ملاحظة صاحب القاعة، وإذا بدك توضيح أكثر تواصل معه مباشرة عبر المحادثة من صفحة القاعة.", "booking-rejected");

        // Gazan price phrasings: قديش/بقديش/شو سعر. Before booking so that
        // "بقديش الحجز؟" answers the price instead of booking steps.
        if (ContainsAny(question, "قديش", "بقديش", "كم سعر", "كم ثمن", "شو سعر", "شو اسعار", "سعرها", "سعره", "الاسعار", "اسعار", "about price", "about cost", "about fee"))
            return ("أسعار القاعات بتختلف من قاعة لثانية حسب السعة والخدمات والفترة. افتح صفحة تفاصيل أي قاعة وشوف قسم الأسعار والفترات، وبتقدر تقارن بين كذا قاعة من صفحة البحث. إذا بدك مساعدة باختيار قاعة بسعر معين احكيلي عن ميزانيتك والمنطقة.", "pricing");

        if (ContainsAny(question, "توفر", "تقويم", "متاح", "فاضي", "فاضيه", "فاضية", "شاغر", "شاغره", "فترات", "ساعة", "ساعه", "about availability", "about calendar", "about available", "about slot", "about hour"))
            return ("للتحقق من التوفر: افتح صفحة تفاصيل القاعة واختر التاريخ. تعرض الصفحة الفترات المتاحة بالساعة في ذلك اليوم. الفترات المتاحة باللون الأخضر والمحجوزة باللون الأحمر، أو تُخفى إذا اختار صاحب القاعة ذلك.", "availability");

        if (ContainsAny(question, "حجز", "احجز", "حجزت", "about booking", "about reserve", "book", "reserve", "booking"))
            return ("لحجز قاعة: سجّل الدخول بحساب مسجل كمستخدم عادي، وافتح تفاصيل القاعة واختر التاريخ وفترة أو أكثر، مدة كل منها ساعة. أرسل الطلب؛ يبدأ بحالة «معلق» إلى أن يراجعه صاحب القاعة، وتتابعه من صفحة حجوزاتي.", "booking");

        if (ContainsAny(question, "تقييم", "قيم", "نجمه", "about rating", "about rate", "about star"))
            return ("شروط أهلية التقييم ومتطلباته غير مؤكدة في معلومات المنتج الحالية. تواصل مع دعم وصال للتأكد.", "ratings");

        if (ContainsAny(question, "تعليق", "اكتب تعليق", "about comment", "about review", "about feedback"))
            return ("شروط أهلية التعليق وظهوره غير مؤكدة في معلومات المنتج الحالية. تواصل مع دعم وصال للتأكد.", "comments");

        if (ContainsAny(question, "تواصل", "مراسله", "اتصال", "صاحب القاعه", "صاحب الصاله", "مالك القاعه", "about contact", "about message", "about owner", "about chat"))
            return ("للتواصل مع صاحب القاعة: افتح صفحة تفاصيل القاعة وأنت مسجل الدخول. اضغط على زر التواصل مع صاحب القاعة بجانب زر الحجز. سيفتح لك محادثة مع الصاحب حيث يمكنك السؤال عن الأسعار أو التفاصيل أو أي معلومات أخرى.", "messaging");

        if (ContainsAny(question, "تسجيل", "حساب", "انشاء حساب", "اعمل حساب", "سوي حساب", "about register", "about sign", "about create account", "about account"))
            return ("لإنشاء حساب: اضغط على إنشاء حساب في شريط التنقل. اختر بين المستخدم العادي (لحجز، تقييم، تعليق، مراسلة) أو صاحب القاعة (لإضافة وإدارة قاعاتك). أكمل بياناتك: الاسم الكامل، البريد الإلكتروني، رقم الهاتف، كلمة المرور.", "registration");

        if (ContainsAny(question, "دخول", "تسجيل دخول", "سجل دخول", "فوت", "فوتي", "about login", "about sign in", "about log in"))
            return ("لتسجيل الدخول: اضغط على تسجيل الدخول في شريط التنقل. أدخل البريد الإلكتروني أو رقم الهاتف المسجل مع كلمة مرورك. سيتم توجيهك إلى الصفحة الرئيسية مع الوصول الكامل إلى ميزات حسابك.", "login");

        if (ContainsAny(question, "تفاصيل القاعه", "معلومات القاعه", "صوره", "معرض", "مرافق", "سعه", "about hall detail", "about hall info", "about photo", "about gallery", "about ameniti", "about capacity"))
            return ("لعرض تفاصيل القاعة: اضغط على أي بطاقة قاعة من نتائج البحث أو الصفحة الرئيسية. صفحة التفاصيل تضم معرض الصور، الوصف، السعة، الموقع، معلومات الاتصال، المرافق المتوفرة، الأسعار، وتقويم التوفر التفاعلي.", "hall-details");

        // Capacity questions: the live number lives on the hall details page.
        if (ContainsAny(question, "سعه", "سعتها", "سعته", "بتسع", "بتتسع", "تتسع", "كم شخص", "كم نفر", "كم ضيف", "كم واحد", "عدد الاشخاص", "عدد الضيوف", "about capacity", "about seats"))
            return ("سعة كل قاعة (كم شخص بتسع) مكتوبة في صفحة تفاصيلها مع باقي المعلومات. افتح القاعة اللي عجبتك وشوف السعة، وإذا بدك قاعة كبيرة لمناسبة معينة احكيلي العدد التقريبي والمنطقة وبساعدك تدور.", "capacity");

        // A month without a day ("بشهر 10"، "أكتوبر"): availability needs an
        // exact date, so ask for the day instead of guessing.
        if (MonthHint.IsMatch(question))
            return ("تمام، بشهر مناسب! بس عشان أفحصلك التوفر لازم يوم محدد — بأي يوم بالضبط؟ (مثال: 15/10) وإذا حكيتلي المنطقة وعدد الضيوف بدوّرلك على أنسب القاعات المتاحة بهاليوم.", "month-hint");

        // Opening / support hours: point to the Help Center, never invent hours.
        if (ContainsAny(question, "دوام", "دوامكم", "ساعات العمل", "ساعات الدوام", "بتفتحو", "بتسكرو", "وينتا بتفتحو", "about hours", "about working hours"))
            return ("بتقدر تتواصل مع فريق وصال في أي وقت من صفحة مركز المساعدة، وطلبات الحجز والرسائل بتنبعت لأصحاب القاعات مباشرة وبيردوا عليك من حساباتهم. لمواعيد قاعة معينة (وينتا بتفتح أبوابها للمناسبات) شوف صفحة تفاصيلها أو اسأل صاحبها عبر المحادثة.", "hours");

        if (ContainsAny(question, "اضافه قاعه", "اضيف قاعه", "اسجل قاعه", "سجل قاعتي", "بضيف قاعتي", "صاحب قاعه", "صاحب صاله", "مالك قاعه", "اداره قاعه", "لوحه التحكم", "about hall owner", "about add hall", "about manage hall", "about dashboard"))
            return ("لإضافة قاعة، يلزم حساب صاحب قاعة وتسجيل الدخول، مع رفع وثيقة إثبات الهوية في ملفك. من لوحة صاحب القاعة اختر «إضافة قاعة» واملأ اسم القاعة ورقم التواصل والمنطقة والعنوان التابع لها والسعة. السعر والوصف والمزايا وساعات الحجز والصور اختيارية حسب النموذج. بعد الإرسال تدخل القاعة «قيد المراجعة» حتى يراجعها المدير. لظهورها للناس يجب اعتمادها وتأكيد دفع اشتراكها وألا تكون مقفلة أو محذوفة.", "hall-owner");

        if (ContainsAny(question, "لغه", "عربيه", "انجليزيه", "تبديل", "about language", "about arabic", "about english", "about toggle"))
            return ("لتبديل لغة الموقع: اضغط على زر تبديل اللغة في شريط التنقل العلوي. الموقع يدعم العربية (الافتراضي، من اليمين لليسار) والإنجليزية (من اليسار لليمين). جميع المحتوى والتخطيط يتكيفون تلقائياً عند التبديل.", "language");

        if (ContainsAny(question, "انزل وصال", "اثبت وصال", "نزل التطبيق", "تثبيت التطبيق", "اضيف للشاشه الرئيسيه", "تطبيق وصال", "pwa", "install app"))
            return ("إذا ظهر زر «تثبيت وصال» في متصفحك اضغط عليه. على iPhone أو iPad افتح وصال في Safari، ثم اختر «مشاركة» وبعدها «إضافة إلى الشاشة الرئيسية». قد لا يظهر خيار التثبيت في كل متصفح أو جهاز.", "install");

        if (ContainsAny(question, "دفع", "اشتراك", "ريال", "about payment", "about subscription", "about pay", "about ils"))
        {
            var details = _subscriptionPaymentService.GetPaymentDetails();
            return ($"لدفع اشتراكك كصاحب قاعة: تواصل مع المدير عبر واتساب على الرقم {details.AdminWhatsAppContact} لترتيب الدفع. الاشتراك {details.SubscriptionPriceIls:F0} شيكل لكل {details.SubscriptionCycleDays} يوم لكل قاعة. بمجرد تأكيد المدير للدفع، يتم فتح ميزات إدارة قاعدتك.", "payment");
        }

        if (ContainsAny(question, "كيف استخدم", "كيف يمكنني", "مساعده", "دليل", "تعليم", "ما هو وصال", "عن وصال", "عن هذا الموقع", "about how to use", "about how do i", "about help", "about guide", "about tutorial", "about what can", "about what is wesal", "about about wesal", "about about this site"))
            return ("وصال بتساعدك تتصفح قاعات الأفراح المعتمدة في غزة وتشوف تفاصيلها وتوفرها الحالي وترسل طلب حجز. خدمات المصورين ومنسقي المناسبات قيد التجهيز ولا يمكن حجزها حالياً، والضيافة والبوفيه غير متاحة. لإرسال طلب حجز يلزم تسجيل الدخول بحساب مستخدم مسجل.", "general");

        // What Wesal offers ("بتقدموا انتو؟", "شو خدماتكم؟"). Late on purpose:
        // a combined question ("شو بتقدمو غير الحجز؟") keeps its specific answer.
        if (ContainsAny(question, "بتقدمو", "بتقدموا", "بتوفر", "بتوفرو", "بتسوو", "بتعملو", "شو بتقدم", "شو بتقدمو", "شو خدماتكم", "ايش خدماتكم", "شو فيكم تساعدوني", "شو بتسوو", "about services", "about features", "about offer"))
            return ("وصال بتوفر تصفح القاعات المعتمدة والبحث عنها وعرض تفاصيلها وتوفرها الحالي وإرسال طلب حجز ومتابعته. المصورون ومنسقو المناسبات قيد التجهيز ولا يمكن البحث عنهم أو حجزهم حالياً، والضيافة والبوفيه غير متاحة.", "capabilities");

        // Greetings and thanks come last (before the fallback) so a greeting
        // combined with a real request ("مرحبا بدي احجز") still routes by intent.
        if (ContainsAny(question, "مرحبا", "اهلا", "اهلين", "سلام", "صباح الخير", "مسا الخير", "مساء الخير", "يسلمو", "يسلموا", "شكرا", "مشكور", "مشكوره", "يعطيك العافيه", "هلا", "about hello", "about hi", "about thanks", "about thank"))
            return ("أهلاً وسهلاً فيك! أنا مبروك، مساعد وصال. بقدر أساعدك تلاقي قاعة أفراح مناسبة: احكيلي عن المنطقة أو التاريخ أو السعر اللي ببالك، أو اسألني عن الحجز والتسجيل والتواصل مع أصحاب القاعات. شو بتحب تعرف؟", "greeting");

        return ("يمكنني مساعدتك في كيفية استخدام وصال. يمكنك السؤال عن: البحث عن قاعات، حجز قاعة، عرض تفاصيل القاعة، تقييم وتعليق على القاعات، التواصل مع أصحاب القاعات، التسجيل، تسجيل الدخول، تبديل اللغة، والمزيد. ماذا تريد أن تعرف؟", "general");
    }

    private static bool ContainsAny(string text, params string[] keywords)
    {
        return keywords.Any(keyword => text.Contains(keyword, StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsCreatorQuestion(string question)
    {
        // Match on normalized text so hamza/ta-marbuta spelling variants
        // ("أنشأ/انشا"، "شمعه/شمعه") are all recognized.
        var normalized = AiText.Normalize(question);
        // English intent
        if (ContainsAny(normalized,
                "who created mabrook", "who made mabrook", "who built mabrook", "who created you", "who made you",
                "who is your creator", "who built you", "who developed you", "your creator"))
            return true;

        // Arabic intent (MSA + Gazan: مين عملك، احكيلي عن حالك، عرفني عليك)
        if (ContainsAny(normalized,
                "من عمل مبروك", "مين عمل مبروك", "مين عامل مبروك", "مين صنع مبروك", "مين طور مبروك", "مين انشا مبروك",
                "مين عملك", "مين سواك", "مين صنعك", "مين صانعك", "مين مطورك", "مين انت", "شو انت",
                "احكيلي عن حالك", "احكي عن حالك", "عرفني عليك", "عرفني علي حالك", "مين مبروك", "شو مبروك"))
            return true;

        return false;
    }
}

internal static class WesalKnowledgeAnswerComposer
{
    public static string Compose(WesalKnowledgeArticle article, string language)
        => article.Status == WesalKnowledgeStatus.Verified
            ? article.Content
            : language == "en"
                ? "Wesal's policy for this case is not confirmed yet. Please contact Wesal support."
                : "سياسة هذه الحالة غير مؤكدة عندي حاليًا، تواصل مع دعم وصال.";
}
