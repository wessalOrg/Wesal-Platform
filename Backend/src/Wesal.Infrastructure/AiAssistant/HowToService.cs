using System.Text.RegularExpressions;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.AiAssistant;

public sealed partial class HowToService : IHowToService
{
    private const string DefaultLanguage = "ar";
    private const string FallbackCategory = "general";

    private readonly ISubscriptionPaymentService _subscriptionPaymentService;
    private readonly IAiLanguageDetector _languageDetector;
    private readonly ISubscriptionPaymentIntentDetector _paymentIntentDetector;
    private readonly IGeminiService? _geminiService;

    public HowToService(
        ISubscriptionPaymentService subscriptionPaymentService,
        IAiLanguageDetector? languageDetector = null,
        ISubscriptionPaymentIntentDetector? paymentIntentDetector = null,
        IGeminiService? geminiService = null)
    {
        _subscriptionPaymentService = subscriptionPaymentService;
        _languageDetector = languageDetector ?? new AiLanguageDetector();
        _paymentIntentDetector = paymentIntentDetector ?? new SubscriptionPaymentIntentDetector();
        _geminiService = geminiService;
    }

    public async Task<HowToResponse> AskHowToAsync(
        string question,
        string? language,
        CancellationToken cancellationToken = default)
    {
        var detected = _languageDetector.Detect(question);
        var effectiveLanguage = detected ?? (string.IsNullOrWhiteSpace(language) ? DefaultLanguage : language);

        // Subscription-payment intent takes priority and uses trusted backend contact (anti-hallucination)
        if (_paymentIntentDetector.IsSubscriptionPaymentIntent(question))
        {
            var details = _subscriptionPaymentService.GetPaymentDetails();
            var paymentAnswer = effectiveLanguage == "en"
                ? $"To pay your subscription as a Hall Owner: contact the Admin via WhatsApp at {details.AdminWhatsAppContact} to arrange payment. The subscription is {details.SubscriptionPriceIls:F0} ILS per {details.SubscriptionCycleDays}-day cycle per hall. Once the Admin confirms your payment, your hall's management features unlock."
                : $"لدفع اشتراكك كصاحب قاعة: تواصل مع المدير عبر واتساب على الرقم {details.AdminWhatsAppContact} لترتيب الدفع. الاشتراك {details.SubscriptionPriceIls:F0} شيكل لكل {details.SubscriptionCycleDays} يوم لكل قاعة. بمجرد تأكيد المدير للدفع، يتم فتح ميزات إدارة قاعدتك.";
            return new HowToResponse(paymentAnswer, "payment", effectiveLanguage, DateTime.UtcNow);
        }

        // Creator-intent returns the exact, verified attribution in the user's
        // language. Handled before Gemini so the exact answer always wins,
        // independent of Gemini availability or model output.
        if (IsCreatorQuestion(question))
        {
            var creatorAnswer = effectiveLanguage == "en"
                ? "Wesal Platform was developed by the Wesal team, which includes backend and frontend developers, UX/UI designers, and a QA engineer, led by Mohammed Shamaa as the Team Leader and Backend Developer."
                : "تم تطوير منصة وصال بواسطة فريق وصال، الذي يضم مطوري نظام خلفي وواجهات أمامية، ومصممي واجهة وتجربة المستخدم، ومهندس ضمان الجودة، بقيادة محمد شمعة كقائد الفريق ومطور النظام الخلفي.";
            return new HowToResponse(creatorAnswer, "general", effectiveLanguage, DateTime.UtcNow);
        }

        // Try Gemini first when enabled and a key is configured. Any failure
        // (unavailable, error, timeout, empty/invalid response) falls through to
        // the existing deterministic keyword matching below.
        if (_geminiService?.IsAvailable == true)
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

    private static string Normalize(string input) =>
        WhitespaceRegex().Replace(input.Trim().ToLowerInvariant(), " ");

    private (string Answer, string Category) MatchEnglish(string question)
    {
        if (ContainsAny(question, "search", "find", "look for", "browse halls", "filter"))
            return ("To search for halls: go to the Browse & Search page from the navigation bar. You can filter halls by region (North Gaza, Gaza, Middle Area, South Gaza), by area, by date, by booking period, or by hall name. You can combine multiple filters. Only approved halls appear in results.", "search");

        if (ContainsAny(question, "book", "reserve", "booking", "book a hall"))
            return ("To book a hall: open the hall details page and tap the Book button. Select your preferred date, then choose one or both of the hall's daily booking periods. Submit your booking request and the hall owner will review it. You need a registered account to book.", "booking");

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

        if (ContainsAny(question, "availability", "calendar", "available", "period", "free date"))
            return ("To check availability: open a hall's details page. The interactive calendar shows each day divided into two booking periods (e.g., morning and evening). Available periods are shown in green and booked periods in red. You can select a date to see which periods are available.", "availability");

        if (ContainsAny(question, "featured", "homepage", "landing", "home"))
            return ("The homepage shows an introduction to Wesal, 6 featured approved halls, and a How It Works section. You can filter featured halls by region. Tap any hall card to see full details. The Browse More Halls button takes you to the complete halls listing.", "homepage");

        if (ContainsAny(question, "hall owner", "add hall", "manage hall", "dashboard"))
            return ("Hall Owners can add halls, manage availability calendars, handle booking requests, and respond to customer messages from their dashboard. Tap the Profile icon to access the management interface with a sidebar for managing all your halls.", "hall-owner");

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
            return ("To cancel a pending booking request: go to your bookings and select the pending request you want to cancel. Note that once a hall owner approves your request, the deposit confirmation workflow begins. Contact the hall owner through the conversation to discuss any changes.", "booking");

        return ("I can help you with how to use Wesal. You can ask about: searching for halls, booking a hall, viewing hall details, rating and commenting on halls, contacting hall owners, registration, login, language switching, and more. What would you like to know?", "general");
    }

    private (string Answer, string Category) MatchArabic(string question)
    {
        if (ContainsAny(question, "بحث", "ابحث", "أبحث", "تصفية", "about search", "about filter", "search", "find", "browse", "filter"))
            return ("للبحث عن قاعات: انتقل إلى صفحة الاستكشاف والبحث من شريط التنقل. يمكنك تصفية القاعات حسب المنطقة (شمال غزة، غزة، الوسطى، جنوب المنطقة)، المنطقة الفئة، التاريخ، فترة الحجز، أو اسم القاعة. يمكنك الجمع بين عدة مرشحات. فقط القاعات المعتمدة تظهر في النتائج.", "search");

        if (ContainsAny(question, "حجز", "احجز", "حجزت", "about booking", "about reserve", "book", "reserve", "booking"))
            return ("لحجز قاعة: افتح صفحة تفاصيل القاعة واضغط على زر حجز. اختر التاريخ المفضل، ثم اختر واحدة أو كلا فترتي الحجز اليومية للقاعة. أرسل طلب الحجز وسيراجعه صاحب القاعة. تحتاج إلى حساب مسجل للحجز.", "booking");

        if (ContainsAny(question, "تقييم", "قيّم", "نجمة", "about rating", "about rate", "about star"))
            return ("لتقييم قاعة: افتح صفحة تفاصيل القاعة وأنت مسجل الدخول كمستخدم عادي. سترى عناصر النجوم الخمسة. اضغط على عدد النجوم (1-5) لإرسال تقييمك. يمكنك تحديث تقييمك لاحقاً. أصحاب القاعات لا يمكنهم تقييم القاعات.", "ratings");

        if (ContainsAny(question, "تعليق", "اكتب تعليق", "about comment", "about review", "about feedback"))
            return ("لإضافة تعليق على قاعة: افتح صفحة تفاصيل القاعة وأنت مسجل الدخول. اختر قسم التعليقات واكتب تعليقك. أرسله وسيظهر للجميع مع اسمك وتاريخه. أصحاب القاعات لا يمكنهم كتابة تعليقات.", "comments");

        if (ContainsAny(question, "تواصل", "مراسلة", "اتصال", "صاحب القاعة", "about contact", "about message", "about owner", "about chat"))
            return ("للتواصل مع صاحب القاعة: افتح صفحة تفاصيل القاعة وأنت مسجل الدخول. اضغط على زر التواصل مع صاحب القاعة بجانب زر الحجز. سيفتح لك محادثة مع الصاحب حيث يمكنك السؤال عن الأسعار أو التفاصيل أو أي معلومات أخرى.", "messaging");

        if (ContainsAny(question, "تسجيل", "حساب", "إنشاء حساب", "about register", "about sign", "about create account", "about account"))
            return ("لإنشاء حساب: اضغط على إنشاء حساب في شريط التنقل. اختر بين المستخدم العادي (لحجز، تقييم، تعليق، مراسلة) أو صاحب القاعة (لإضافة وإدارة قاعاتك). أكمل بياناتك: الاسم الكامل، البريد الإلكتروني، رقم الهاتف، كلمة المرور.", "registration");

        if (ContainsAny(question, "دخول", "تسجيل دخول", "about login", "about sign in", "about log in"))
            return ("لتسجيل الدخول: اضغط على تسجيل الدخول في شريط التنقل. أدخل البريد الإلكتروني أو رقم الهاتف المسجل مع كلمة مرورك. سيتم توجيهك إلى الصفحة الرئيسية مع الوصول الكامل إلى ميزات حسابك.", "login");

        if (ContainsAny(question, "تفاصيل القاعة", "معلومات القاعة", "صورة", "معرض", "مرافق", "سعة", "about hall detail", "about hall info", "about photo", "about gallery", "about ameniti", "about capacity"))
            return ("لعرض تفاصيل القاعة: اضغط على أي بطاقة قاعة من نتائج البحث أو الصفحة الرئيسية. صفحة التفاصيل تضم معرض الصور، الوصف، السعة، الموقع، معلومات الاتصال، المرافق المتوفرة، الأسعار، وتقويم التوفر التفاعلي.", "hall-details");

        if (ContainsAny(question, "توفر", "تقويم", "متاح", "فترة", "about availability", "about calendar", "about available", "about period"))
            return ("للتحقق من التوفر: افتح صفحة تفاصيل القاعة. التقويم التفاعلي يظهر كل يوم مقسمًا إلى فترتي حجز (صباحاً ومساءً). الفترات المتاحة باللون الأخضر والمحجوزة باللون الأحمر. يمكنك اختيار التاريخ لترى أي فترات متاحة.", "availability");

        if (ContainsAny(question, "الصفحة الرئيسية", "مقدمة", "about featured", "about homepage", "about landing", "about home"))
            return ("الصفحة الرئيسية تُعرّف وصال وتعرض 6 قاعات معتمدة مميزة وقسم كيفية العمل. يمكنك تصفية القاعات المميزة حسب المنطقة. اضغط على بطاقة أي قاعة لعرض تفاصيلها الكاملة. زر تصفح المزيد ينقلك إلى قائمة القاعات الكاملة.", "homepage");

        if (ContainsAny(question, "صاحب القاعة", "إضافة قاعة", "إدارة قاعة", "لوحة التحكم", "about hall owner", "about add hall", "about manage hall", "about dashboard"))
            return ("أصحاب القاعات يمكنهم إضافة قاعات، إدارة تقويمات التوفر، التعامل مع طلبات الحجز، والرد على رسائل العملاء من لوحة التحكم. اضغط على أيقونة الملف الشخصي للوصول إلى واجهة الإدارة مع الشريط الجانبي لإدارة جميع قاعاتك.", "hall-owner");

        if (ContainsAny(question, "لغة", "عربية", "إنجليزية", "تبديل", "about language", "about arabic", "about english", "about toggle"))
            return ("لتبديل لغة الموقع: اضغط على زر تبديل اللغة في شريط التنقل العلوي. الموقع يدعم العربية (الافتراضي، من اليمين لليسار) والإنجليزية (من اليسار لليمين). جميع المحتوى والتخطيط يتكيفون تلقائياً عند التبديل.", "language");

        if (ContainsAny(question, "دفع", "اشتراك", "ريال", "about payment", "about subscription", "about pay", "about ils"))
        {
            var details = _subscriptionPaymentService.GetPaymentDetails();
            return ($"لدفع اشتراكك كصاحب قاعة: تواصل مع المدير عبر واتساب على الرقم {details.AdminWhatsAppContact} لترتيب الدفع. الاشتراك {details.SubscriptionPriceIls:F0} شيكل لكل {details.SubscriptionCycleDays} يوم لكل قاعة. بمجرد تأكيد المدير للدفع، يتم فتح ميزات إدارة قاعدتك.", "payment");
        }

        if (ContainsAny(question, "كيف أستخدم", "كيف يمكنني", "مساعدة", "دليل", "تعليم", "ما هو وصال", "عن وصال", "عن هذا الموقع", "about how to use", "about how do i", "about help", "about guide", "about tutorial", "about what can", "about what is wesal", "about about wesal", "about about this site"))
            return ("وصال هو منصة حجز قاعات أفراح في غزة. يمكنك تصفح القاعات المعتمدة، البحث حسب المنطقة والتاريخ، عرض تفاصيل القاعات والتوفر، حجز القاعات، تقييم وتعليق على القاعات، والتواصل مع أصحاب القاعات مباشرة. سجل مجاناً للوصول إلى ميزات الحجز والتعليق والتقييم والمراسلة.", "general");

        if (ContainsAny(question, "إلغاء", "الغاء", "about cancel", "about cancellation"))
            return ("لإلغاء طلب حجز معلق: اذهب إلى حجوزاتك واختر الطلب المعلق الذي تريد إلغائه. ملاحظة: بمجرد موافقة صاحب القاعة على طلبك، تبدأ عملية تأكيد الدفع. تواصل مع صاحب القاعة عبر المحادثة لمناقشة أي تغييرات.", "booking");

        return ("يمكنني مساعدتك في كيفية استخدام وصال. يمكنك السؤال عن: البحث عن قاعات، حجز قاعة، عرض تفاصيل القاعة، تقييم وتعليق على القاعات، التواصل مع أصحاب القاعات، التسجيل، تسجيل الدخول، تبديل اللغة، والمزيد. ماذا تريد أن تعرف؟", "general");
    }

    private static bool ContainsAny(string text, params string[] keywords)
    {
        return keywords.Any(keyword => text.Contains(keyword, StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsCreatorQuestion(string question)
    {
        // English intent
        if (ContainsAny(question,
                "creator", "who created", "who made", "who built", "who developed", "who developed wesal",
                "who is the creator", "who is the developer", "who is behind", "developer of wesal",
                "made wesal", "built wesal", "developed wesal", "created wesal", "team leader",
                "mohammed shamaa", "mohammad shamaa", "shamaa"))
            return true;

        // Arabic intent (منشئ، من أنشأ، من صنع، من طور، من بنى، صانع، مطور، قائد الفريق، محمد شمعة، فريق وصال)
        if (ContainsAny(question,
                "منشئ", "من أنشأ", "المنشئ", "منشئو", "صانع", "الصانع", "من صنع", "من طور",
                "المطور", "مطور", "مطورو", "من بنى", "من أعد", "فريق وصال", "القائمين",
                "محمد شمعة", "محمد شما", "شمعة", "قائد الفريق"))
            return true;

        return false;
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}
