namespace Wesal.Domain.Constants;

/// <summary>
/// The synthetic <c>Conversation.SenderUserId</c> values that stand in for "the platform side"
/// of an owner/Admin thread when no real user can be named there.
/// <para>
/// A conversation records its two parties in the <c>SenderUserId</c> / <c>HallOwnerId</c>
/// columns, with no type discriminator (WESAL-TASK-10, Edit 16). An owner/Admin thread is
/// therefore told apart from a seeker/owner thread by asking who the counterparty is, and
/// these two values are counters: they name the platform, not a person.
/// </para>
/// <para>
/// They exist because three separate code paths have to put something in that column when the
/// real Admin is not available:
/// <list type="bullet">
/// <item><see cref="AdminFallback"/> — the owner opened the thread themselves
/// (<c>ContactAdminAsync</c>) or an unauthenticated background call needed a value.</item>
/// <item><see cref="System"/> — an automated platform notice such as a subscription-expiry
/// warning or lock, which is addressed to the owner and is Admin-side by definition.</item>
/// </list>
/// Because they are not user ids they hold no role, so a classifier that only asked "does this
/// sender hold the Admin role" would misclassify every one of these owner/platform threads as
/// seeker threads. Both values are therefore treated as Admin-side wherever the conversation
/// kind is decided. They are also never delivery or login targets.
/// </para>
/// <para>
/// Defined once here because the same two literals were previously repeated in three
/// services, where a change to one copy would have silently produced a different thread kind
/// than the others.
/// </para>
/// </summary>
public static class PlatformSenders
{
    /// <summary>Stands in for the Admin side when no real Admin account can be named.</summary>
    public const string AdminFallback = "admin";

    /// <summary>Stands in for the platform on automated owner-facing notices.</summary>
    public const string System = "system";

    /// <summary>Every value that means "the platform side" rather than a person.</summary>
    public static readonly string[] All = [AdminFallback, System];

    /// <summary>
    /// Whether this sender id is a platform counter rather than a real user.
    /// </summary>
    public static bool IsPlatformSender(string? senderUserId)
        => senderUserId is not null && All.Contains(senderUserId, StringComparer.OrdinalIgnoreCase);
}
