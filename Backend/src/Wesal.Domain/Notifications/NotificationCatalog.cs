using Wesal.Domain.Constants;
using Wesal.Domain.Enums;

namespace Wesal.Domain.Notifications;

/// <summary>
/// One notification's Arabic and English wording plus its click-through action
/// (WESAL-TASK-13, Edit 13).
/// </summary>
/// <remarks>
/// Both languages are authored together and stored side by side, so a notification can
/// never be half-translated. The Arabic is the product-specified text verbatim; the
/// English is written to read naturally to an English speaker while keeping the same
/// meaning and the same <c>{Placeholder}</c> tokens, rather than being a word-for-word
/// transliteration of the Arabic.
/// </remarks>
public sealed record NotificationTemplate(
    string ArabicTitle,
    string EnglishTitle,
    string ArabicBody,
    string EnglishBody,
    string? ArabicActionLabel,
    string? EnglishActionLabel,
    NotificationActionTarget ActionTarget);

/// <summary>
/// The localized, ready-to-send form of one notification (WESAL-TASK-13, Edit 13).
/// </summary>
public sealed record NotificationContent(
    NotificationKind Kind,
    Language Language,
    string Title,
    string Body,
    string? ActionLabel,
    NotificationActionTarget ActionTarget,
    string? TargetId);

/// <summary>
/// Placeholder token names shared by the catalog and the call sites that fill them
/// (WESAL-TASK-13, Edit 13). Keeping them as constants means a typo is a compile error
/// rather than a notification that silently ships a literal "{Date}" to a real user.
/// </summary>
public static class NotificationTokens
{
    public const string RequesterName = "{RequesterName}";
    public const string CancellerName = "{CancellerName}";
    public const string HallName = "{HallName}";
    public const string Date = "{Date}";
    public const string StartTime = "{StartTime}";
    public const string EndTime = "{EndTime}";
    public const string Amount = "{Amount}";
    public const string Reason = "{Reason}";

    /// <summary>
    /// A whole hourly range such as "09:00 - 12:00", for the notices that describe one
    /// booking rather than a single clock time.
    /// </summary>
    public const string TimeRange = "{TimeRange}";

    /// <summary>How many days remain before a subscription cycle ends.</summary>
    public const string DaysRemaining = "{DaysRemaining}";
}

/// <summary>
/// The single source of truth for every notification's wording and action
/// (WESAL-TASK-13, Edit 13).
/// </summary>
/// <remarks>
/// <para>
/// Language selection is the recipient's stored <c>ApplicationUser.PreferredLanguage</c>
/// and happens at send time via <see cref="SupportedLanguages.ToCode"/>; it is never
/// derived from the sender's or the acting Admin's locale.
/// </para>
/// <para>
/// Actions are modelled as a target rather than a raw URL because the notification is
/// pushed over SignalR to clients with their own routing: the backend states where the
/// notification leads and the client navigates.
/// </para>
/// </remarks>
public static class NotificationCatalog
{
    public static IReadOnlyDictionary<NotificationKind, NotificationTemplate> All { get; } =
        new Dictionary<NotificationKind, NotificationTemplate>
        {
            // 1. Successful login. Informational only: no click-through action.
            [NotificationKind.WelcomeLogin] = new NotificationTemplate(
                ArabicTitle: "مرحبًا بك",
                EnglishTitle: "Welcome",
                ArabicBody: "مرحبًا بك في وصال! يمكنك الآن استكشاف قاعات الأفراح والعثور على القاعة المناسبة.",
                EnglishBody: "Welcome to Wesal! You can now explore wedding halls and find the one that suits you.",
                ArabicActionLabel: null,
                EnglishActionLabel: null,
                ActionTarget: NotificationActionTarget.None),

            // 2a. New booking request -> Hall Owner.
            [NotificationKind.BookingRequestCreatedForOwner] = new NotificationTemplate(
                ArabicTitle: "طلب حجز جديد",
                EnglishTitle: "New booking request",
                ArabicBody: NotificationTokens.RequesterName + " طلب حجز صالة " + NotificationTokens.HallName + " بتاريخ " + NotificationTokens.Date + " من " + NotificationTokens.StartTime + " إلى " + NotificationTokens.EndTime + ".",
                EnglishBody: NotificationTokens.RequesterName + " requested a booking for " + NotificationTokens.HallName + " on " + NotificationTokens.Date + ", from " + NotificationTokens.StartTime + " to " + NotificationTokens.EndTime + ".",
                ArabicActionLabel: "عرض الطلب",
                EnglishActionLabel: "View request",
                ActionTarget: NotificationActionTarget.BookingRequestDetails),

            // 2b. Booking request sent -> the seeker who sent it.
            [NotificationKind.BookingRequestSentToRequester] = new NotificationTemplate(
                ArabicTitle: "تم إرسال طلب الحجز",
                EnglishTitle: "Request Sent",
                ArabicBody: "تم إرسال طلب حجزك إلى صاحب الصالة بانتظار المراجعة.",
                EnglishBody: "Your booking request has been sent to the hall owner and is awaiting review.",
                ArabicActionLabel: "طلباتي",
                EnglishActionLabel: "My bookings",
                ActionTarget: NotificationActionTarget.MyBookings),

            // 3. Booking accepted -> requester, prompting the deposit payment notice.
            [NotificationKind.BookingAcceptedForRequester] = new NotificationTemplate(
                ArabicTitle: "تم تأكيد حجزك 🎉",
                EnglishTitle: "Your booking is confirmed 🎉",
                ArabicBody: "وافق صاحب صالة \"" + NotificationTokens.HallName + "\" على طلب حجزك بتاريخ " + NotificationTokens.Date + " من " + NotificationTokens.StartTime + " إلى " + NotificationTokens.EndTime + " وبانتظار ارسالك لاشعار دفع العربون والذي هو \"" + NotificationTokens.Amount + "\" شيكل.",
                EnglishBody: "The owner of \"" + NotificationTokens.HallName + "\" approved your booking request for " + NotificationTokens.Date + ", from " + NotificationTokens.StartTime + " to " + NotificationTokens.EndTime + ". Please send the deposit payment notice of \"" + NotificationTokens.Amount + "\" ILS to complete your booking.",
                ArabicActionLabel: "اضغط هنا لارسال اشعار الدفع الخاص بالعربون لتأكيد الحجز بشكل كامل",
                EnglishActionLabel: "Tap here to send the deposit payment notice and complete your booking",
                ActionTarget: NotificationActionTarget.Conversation),

            // 4. Booking rejected -> requester, with the owner's reason and a way to reply.
            [NotificationKind.BookingRejectedForRequester] = new NotificationTemplate(
                ArabicTitle: "تم رفض طلب الحجز الخاص بك لصالة \"" + NotificationTokens.HallName + "\"",
                EnglishTitle: "Your booking request for \"" + NotificationTokens.HallName + "\" was declined",
                ArabicBody: "لم تتم الموافقة على طلب حجزك لصالة " + NotificationTokens.HallName + ". سبب الرفض: " + NotificationTokens.Reason,
                EnglishBody: "Your booking request for " + NotificationTokens.HallName + " was not approved. Reason: " + NotificationTokens.Reason,
                ArabicActionLabel: "انقر هنا للتواصل مع صاحب القاعة",
                EnglishActionLabel: "Tap here to contact the hall owner",
                ActionTarget: NotificationActionTarget.Conversation),

            // 5. Seeker cancelled -> Hall Owner.
            [NotificationKind.BookingCancelledForOwner] = new NotificationTemplate(
                ArabicTitle: "تم إلغاء الحجز",
                EnglishTitle: "Booking Cancelled",
                ArabicBody: "قام \"" + NotificationTokens.CancellerName + "\" بإلغاء حجزه بتاريخ " + NotificationTokens.Date + " من " + NotificationTokens.StartTime + " إلى " + NotificationTokens.EndTime + ".",
                EnglishBody: "\"" + NotificationTokens.CancellerName + "\" cancelled their booking for " + NotificationTokens.Date + ", from " + NotificationTokens.StartTime + " to " + NotificationTokens.EndTime + ".",
                ArabicActionLabel: "عرض الطلبات",
                EnglishActionLabel: "View requests",
                ActionTarget: NotificationActionTarget.OwnerBookingRequests),

            // 6. Hall submitted for review -> its owner.
            [NotificationKind.HallCreatedForOwner] = new NotificationTemplate(
                ArabicTitle: "تم إنشاء الصالة",
                EnglishTitle: "Hall Created",
                ArabicBody: "تم انشاء صالة \"" + NotificationTokens.HallName + "\" بنجاح, بانتظار المراجعة و الاعتمادها",
                EnglishBody: "Your hall \"" + NotificationTokens.HallName + "\" was created successfully and is awaiting review and approval.",
                ArabicActionLabel: "قاعاتي",
                EnglishActionLabel: "My halls",
                ActionTarget: NotificationActionTarget.MyHalls),

            // 7. Hall approved by an Admin -> its owner, prompting the subscription payment.
            [NotificationKind.HallApprovedForOwner] = new NotificationTemplate(
                ArabicTitle: "تم اعتماد القاعة",
                EnglishTitle: "Hall approved",
                ArabicBody: "تم اعتماد قاعتك بنجاح وبانتظار اشعار دفع اشتراك منصة وصال. يمكن رفع اشعار الدفع بالنقر على هذا الاشعار او من خلال النقر على \"قاعاتي\" لتصل الى اشعار الدفع والنقر على ارفاق اشعار الدفع.",
                EnglishBody: "Your hall was approved successfully and is awaiting the Wesal platform subscription payment notice. You can upload the payment notice by tapping this notification, or from \"My halls\", where you will find the payment notice and can attach your payment proof.",
                ArabicActionLabel: "قاعاتي",
                EnglishActionLabel: "My halls",
                ActionTarget: NotificationActionTarget.MyHalls),

            // 8. New hall awaiting review -> Admins.
            [NotificationKind.HallSubmittedForAdmin] = new NotificationTemplate(
                ArabicTitle: "طلب صالة",
                EnglishTitle: "Hall request",
                ArabicBody: "قام \"" + NotificationTokens.HallName + "\" بإرسال صالة للمراجعة.",
                EnglishBody: "\"" + NotificationTokens.HallName + "\" submitted a hall for review.",
                ArabicActionLabel: "عرض الطلبات",
                EnglishActionLabel: "View requests",
                ActionTarget: NotificationActionTarget.AdminHallRequests),

            // 9. Hall rejected by an Admin -> its owner, with the reason and a way to reply.
            [NotificationKind.HallRejectedForOwner] = new NotificationTemplate(
                ArabicTitle: "تم رفض القاعة",
                EnglishTitle: "Hall rejected",
                ArabicBody: "تم رفض قاعتك من قِبل الدعم الفني الخاص بوصال للسبب التالي: \"" + NotificationTokens.Reason + "\"",
                EnglishBody: "Your hall was rejected by the Wesal technical support for the following reason: \"" + NotificationTokens.Reason + "\"",
                ArabicActionLabel: "التواصل مع الدعم",
                EnglishActionLabel: "Contact support",
                ActionTarget: NotificationActionTarget.Conversation),

            // 10. The requester cancelled their own booking. This notice exists on the durable
            // thread only, so it is rendered in the REQUESTER's own language: the thread record
            // and the thread they are looking at can then never be in two languages at once.
            [NotificationKind.BookingCancelledForRequester] = new NotificationTemplate(
                ArabicTitle: "تم إلغاء الحجز",
                EnglishTitle: "Booking Cancelled",
                ArabicBody: "تم إلغاء طلب حجزك في قاعة \"" + NotificationTokens.HallName + "\" بتاريخ " + NotificationTokens.Date + " من " + NotificationTokens.TimeRange + "، وذلك بناءً على طلبك.",
                EnglishBody: "Your booking request for \"" + NotificationTokens.HallName + "\" on " + NotificationTokens.Date + " for " + NotificationTokens.TimeRange + " was cancelled at your request.",
                ArabicActionLabel: "طلباتي",
                EnglishActionLabel: "My bookings",
                ActionTarget: NotificationActionTarget.MyBookings),

            // 11. An Admin confirmed the owner's subscription payment.
            //
            // WESAL-TASK-13 follow-up: the wording used to tell the owner the hall had been
            // "published to interested people". The publish step was removed with the legacy
            // two-period model, so the sentence described something the platform no longer
            // does. It is not repeated here, and the test pins that it stays out.
            [NotificationKind.SubscriptionPaidForOwner] = new NotificationTemplate(
                ArabicTitle: "تم تأكيد الدفع",
                EnglishTitle: "Payment confirmed",
                ArabicBody: "تم تأكيد دفع اشتراك قاعتك \"" + NotificationTokens.HallName + "\"، وتم تفعيلها. اشتراكك ساري حتى " + NotificationTokens.Date + ".",
                EnglishBody: "Your subscription payment for \"" + NotificationTokens.HallName + "\" has been confirmed and your hall is now active. Your subscription is valid until " + NotificationTokens.Date + ".",
                ArabicActionLabel: "قاعاتي",
                EnglishActionLabel: "My halls",
                ActionTarget: NotificationActionTarget.MyHalls),

            // 12. The owner's subscription cycle ends soon.
            [NotificationKind.SubscriptionExpiringForOwner] = new NotificationTemplate(
                ArabicTitle: "اشتراكك على وشك الانتهاء",
                EnglishTitle: "Subscription expiring",
                ArabicBody: "ينتهي اشتراكك في قاعة \"" + NotificationTokens.HallName + "\" بتاريخ " + NotificationTokens.Date + " (متبقٍ " + NotificationTokens.DaysRemaining + " يومًا). يرجى تجديد اشتراكك للحفاظ على صلاحية إدارة هذه القاعة.",
                EnglishBody: "Your subscription for \"" + NotificationTokens.HallName + "\" ends on " + NotificationTokens.Date + " (" + NotificationTokens.DaysRemaining + " days remaining). Please renew your subscription to keep management access to this hall active.",
                ArabicActionLabel: "قاعاتي",
                EnglishActionLabel: "My halls",
                ActionTarget: NotificationActionTarget.MyHalls),

            // 13. The owner's subscription cycle ended and the hall was automatically restricted.
            [NotificationKind.SubscriptionExpiredForOwner] = new NotificationTemplate(
                ArabicTitle: "انتهى اشتراكك",
                EnglishTitle: "Subscription ended",
                ArabicBody: "انتهى اشتراكك في قاعة \"" + NotificationTokens.HallName + "\" دون تجديد مؤكَّد. تم تقييد الوصول إلى هذه القاعة تلقائيًا. يرجى تجديد اشتراكك لإعادة تفعيل القاعة.",
                EnglishBody: "Your subscription for \"" + NotificationTokens.HallName + "\" has ended without a confirmed renewal. Access to this hall has been automatically restricted. Please renew your subscription to reactivate the hall.",
                ArabicActionLabel: "قاعاتي",
                EnglishActionLabel: "My halls",
                ActionTarget: NotificationActionTarget.MyHalls)
        };

    public static NotificationTemplate Get(NotificationKind kind)
        => All.TryGetValue(kind, out var template)
            ? template
            : throw new KeyNotFoundException($"No notification template is registered for '{kind}'.");

    /// <summary>
    /// Renders one notification in the given language, substituting the caller's values for
    /// the template's placeholders.
    /// </summary>
    /// <remarks>
    /// Substitution is plain textual replacement rather than <c>string.Format</c> so that a
    /// value containing a brace, or a currency amount formatted by the caller, can never
    /// throw a <see cref="FormatException"/> in front of a real user at send time. A token
    /// with no supplied value is left as-is rather than blanked, so a gap is visible
    /// instead of silently producing a sentence with a hole in it.
    /// </remarks>
    public static NotificationContent Render(
        NotificationKind kind,
        Language language,
        IReadOnlyDictionary<string, string?>? values = null,
        string? targetId = null)
    {
        var template = Get(kind);

        var isArabic = language != Language.English;

        var title = isArabic ? template.ArabicTitle : template.EnglishTitle;
        var body = isArabic ? template.ArabicBody : template.EnglishBody;
        var actionLabel = isArabic ? template.ArabicActionLabel : template.EnglishActionLabel;

        title = Substitute(title, values);
        body = Substitute(body, values);

        return new NotificationContent(
            kind,
            language,
            title,
            body,
            template.ActionTarget == NotificationActionTarget.None ? null : actionLabel,
            template.ActionTarget,
            targetId);
    }

    private static string Substitute(string text, IReadOnlyDictionary<string, string?>? values)
    {
        if (values is null || values.Count == 0)
        {
            return text;
        }

        var result = text;

        foreach (var (token, value) in values)
        {
            if (!string.IsNullOrEmpty(token) && value is not null)
            {
                result = result.Replace(token, value, StringComparison.Ordinal);
            }
        }

        return result;
    }
}
