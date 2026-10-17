using System.Text.RegularExpressions;

namespace Wesal.Application.Ai.Navigation;

/// <summary>
/// One valid Wesal destination. <see cref="Path"/> is the canonical frontend route
/// ({id} marks the single dynamic segment). Pages with
/// <see cref="AssistantNavigable"/> = false are recognised for page-context purposes
/// only (for example admin screens) and are never offered as assistant actions.
/// </summary>
public sealed record WesalPage(
    string Key,
    string Path,
    string LabelAr,
    string LabelEn,
    bool RequiresAuth,
    bool AssistantNavigable,
    IReadOnlyList<string> NounsAr,
    IReadOnlyList<string> NounsEn)
{
    public bool IsDynamic => Path.Contains("{id}", StringComparison.Ordinal);
}

/// <summary>
/// The single backend-authoritative allow-list of Wesal destinations. Every route
/// here must correspond to a real <c>Frontend/src/app/**/page.tsx</c>; the
/// <c>WesalNavigationRegistryShould</c> tests scan the frontend tree to enforce that.
/// Models and classifiers may only ever choose a <see cref="WesalPage.Key"/>; the
/// href is resolved here, so an invented or external URL can never reach a client.
/// To make a new page reachable by the assistant (for example a future photography
/// page), add exactly one entry here after the route exists.
/// </summary>
public static class WesalNavigationRegistry
{
    public const string Home = "home";
    public const string About = "about";
    public const string Photographers = "photographers";
    public const string EventPlanners = "event_planners";
    public const string Halls = "halls";
    public const string HallDetails = "hall_details";
    public const string Faq = "faq";
    public const string Help = "help";
    public const string Login = "login";
    public const string Register = "register";
    public const string ForgotPassword = "forgot_password";
    public const string ResetPassword = "reset_password";
    public const string Profile = "profile";
    public const string ProfileAccount = "profile_account";
    public const string Bookings = "bookings";
    public const string Favorites = "favorites";
    public const string Messages = "messages";
    public const string Notifications = "notifications";
    public const string Settings = "settings";
    public const string OwnerDashboard = "owner_dashboard";
    public const string OwnerHalls = "owner_halls";
    public const string OwnerAddHall = "owner_add_hall";
    public const string OwnerCalendar = "owner_calendar";
    public const string OwnerBookings = "owner_bookings";
    public const string OwnerMessages = "owner_messages";
    public const string OwnerProfile = "owner_profile";
    public const string OwnerHallManage = "owner_hall_manage";
    public const string OwnerHallNotifications = "owner_hall_notifications";
    public const string Conversation = "conversation";
    public const string Admin = "admin";
    public const string AdminHallReview = "admin_hall_review";
    public const string AdminHelpQuestions = "admin_help_questions";
    public const string AdminMessages = "admin_messages";
    public const string AdminRejectedHalls = "admin_rejected_halls";
    public const string AdminSubscriptions = "admin_subscriptions";

    private const int MaxPathLength = 200;

    private static readonly IReadOnlyList<WesalPage> AllPages =
    [
        Page(Home, "/", "الرئيسية", "Home", false, true,
            ["الصفحه الرئيسيه", "الرئيسيه", "الصفحه الاولى"], ["home", "homepage", "home page", "main page"]),
        Page(About, "/about", "من نحن", "About Wesal", false, true,
            ["من نحن", "عن وصال", "صفحه عن وصال"], ["about", "about us", "about wesal"]),
        Page(Photographers, "/photographers", "المصورين", "Photographers", false, true,
            ["المصورين", "المصور", "صفحه المصورين"], ["photographer", "photographers", "photography page"]),
        Page(EventPlanners, "/event-planners", "منسقي المناسبات", "Event planners", false, true,
            ["منسقي المناسبات", "منسقين", "منسق", "صفحه منسقي المناسبات"], ["event planners", "planner", "planners", "event planner page"]),
        Page(Halls, "/halls", "استعرض الصالات", "Browse halls", false, true,
            ["الصالات", "صالات", "القاعات", "قاعات", "صاله", "قاعه", "صفحه الصالات", "صفحه القاعات"],
            ["halls", "hall", "wedding halls", "venues", "hall list", "halls page"]),
        Page(HallDetails, "/halls/{id}", "تفاصيل القاعة", "Hall details", false, true, [], []),
        Page(Faq, "/faq", "الأسئلة الشائعة", "FAQ", false, true,
            ["الاسئله الشائعه", "اسئله شائعه", "الاسئله المتكرره", "اسئله متكرره"],
            ["faq", "faqs", "frequently asked questions", "frequently asked"]),
        Page(Help, "/help", "مركز المساعدة", "Help center", false, true,
            ["المساعده", "مساعده", "مركز المساعده", "صفحه المساعده"],
            ["help", "help center", "help page"]),
        Page(Login, "/login", "تسجيل الدخول", "Log in", false, true,
            ["تسجيل الدخول", "تسجيل دخول", "دخول", "صفحه الدخول"],
            ["login", "log in", "sign in", "signin"]),
        Page(Register, "/register", "إنشاء حساب", "Create account", false, true,
            ["انشاء حساب", "حساب جديد", "تسجيل حساب جديد", "تسجيل جديد", "تسجيل حساب"],
            ["register", "sign up", "signup", "create account", "create an account"]),
        Page(ForgotPassword, "/forgot-password", "نسيت كلمة المرور", "Forgot password", false, true,
            ["نسيت كلمه المرور", "استرجاع كلمه المرور", "استعاده كلمه المرور"],
            ["forgot password", "reset password", "forgot my password"]),
        Page(ResetPassword, "/reset-password", "إعادة تعيين كلمة المرور", "Reset password", false, false, [], []),
        Page(Profile, "/profile", "حسابي", "My profile", true, true,
            ["حسابي", "ملفي", "ملفي الشخصي", "الملف الشخصي"], ["profile", "my profile", "my account"]),
        Page(ProfileAccount, "/profile/account", "بيانات الحساب", "Account details", true, true,
            ["بيانات الحساب", "بياناتي", "معلومات حسابي"], ["account details", "account settings"]),
        Page(Bookings, "/profile/bookings", "حجوزاتي", "My bookings", true, true,
            ["حجوزاتي", "طلبات حجزي", "طلبات الحجز"], ["my bookings", "bookings"]),
        Page(Favorites, "/profile/favorites", "المفضلة", "Favorites", true, true,
            ["المفضله", "مفضلتي", "الصالات المفضله"], ["favorites", "favourites", "my favorites"]),
        Page(Messages, "/profile/messages", "رسائلي", "My messages", true, true,
            ["رسائلي", "الرسائل", "محادثاتي"], ["my messages", "messages", "inbox"]),
        Page(Notifications, "/profile/notifications", "الإشعارات", "Notifications", true, true,
            ["الاشعارات", "اشعاراتي"], ["notifications", "my notifications"]),
        Page(Settings, "/profile/settings", "الإعدادات", "Settings", true, true,
            ["الاعدادات", "اعداداتي"], ["settings", "my settings"]),
        Page(OwnerDashboard, "/owner", "لوحة صاحب القاعة", "Owner dashboard", true, true,
            ["لوحه التحكم", "لوحه صاحب القاعه", "لوحه الاداره"], ["dashboard", "owner dashboard"]),
        Page(OwnerHalls, "/owner/halls", "قاعاتي", "My halls", true, true,
            ["قاعاتي", "صالاتي"], ["my halls", "owner halls"]),
        Page(OwnerAddHall, "/owner/halls/add", "إضافة قاعة", "Add a hall", true, true,
            ["اضافه قاعه", "اضافه صاله", "اضافه قاعه جديده"], ["add hall", "add a hall", "register a hall"]),
        Page(OwnerCalendar, "/owner/calendar", "تقويم الحجوزات", "Bookings calendar", true, true,
            ["التقويم", "تقويم الحجوزات"], ["calendar", "bookings calendar"]),
        Page(OwnerBookings, "/owner/bookings", "طلبات الحجز", "Booking requests", true, true,
            ["طلبات الحجز الوارده"], ["booking requests"]),
        Page(OwnerMessages, "/owner/messages", "رسائل القاعات", "Owner messages", true, true,
            ["رسائل القاعات", "رسائل الزبائن"], ["owner messages"]),
        Page(OwnerProfile, "/owner/profile", "حساب صاحب القاعة", "Owner profile", true, false, [], []),
        Page(OwnerHallManage, "/owner/halls/{id}", "إدارة القاعة", "Manage hall", true, false, [], []),
        Page(OwnerHallNotifications, "/owner/halls/{id}/notifications", "إشعارات القاعة", "Hall notifications", true, false, [], []),
        Page(Conversation, "/messages/{id}", "المحادثة", "Conversation", true, false, [], []),
        Page(Admin, "/admin", "لوحة الإدارة", "Admin dashboard", true, false, [], []),
        Page(AdminHallReview, "/admin/halls/{id}", "مراجعة قاعة", "Hall review", true, false, [], []),
        Page(AdminHelpQuestions, "/admin/help-questions", "أسئلة المساعدة", "Help questions", true, false, [], []),
        Page(AdminMessages, "/admin/messages", "رسائل الإدارة", "Admin messages", true, false, [], []),
        Page(AdminRejectedHalls, "/admin/rejected-halls", "القاعات المرفوضة", "Rejected halls", true, false, [], []),
        Page(AdminSubscriptions, "/admin/subscriptions", "الاشتراكات", "Subscriptions", true, false, [], [])
    ];

    private static readonly Regex GuidSegment = new(
        @"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
        RegexOptions.Compiled);

    public static IReadOnlyList<WesalPage> Pages => AllPages;

    /// <summary>Static (non-dynamic) pages the assistant is allowed to send users to.</summary>
    public static IEnumerable<WesalPage> NavigablePages
        => AllPages.Where(p => p.AssistantNavigable && !p.IsDynamic);

    public static WesalPage? Find(string? key)
        => string.IsNullOrWhiteSpace(key)
            ? null
            : AllPages.FirstOrDefault(p => string.Equals(p.Key, key.Trim(), StringComparison.Ordinal));

    /// <summary>
    /// Resolves a page key (plus the entity id for dynamic pages) to its trusted
    /// href. Returns null for unknown keys, non-navigable pages and dynamic pages
    /// without a valid id. This is the only place an assistant href is created.
    /// </summary>
    public static string? ResolveHref(string? pageKey, Guid? entityId = null)
    {
        var page = Find(pageKey);
        if (page is null || !page.AssistantNavigable)
        {
            return null;
        }

        if (!page.IsDynamic)
        {
            return page.Path;
        }

        return entityId is { } id && id != Guid.Empty
            ? page.Path.Replace("{id}", id.ToString("D"), StringComparison.Ordinal)
            : null;
    }

    /// <summary>
    /// Validates an untrusted client pathname against the registry. Rejects anything
    /// that is not a clean same-app path (schemes, protocol-relative, backslashes,
    /// traversal, control characters, over-long values) and any route that does not
    /// match a registered pattern. Query strings and fragments are ignored.
    /// </summary>
    public static bool TryMatchPath(string? pathname, out WesalPage? page, out Guid? entityId)
    {
        page = null;
        entityId = null;

        if (string.IsNullOrWhiteSpace(pathname))
        {
            return false;
        }

        var path = pathname.Trim();
        var cut = path.IndexOfAny(['?', '#']);
        if (cut >= 0)
        {
            path = path[..cut];
        }

        if (path.Length == 0
            || path.Length > MaxPathLength
            || path[0] != '/'
            || path.StartsWith("//", StringComparison.Ordinal)
            || path.Contains('\\')
            || path.Contains("..", StringComparison.Ordinal)
            || path.Any(char.IsControl)
            || path.Contains("://", StringComparison.Ordinal))
        {
            return false;
        }

        if (path.Length > 1)
        {
            path = path.TrimEnd('/');
        }

        foreach (var candidate in AllPages)
        {
            if (!candidate.IsDynamic)
            {
                if (string.Equals(candidate.Path, path, StringComparison.Ordinal))
                {
                    page = candidate;
                    return true;
                }

                continue;
            }

            var pattern = candidate.Path.Split('/');
            var actual = path.Split('/');
            if (pattern.Length != actual.Length)
            {
                continue;
            }

            string? idSegment = null;
            var matches = true;
            for (var i = 0; i < pattern.Length; i++)
            {
                if (pattern[i] == "{id}")
                {
                    idSegment = actual[i];
                    continue;
                }

                if (!string.Equals(pattern[i], actual[i], StringComparison.Ordinal))
                {
                    matches = false;
                    break;
                }
            }

            if (!matches || idSegment is null)
            {
                continue;
            }

            page = candidate;
            // Only hall-details carries a trusted GUID entity; other dynamic ids
            // (conversation ids, owner/admin hall ids) are never surfaced.
            if (candidate.Key == HallDetails && GuidSegment.IsMatch(idSegment) && Guid.TryParse(idSegment, out var parsed))
            {
                entityId = parsed;
            }

            return true;
        }

        return false;
    }

    private static WesalPage Page(
        string key,
        string path,
        string labelAr,
        string labelEn,
        bool requiresAuth,
        bool navigable,
        string[] nounsAr,
        string[] nounsEn)
        => new(
            key,
            path,
            labelAr,
            labelEn,
            requiresAuth,
            navigable,
            nounsAr.Select(AiText.Normalize).ToList(),
            nounsEn.Select(AiText.Normalize).ToList());
}
