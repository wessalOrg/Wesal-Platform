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
            var booking = _knowledgeService is null
                ? null
                : (await _knowledgeService.SearchAsync("booking deposit payment", effectiveLanguage, 5, cancellationToken))
                    .FirstOrDefault(a => string.Equals(a.Category, "user-guide", StringComparison.OrdinalIgnoreCase)
                        && a.Title.Contains("booking a hall", StringComparison.OrdinalIgnoreCase));

            var bookingAnswer = booking is not null
                ? ComposeAnswer(booking, effectiveLanguage)
                : AiPaymentTexts.BookingFallback(effectiveLanguage);
            return new HowToResponse(bookingAnswer, "booking-payment", effectiveLanguage, DateTime.UtcNow);
        }

        if (payment == AiPaymentIntent.Ambiguous)
        {
            var ask = AiPaymentTexts.Ambiguous(effectiveLanguage, _subscriptionPaymentService.GetPaymentDetails());
            return new HowToResponse(ask, "payment", effectiveLanguage, DateTime.UtcNow);
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

            var official = articles.FirstOrDefault(a => OfficialFactCategories.Contains(a.Category));
            if (official is not null
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

        // Creator-intent returns the exact, verified attribution in the user's
        // language. Handled before Gemini so the exact answer always wins,
        // independent of Gemini availability or model output.
        if (IsCreatorQuestion(question))
        {
            var creatorAnswer = effectiveLanguage == "en"
                ? "I’m Wesal’s smart assistant 😄🇵🇸\n" +
                  "I was specially created to help you find the perfect wedding hall and answer your questions about halls, bookings, and the Wesal platform.\n\n" +
                  "In short… the Wesal team built me to make your search easier and save you the headache of looking around 😂."
                : "أنا مساعد وصال الذكي 😄🇵🇸\n" +
                  "انعملت خصيصًا عشان أساعدك تلاقي صالة أفراح مناسبة، وأجاوبك عن الصالات والحجز والمنصة.\n" +
                  "يعني باختصار… فريق وصال صنعني، وأنا هون أخفف عنك وجعة راس البحث 😂.";
            return new HowToResponse(creatorAnswer, "general", effectiveLanguage, DateTime.UtcNow);
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
        var content = article.Content;

        if (article.Status != WesalKnowledgeStatus.Verified)
        {
            var caveat = language == "en"
                ? "\n\nNote: some details in this answer are pending verification; please contact the Wesal team to confirm before relying on them."
                : "\n\nملاحظة: بعض التفاصيل في هذه الإجابة قيد التحقق؛ يُنصح بالتواصل مع فريق وصال للتأكيد قبل الاعتماد عليها.";
            content += caveat;
        }

        return content;
    }

    private (string Answer, string Category) MatchEnglish(string question)
    {
        if (ContainsAny(question, "search", "find", "look for", "browse halls", "filter"))
            return ("To search for halls: go to the Browse & Search page from the navigation bar. You can filter halls by region (North Gaza, Gaza, Middle Area, South Gaza), by area, by date, or by hall name. You can combine multiple filters. Only approved halls appear in results.", "search");

        if (ContainsAny(question, "book", "reserve", "booking", "book a hall"))
            return ("To book a hall: open the hall details page and tap the Book button. Select your preferred date, then choose one or more 60-minute slots. Submit your booking request and the hall owner will review it. You need a registered account to book.", "booking");

        if (ContainsAny(question, "rate", "rating", "star", "rate a hall"))
            return ("To rate a hall: open the hall details page while logged in as a Registered User. You will see a 5-star rating control. Tap the number of stars (1-5) to submit your rating. You can update your rating later. Hall Owners cannot rate halls.", "ratings");

        if (ContainsAny(question, "comment", "review", "feedback", "add comment"))
            return ("To comment on a hall: open the hall details page while logged in as a Registered User. Find the comment section and type your comment. Submit it and it will appear publicly with your name and date. Hall Owners cannot post comments.", "comments");

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

        if (ContainsAny(question, "featured", "homepage", "landing", "home"))
            return ("The homepage shows an introduction to Wesal, 6 featured approved halls, and a How It Works section. You can filter featured halls by region. Tap any hall card to see full details. The Browse More Halls button takes you to the complete halls listing.", "homepage");

        if (ContainsAny(question, "hall owner", "add hall", "manage hall", "dashboard"))
            return ("Hall Owners can add halls, manage hourly settings and day blocks, handle booking requests, and respond to customer messages from their dashboard. Tap the Profile icon to access the management interface with a sidebar for managing all your halls.", "hall-owner");

        if (ContainsAny(question, "language", "arabic", "english", "toggle"))
            return ("To switch the site language: tap the language toggle button in the top navigation bar. The site supports Arabic (default, RTL) and English (LTR). All content and layout adjust automatically when you switch.", "language");

        if (ContainsAny(question, "payment", "subscription", "pay", "ils"))
        {
            var details = _subscriptionPaymentService.GetPaymentDetails();
            return ($"To pay your subscription as a Hall Owner: contact the Admin via WhatsApp at {details.AdminWhatsAppContact} to arrange payment. The subscription is {details.SubscriptionPriceIls:F0} ILS per {details.SubscriptionCycleDays}-day cycle per hall. Once the Admin confirms your payment, your hall's management features unlock.", "payment");
        }

        if (ContainsAny(question, "how to use", "how do i", "help", "guide", "tutorial", "what can", "what is wesal", "about wesal", "about this site"))
            return ("Wesal is a wedding hall booking platform for Gaza. You can browse approved wedding halls, search by region and date, view hall details and availability, book halls, rate and comment on halls, and message hall owners directly. Register for free to access booking, commenting, rating, and messaging features.", "general");

        if (ContainsAny(question, "cancel", "cancellation"))
            return ("To cancel a booking request while it is still pending: go to your bookings and select the pending request you want to cancel. Once the hall owner accepts or rejects your request, it can no longer be cancelled. Contact the hall owner through the conversation to discuss any changes.", "booking");

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
            return ("تمام، لا مشكلة! إذا عندك طلب حجز معلق وبدك تلغيه: روح على حجوزاتك واختار الطلب المعلق والغيه. بس انتبه: بعد ما صاحب القاعة يقبل الطلب أو يرفضه ما بتقدر تلغيه، وساعتها تواصل معه عبر المحادثة. وإذا غيّرت رأيك وحابب تحجز قاعة ثانية، أنا جاهز أساعدك.", "booking-cancel");

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
            return ("لحجز قاعة: افتح صفحة تفاصيل القاعة واضغط على زر حجز. اختر التاريخ المفضل، ثم اختر فترة ساعة أو أكثر متتالية. أرسل طلب الحجز وسيراجعه صاحب القاعة. تحتاج إلى حساب مسجل للحجز.", "booking");

        if (ContainsAny(question, "تقييم", "قيم", "نجمه", "about rating", "about rate", "about star"))
            return ("لتقييم قاعة: افتح صفحة تفاصيل القاعة وأنت مسجل الدخول كمستخدم عادي. سترى عناصر النجوم الخمسة. اضغط على عدد النجوم (1-5) لإرسال تقييمك. يمكنك تحديث تقييمك لاحقاً. أصحاب القاعات لا يمكنهم تقييم القاعات.", "ratings");

        if (ContainsAny(question, "تعليق", "اكتب تعليق", "about comment", "about review", "about feedback"))
            return ("لإضافة تعليق على قاعة: افتح صفحة تفاصيل القاعة وأنت مسجل الدخول. اختر قسم التعليقات واكتب تعليقك. أرسله وسيظهر للجميع مع اسمك وتاريخه. أصحاب القاعات لا يمكنهم كتابة تعليقات.", "comments");

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

        if (ContainsAny(question, "الصفحه الرييسيه", "مقدمه", "about featured", "about homepage", "about landing", "about home"))
            return ("الصفحة الرئيسية تُعرّف وصال وتعرض 6 قاعات معتمدة مميزة وقسم كيفية العمل. يمكنك تصفية القاعات المميزة حسب المنطقة. اضغط على بطاقة أي قاعة لعرض تفاصيلها الكاملة. زر تصفح المزيد ينقلك إلى قائمة القاعات الكاملة.", "homepage");

        if (ContainsAny(question, "صاحب القاعه", "اضافه قاعه", "اداره قاعه", "لوحه التحكم", "about hall owner", "about add hall", "about manage hall", "about dashboard"))
            return ("أصحاب القاعات يمكنهم إضافة قاعات، إدارة إعدادات الساعات وحظر الأيام، التعامل مع طلبات الحجز، والرد على رسائل العملاء من لوحة التحكم. اضغط على أيقونة الملف الشخصي للوصول إلى واجهة الإدارة مع الشريط الجانبي لإدارة جميع قاعاتك.", "hall-owner");

        if (ContainsAny(question, "لغه", "عربيه", "انجليزيه", "تبديل", "about language", "about arabic", "about english", "about toggle"))
            return ("لتبديل لغة الموقع: اضغط على زر تبديل اللغة في شريط التنقل العلوي. الموقع يدعم العربية (الافتراضي، من اليمين لليسار) والإنجليزية (من اليسار لليمين). جميع المحتوى والتخطيط يتكيفون تلقائياً عند التبديل.", "language");

        if (ContainsAny(question, "دفع", "اشتراك", "ريال", "about payment", "about subscription", "about pay", "about ils"))
        {
            var details = _subscriptionPaymentService.GetPaymentDetails();
            return ($"لدفع اشتراكك كصاحب قاعة: تواصل مع المدير عبر واتساب على الرقم {details.AdminWhatsAppContact} لترتيب الدفع. الاشتراك {details.SubscriptionPriceIls:F0} شيكل لكل {details.SubscriptionCycleDays} يوم لكل قاعة. بمجرد تأكيد المدير للدفع، يتم فتح ميزات إدارة قاعدتك.", "payment");
        }

        if (ContainsAny(question, "كيف استخدم", "كيف يمكنني", "مساعده", "دليل", "تعليم", "ما هو وصال", "عن وصال", "عن هذا الموقع", "about how to use", "about how do i", "about help", "about guide", "about tutorial", "about what can", "about what is wesal", "about about wesal", "about about this site"))
            return ("وصال هو منصة حجز قاعات أفراح في غزة. يمكنك تصفح القاعات المعتمدة، البحث حسب المنطقة والتاريخ، عرض تفاصيل القاعات والتوفر، حجز القاعات، تقييم وتعليق على القاعات، والتواصل مع أصحاب القاعات مباشرة. سجل مجاناً للوصول إلى ميزات الحجز والتعليق والتقييم والمراسلة.", "general");

        // What Wesal offers ("بتقدموا انتو؟", "شو خدماتكم؟"). Late on purpose:
        // a combined question ("شو بتقدمو غير الحجز؟") keeps its specific answer.
        if (ContainsAny(question, "بتقدمو", "بتقدموا", "بتوفر", "بتوفرو", "بتسوو", "بتعملو", "شو بتقدم", "شو بتقدمو", "شو خدماتكم", "ايش خدماتكم", "شو فيكم تساعدوني", "شو بتسوو", "about services", "about features", "about offer"))
            return ("وصال منصة حجز قاعات أفراح في غزة، وهاي خدماتنا: تصفح القاعات المعتمدة والبحث حسب المنطقة والتاريخ، عرض تفاصيل كل قاعة (الصور والسعة والأسعار والتوفر)، حجز القاعات ومتابعة الطلب، تقييم القاعات والتعليق عليها، والتواصل المباشر مع أصحاب القاعات. سجّل حساب مجاني عشان تستخدم الحجز والمراسلة والتقييم. شو حابب تعمل أول شي؟", "capabilities");

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
                "creator", "who created", "who made", "who built", "who developed", "who developed wesal",
                "who is the creator", "who is the developer", "who is behind", "developer of wesal",
                "made wesal", "built wesal", "developed wesal", "created wesal", "team leader",
                "create wesal", "make wesal", "build wesal",
                "mohammed shamaa", "mohammad shamaa", "shamaa"))
            return true;

        // Arabic intent (MSA + Gazan: مين عملك، احكيلي عن حالك، عرفني عليك)
        if (ContainsAny(normalized,
                "منشي", "من انشا", "المنشي", "منشيو", "صانع", "الصانع", "من صنع", "من طور",
                "المطور", "مطور", "مطورو", "من بني", "من اعد", "فريق وصال", "القايمين",
                "محمد شمعه", "محمد شما", "شمعه", "قايد الفريق",
                "مين عملك", "مين سواك", "مين صنعك", "مين صانعك", "مين مطورك", "مين انت", "شو انت",
                "احكيلي عن حالك", "احكي عن حالك", "عرفني عليك", "عرفني علي حالك", "مين مبروك", "شو مبروك"))
            return true;

        return false;
    }
}
