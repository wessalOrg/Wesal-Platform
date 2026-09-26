namespace Wesal.Domain.Constants;

/// <summary>
/// WESAL-TASK-10 (Edit 10): the hard limits that apply to a message, shared by the request
/// validators and the send services so the API and the domain cannot disagree about what a
/// valid message is.
/// </summary>
public static class MessageLimits
{
    /// <summary>
    /// The longest idempotency key a sender may supply, in characters. Matches the width of
    /// the <c>ClientRequestId</c> column.
    /// </summary>
    /// <remarks>
    /// WESAL-TASK-10 (Edit 10): the text send path enforced this only in its FluentValidation
    /// rule, and the attachment path — where the value arrives as a raw form field that no
    /// validator covers — did not enforce it anywhere. An over-long value therefore reached the
    /// insert and came back as an unhandled database error. Both services now enforce it here.
    /// </remarks>
    public const int MaximumClientRequestIdLength = 450;
}
