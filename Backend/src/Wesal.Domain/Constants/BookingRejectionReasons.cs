namespace Wesal.Domain.Constants;

/// <summary>
/// WESAL-TASK-12 (Edit 12): the rules for a booking rejection reason. Shared by the request
/// validator and the rejection service so the API and the domain can never disagree about
/// what a valid reason is.
/// </summary>
public static class BookingRejectionReasons
{
    /// <summary>
    /// The longest rejection reason an owner may give, in characters.
    /// </summary>
    /// <remarks>
    /// <para>
    /// This is deliberately smaller than the 1000-character database column. The reason is not
    /// stored on its own: it is wrapped in a localized sentence
    /// (<c>"... Reason: {Reason}"</c>) and that whole sentence becomes both the conversation
    /// message and the notification body, and <c>Message.Content</c> is itself capped at 1000
    /// characters. Leaving the reason free to fill its own column therefore made an
    /// over-long reason overflow the message column instead, surfacing as an unhandled
    /// database error after the rejection had already been applied.
    /// </para>
    /// <para>
    /// 500 is also what the owner-facing UI already enforces, so this makes the server agree
    /// with the client instead of leaving the limit as a soft <c>maxlength</c> hint that
    /// direct API callers could ignore.
    /// </para>
    /// </remarks>
    public const int MaximumLength = 500;
}
