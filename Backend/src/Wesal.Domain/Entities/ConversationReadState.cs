namespace Wesal.Domain.Entities;

/// <summary>
/// Per-participant state for one conversation (WESAL-TASK-6, Edit 6). One row per
/// (ConversationId, UserId); a row is created the first time the participant reads or
/// hides the thread, and is upserted on every subsequent read/hide.
///
/// This is a VISIBILITY record only. Nothing here — and no operation on this entity —
/// ever deletes a <see cref="Conversation"/> or any <see cref="Message"/>. The payment
/// workflow depends on the owner/Admin thread being a permanent record, so conversation
/// and message data is append-only and independent of what a participant has hidden.
/// </summary>
public class ConversationReadState
{
    public Guid ConversationId { get; set; }

    public Conversation Conversation { get; set; } = null!;

    public string UserId { get; set; } = string.Empty;

    public DateTimeOffset LastReadAt { get; set; }

    /// <summary>
    /// When this participant removed the conversation from their own inbox, or null when
    /// they have not hidden it.
    ///
    /// Hiding is per-user and reversible-by-nature: it takes the thread out of this one
    /// participant's conversation list and unread badge and nothing else. The other
    /// participants are not consulted and are entirely unaffected.
    ///
    /// The hide is deliberately not a permanent flag but a watermark, which is what makes
    /// the re-appear rule fall out of the data with no extra state: the thread is hidden
    /// for this participant only while no message has arrived after <see cref="HiddenAt"/>.
    /// A single new message — from the other participant or from this one — therefore
    /// un-hides the thread automatically, because the watermark is now in the past. Marking
    /// as read does NOT clear the watermark, so hiding is sticky until real new activity
    /// occurs rather than being undone by an incidental open.
    ///
    /// The thread itself stays reachable by direct id for a participant who has hidden it,
    /// so a deep link or a notification action still works; only inbox membership changes.
    /// </summary>
    public DateTimeOffset? HiddenAt { get; set; }
}
