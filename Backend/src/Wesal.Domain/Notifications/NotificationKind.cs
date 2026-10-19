namespace Wesal.Domain.Notifications;

/// <summary>
/// Every user-facing notification trigger on the platform (WESAL-TASK-13, Edit 13).
///
/// The kind is the stable identity of a notification: it selects the localized
/// Arabic/English template pair and the click-through action, and is what tests pin.
/// Adding a trigger means adding a kind plus its catalog entry.
/// </summary>
public enum NotificationKind
{
    /// <summary>Seeker (or any account) signs in successfully. Informational only.</summary>
    WelcomeLogin = 1,

    /// <summary>A seeker created a booking request; the Hall Owner is told.</summary>
    BookingRequestCreatedForOwner = 2,

    /// <summary>The seeker is told their booking request was sent for review.</summary>
    BookingRequestSentToRequester = 3,

    /// <summary>The Hall Owner accepted; the requester is told to pay the deposit.</summary>
    BookingAcceptedForRequester = 4,

    /// <summary>The Hall Owner declined; the requester is told with the reason.</summary>
    BookingRejectedForRequester = 5,

    /// <summary>A seeker cancelled; the Hall Owner is told.</summary>
    BookingCancelledForOwner = 6,

    /// <summary>The Hall Owner's hall was submitted and is awaiting review.</summary>
    HallCreatedForOwner = 7,

    /// <summary>An Admin approved the hall; the owner is told to pay the subscription.</summary>
    HallApprovedForOwner = 8,

    /// <summary>An Admin is told a new hall is awaiting review.</summary>
    HallSubmittedForAdmin = 9,

    /// <summary>An Admin rejected the hall; the owner is told with the reason.</summary>
    HallRejectedForOwner = 10,

    /// <summary>
    /// The requester cancelled their own booking, so a durable notice is left on the
    /// requester/owner thread (WESAL-TASK-10, Edit 13 follow-up).
    /// </summary>
    BookingCancelledForRequester = 11,

    /// <summary>An Admin confirmed the owner's subscription payment.</summary>
    SubscriptionPaidForOwner = 12,

    /// <summary>The owner's subscription cycle ends soon and needs renewing.</summary>
    SubscriptionExpiringForOwner = 13,

    /// <summary>
    /// The owner's subscription cycle ended without a renewal, so the hall was
    /// automatically restricted.
    /// </summary>
    SubscriptionExpiredForOwner = 14,

    /// <summary>
    /// An Event Coordinator's setup submission was received and is awaiting
    /// administrative review (WESAL coordinator setup).
    /// </summary>
    CoordinatorSetupReceivedForCoordinator = 15,

    /// <summary>
    /// A Photographer's setup submission was received and is awaiting administrative
    /// review (WESAL photographer setup).
    /// </summary>
    PhotographerSetupReceivedForPhotographer = 16,

    /// <summary>
    /// An Admin approved an Event Coordinator's account request
    /// (WESAL admin coordinator requests, Task 5, requirement 15.1).
    /// </summary>
    CoordinatorApprovedForCoordinator = 17,

    /// <summary>
    /// An Admin rejected an Event Coordinator's account request; the reason is delivered
    /// inside the notification and the click-through opens the Admin conversation
    /// (WESAL admin coordinator requests, Task 5, requirements 5.5 and 15.1).
    /// </summary>
    CoordinatorRejectedForCoordinator = 18,

    /// <summary>
    /// An Admin approved a Photographer's account request
    /// (WESAL admin photographer requests, Task 6, requirement 15.6).
    /// </summary>
    PhotographerApprovedForPhotographer = 19,

    /// <summary>
    /// An Admin asked a Photographer to edit their data or documents; the click-through
    /// opens the Admin conversation that carries the notes
    /// (WESAL admin photographer requests, Task 6, requirements 6.5 and 15.6).
    /// </summary>
    PhotographerNeedsChangesForPhotographer = 20,

    /// <summary>
    /// An Admin rejected a Photographer's account request; the reason is delivered inside
    /// the notification and the click-through opens the Admin conversation
    /// (WESAL admin photographer requests, Task 6, requirements 6.5 and 15.6).
    /// </summary>
    PhotographerRejectedForPhotographer = 21,

    ProfessionalOfferPublishedForCoordinator = 22,
    ProfessionalOfferPublishedForPhotographer = 23,
    ProfessionalOfferEditsSaved = 24,
    ProfessionalOfferReminder24Hours = 25,
    ProfessionalOfferEndedForCoordinator = 26,
    ProfessionalOfferEndedForPhotographer = 27,
    ProfessionalOfferStopped = 28,
    PostEditsSaved = 29,
    PostCommentedForCoordinator = 30,
    PostCommentedForPhotographer = 31,
    PostCommentReplyForOwner = 32,
    PostCommentReplyOnOwnerPost = 33,
    NewMessage = 34,
    AdminMessageForCoordinator = 35,
    AdminMessageForPhotographer = 36
}

/// <summary>
/// Where a notification's click-through action lands (WESAL-TASK-13, Edit 13).
///
/// <see cref="None"/> means the notification is purely informational and deliberately
/// carries no action, rather than defaulting to some arbitrary screen.
/// </summary>
public enum NotificationActionTarget
{
    None = 0,

    /// <summary>The owner's booking-request details for the affected booking.</summary>
    BookingRequestDetails = 1,

    /// <summary>The seeker's own bookings list.</summary>
    MyBookings = 2,

    /// <summary>The owner's booking-requests list.</summary>
    OwnerBookingRequests = 3,

    /// <summary>The owner's "My Halls" list, which carries the payment-notice entry point.</summary>
    MyHalls = 4,

    /// <summary>The Admin's hall-requests review list.</summary>
    AdminHallRequests = 5,

    /// <summary>A specific conversation thread, identified by the notification's target id.</summary>
    Conversation = 6,
    Post = 7,
    Offer = 8
}
