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
    public const string SenderName = "{SenderName}";
    public const string MessagePreview = "{MessagePreview}";
    public const string CommenterName = "{CommenterName}";
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
                ActionTarget: NotificationActionTarget.MyHalls),

            // 14. An Event Coordinator's setup submission was received and awaits review.
            [NotificationKind.CoordinatorSetupReceivedForCoordinator] = new NotificationTemplate(
                ArabicTitle: "تم استلام طلبك",
                EnglishTitle: "Registration request received",
                ArabicBody: "وصل طلب التسجيل بنجاح، وسيتم مراجعته من الإدارة.",
                EnglishBody: "Your Event Coordinator setup data has been received successfully. Your request is now under administrative review and you will be notified of the outcome soon.",
                ArabicActionLabel: null,
                EnglishActionLabel: null,
                ActionTarget: NotificationActionTarget.None),

            // 15. A Photographer's setup submission was received and awaits review. The
            // body states what the waiting period already allows (browsing, booking, and
            // messaging the administration), matching the enforced Task 4 permissions.
            [NotificationKind.PhotographerSetupReceivedForPhotographer] = new NotificationTemplate(
                ArabicTitle: "تم استلام طلب التسجيل",
                EnglishTitle: "Registration request received",
                ArabicBody: "تم إرسال طلبك بنجاح. ستقوم إدارة وصال بمراجعته، ويمكنك تصفح القاعات وحجزها ومراسلة الإدارة خلال فترة الانتظار.",
                EnglishBody: "Your request was sent successfully. Wesal administration will review it, and during the waiting period you can browse and book halls and message the administration.",
                ArabicActionLabel: null,
                EnglishActionLabel: null,
                ActionTarget: NotificationActionTarget.None),

            // 17. An Admin approved an Event Coordinator's account request (Task 5, 15.1).
            // Purely informational: approval itself opens nothing, so there is no action.
            [NotificationKind.CoordinatorApprovedForCoordinator] = new NotificationTemplate(
                ArabicTitle: "مبروك! تمت الموافقة على حسابك",
                EnglishTitle: "Congratulations! Your account has been approved",
                ArabicBody: "أصبح بإمكانك إنشاء منشوراتك وعروضك وإدارة ملفك التجاري.",
                EnglishBody: "You can now create your posts and offers and manage your business profile.",
                ArabicActionLabel: null,
                EnglishActionLabel: null,
                ActionTarget: NotificationActionTarget.None),

            // 18. An Admin rejected an Event Coordinator's account request (Task 5, 5.5 +
            // 15.1). The reason is part of the notification body per the requirement, and
            // the action opens the Admin conversation where the same reason was posted as
            // a message, so the coordinator can ask questions about it.
            [NotificationKind.CoordinatorRejectedForCoordinator] = new NotificationTemplate(
                ArabicTitle: "تعذر قبول طلبك",
                EnglishTitle: "Your request could not be accepted",
                ArabicBody: "تم رفض طلبك للسبب الاتي : \"" + NotificationTokens.Reason + "\"",
                EnglishBody: "Your request was rejected for the following reason: \"" + NotificationTokens.Reason + "\"",
                ArabicActionLabel: "فتح المحادثة مع الإدارة",
                EnglishActionLabel: "Open the conversation with administration",
                ActionTarget: NotificationActionTarget.Conversation),

            // 19. An Admin approved a Photographer's account request (Task 6, 15.6).
            [NotificationKind.PhotographerApprovedForPhotographer] = new NotificationTemplate(
                ArabicTitle: "تمت الموافقة على حسابك!",
                EnglishTitle: "Your account has been approved!",
                ArabicBody: "أصبح ملفك المهني متاحًا وفق إعدادات النشر، ويمكنك الآن إضافة أعمالك ومنشوراتك وعروضك.",
                EnglishBody: "Your professional profile is now available according to the publishing settings, and you can now add your works, posts and offers.",
                ArabicActionLabel: null,
                EnglishActionLabel: null,
                ActionTarget: NotificationActionTarget.None),

            // 20. An Admin asked a Photographer to edit their submission (Task 6, 6.5 +
            // 15.6). The notification body points at the conversation rather than
            // repeating the notes, because the requirement states the details live in the
            // conversation; TargetId carries that thread's id.
            [NotificationKind.PhotographerNeedsChangesForPhotographer] = new NotificationTemplate(
                ArabicTitle: "طلبك يحتاج إلى تعديل",
                EnglishTitle: "Your request needs editing",
                ArabicBody: "توجد ملاحظات من الإدارة على بياناتك أو مستنداتك. افتح المحادثة لمعرفة التفاصيل، ثم عدّل المطلوب وأعد تقديم الطلب.",
                EnglishBody: "There are notes from the administration on your data or documents. Open the conversation to see the details, then edit what is required and resubmit the request.",
                ArabicActionLabel: "فتح المحادثة مع الإدارة",
                EnglishActionLabel: "Open the conversation with administration",
                ActionTarget: NotificationActionTarget.Conversation),

            // 21. An Admin rejected a Photographer's account request (Task 6, 6.5 + 15.6).
            // The requirement's body cell describes behavior ("shows the rejection reason
            // written by the admin") rather than literal wording, so the body carries the
            // reason the same way the coordinator rejection does, and the action opens the
            // Admin conversation the reason was posted into.
            [NotificationKind.PhotographerRejectedForPhotographer] = new NotificationTemplate(
                ArabicTitle: "تم رفض طلبك",
                EnglishTitle: "Your request was rejected",
                ArabicBody: "تم رفض طلبك للسبب الاتي : \"" + NotificationTokens.Reason + "\"",
                EnglishBody: "Your request was rejected for the following reason: \"" + NotificationTokens.Reason + "\"",
                ArabicActionLabel: "فتح المحادثة مع الإدارة",
                EnglishActionLabel: "Open the conversation with administration",
                ActionTarget: NotificationActionTarget.Conversation),

            [NotificationKind.ProfessionalOfferPublishedForCoordinator] = new NotificationTemplate(
                ArabicTitle: "تم نشر العرض بنجاح",
                EnglishTitle: "Your offer was published successfully",
                ArabicBody: "أصبح عرضك متاحًا للمستخدمين.",
                EnglishBody: "Your offer is now available to users.",
                ArabicActionLabel: "عرض العرض",
                EnglishActionLabel: "View offer",
                ActionTarget: NotificationActionTarget.Offer),

            [NotificationKind.ProfessionalOfferPublishedForPhotographer] = new NotificationTemplate(
                ArabicTitle: "تم نشر عرضك بنجاح",
                EnglishTitle: "Your offer was published successfully",
                ArabicBody: "عرض تصوير المناسبات أصبح متاحًا للمستخدمين.",
                EnglishBody: "The event photography offer is now available to users.",
                ArabicActionLabel: "عرض العرض",
                EnglishActionLabel: "View offer",
                ActionTarget: NotificationActionTarget.Offer),

            [NotificationKind.ProfessionalOfferEditsSaved] = new NotificationTemplate(
                ArabicTitle: "تم حفظ التعديلات على العرض",
                EnglishTitle: "Offer edits were saved",
                ArabicBody: "تم تحديث العرض ونشر النسخة المعدلة للجمهور.",
                EnglishBody: "The offer was updated and the edited version was published.",
                ArabicActionLabel: "عرض العرض",
                EnglishActionLabel: "View offer",
                ActionTarget: NotificationActionTarget.Offer),

            [NotificationKind.ProfessionalOfferReminder24Hours] = new NotificationTemplate(
                ArabicTitle: "بقي 24 ساعة على انتهاء العرض",
                EnglishTitle: "24 hours remain until the offer ends",
                ArabicBody: "يمكنك مراجعة العرض أو إيقافه قبل موعد انتهائه.",
                EnglishBody: "You can review the offer or stop it before it ends.",
                ArabicActionLabel: "عرض العرض",
                EnglishActionLabel: "View offer",
                ActionTarget: NotificationActionTarget.Offer),

            [NotificationKind.ProfessionalOfferEndedForCoordinator] = new NotificationTemplate(
                ArabicTitle: "انتهى العرض وأصبح غير ظاهر للجمهور",
                EnglishTitle: "Your offer ended and is no longer public",
                ArabicBody: "لم يعد العرض ظاهرًا ضمن العروض الفعالة للمستخدمين.",
                EnglishBody: "The offer is no longer shown among active offers.",
                ArabicActionLabel: "عرض العرض",
                EnglishActionLabel: "View offer",
                ActionTarget: NotificationActionTarget.Offer),

            [NotificationKind.ProfessionalOfferEndedForPhotographer] = new NotificationTemplate(
                ArabicTitle: "انتهى عرضك",
                EnglishTitle: "Your offer has ended",
                ArabicBody: "لم يعد العرض ظاهرًا ضمن العروض الفعالة للمستخدمين.",
                EnglishBody: "The offer is no longer shown among active offers.",
                ArabicActionLabel: "عرض العرض",
                EnglishActionLabel: "View offer",
                ActionTarget: NotificationActionTarget.Offer),

            [NotificationKind.ProfessionalOfferStopped] = new NotificationTemplate(
                ArabicTitle: "تم إيقاف العرض يدويًا",
                EnglishTitle: "The offer was stopped manually",
                ArabicBody: "أصبح العرض غير ظاهر للمستخدمين.",
                EnglishBody: "The offer is no longer visible to users.",
                ArabicActionLabel: "عرض العرض",
                EnglishActionLabel: "View offer",
                ActionTarget: NotificationActionTarget.Offer),

            [NotificationKind.PostEditsSaved] = new NotificationTemplate(
                ArabicTitle: "تم حفظ تعديلات المنشور",
                EnglishTitle: "Post edits were saved",
                ArabicBody: "تم تحديث المنشور ونشر النسخة المعدلة للجمهور.",
                EnglishBody: "The post was updated and the edited version was published to the public.",
                ArabicActionLabel: "عرض المنشور",
                EnglishActionLabel: "View post",
                ActionTarget: NotificationActionTarget.Post),

            [NotificationKind.PostCommentedForCoordinator] = new NotificationTemplate(
                "تعليق جديد", "New comment", NotificationTokens.CommenterName + " علّق على منشورك", NotificationTokens.CommenterName + " commented on your post",
                "عرض المنشور", "View post", NotificationActionTarget.Post),

            [NotificationKind.PostCommentedForPhotographer] = new NotificationTemplate(
                "تعليق جديد", "New comment", NotificationTokens.CommenterName + " علّق على أحد أعمالك", NotificationTokens.CommenterName + " commented on one of your works",
                "عرض المنشور", "View post", NotificationActionTarget.Post),

            [NotificationKind.PostCommentReplyForOwner] = new NotificationTemplate(
                "رد على تعليقك", "Reply to your comment", NotificationTokens.CommenterName + " رد على تعليقك", NotificationTokens.CommenterName + " replied to your comment",
                "عرض المنشور", "View post", NotificationActionTarget.Post),

            [NotificationKind.PostCommentReplyOnOwnerPost] = new NotificationTemplate(
                "رد جديد على منشورك", "New reply on your post", NotificationTokens.CommenterName + " رد على تعليق في منشورك", NotificationTokens.CommenterName + " replied to a comment on your post",
                "عرض المنشور", "View post", NotificationActionTarget.Post),

            [NotificationKind.NewMessage] = new NotificationTemplate(
                "رسالة جديدة من " + NotificationTokens.SenderName, "New message from " + NotificationTokens.SenderName,
                NotificationTokens.MessagePreview, NotificationTokens.MessagePreview, "فتح المحادثة", "Open conversation", NotificationActionTarget.Conversation),

            [NotificationKind.AdminMessageForCoordinator] = new NotificationTemplate(
                "لديك رسالة من إدارة وصال", "You have a message from Wesal administration",
                "يمكنك فتح المحادثة ومتابعة أي ملاحظات تتعلق بطلبك.", "Open the conversation and follow up on any notes related to your request.",
                "فتح المحادثة", "Open conversation", NotificationActionTarget.Conversation),

            [NotificationKind.AdminMessageForPhotographer] = new NotificationTemplate(
                "لديك رسالة من إدارة وصال", "You have a message from Wesal administration",
                "يمكنك فتح المحادثة ومتابعة أي ملاحظات تتعلق بطلبك.", "Open the conversation and follow up on any notes related to your request.",
                "فتح المحادثة", "Open conversation", NotificationActionTarget.Conversation)
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
