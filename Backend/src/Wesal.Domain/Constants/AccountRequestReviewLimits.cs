namespace Wesal.Domain.Constants;

/// <summary>
/// The rules for the text an Administrator writes on an account request decision
/// (WESAL Tasks 5/6: coordinator rejection reason, photographer rejection reason and
/// request-changes notes). Shared by the request validators and the review services so
/// the API and the domain can never disagree about what is valid.
/// </summary>
public static class AccountRequestReviewLimits
{
    /// <summary>
    /// The longest rejection reason an Administrator may give, in characters.
    /// </summary>
    /// <remarks>
    /// Same reasoning as <see cref="BookingRejectionReasons.MaximumLength"/>: the reason is
    /// not stored in its own column. It is wrapped in a localized sentence
    /// (<c>"... for the following reason: ..."</c>) and that whole sentence becomes both the
    /// conversation message and the notification body, while <c>Message.Content</c> is capped
    /// at 1000 characters. 500 leaves the wrapping sentence ample room in either language and
    /// turns an over-long input into a clean 400 before any state changes.
    /// </remarks>
    public const int MaximumReasonLength = 500;

    /// <summary>
    /// The longest request-changes note an Administrator may give, in characters.
    /// </summary>
    /// <remarks>
    /// These notes are posted as the conversation message itself rather than wrapped in a
    /// template, so the bound is simply the <c>Message.Content</c> column width. The
    /// notification that points at the conversation deliberately does not repeat them
    /// (requirement 15.6), so nothing else has to fit them.
    /// </remarks>
    public const int MaximumNotesLength = 1000;
}
