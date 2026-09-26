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
    HallRejectedForOwner = 10
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
    Conversation = 6
}
