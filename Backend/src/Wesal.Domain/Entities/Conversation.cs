using Wesal.Domain.Common;
using Wesal.Domain.Enums;

namespace Wesal.Domain.Entities;

public class Conversation : BaseAuditableEntity
{
    /// <summary>
    /// The hall this thread concerns, or null for a hall-less Admin request thread
    /// (WESAL admin coordinator/photographer requests, Tasks 5/6): the Admin ↔ coordinator
    /// and Admin ↔ photographer conversations opened from a request's review page have no
    /// hall by nature, because the thread is about the ACCOUNT request, not a venue.
    ///
    /// The two parties of such a thread are still recorded in <see cref="SenderUserId"/>
    /// (the Admin side, exactly like an owner/Admin thread) and <see cref="HallOwnerId"/>
    /// (the coordinator/photographer), so every existing participant, inbox, unread and
    /// live-push rule applies to it unchanged. The role of the counterparty — not a
    /// discriminator column — keeps telling the thread kinds apart, the same way
    /// ConversationAccess already documents.
    /// </summary>
    public Guid? HallId { get; set; }

    public Hall? Hall { get; set; }

    public string SenderUserId { get; set; } = string.Empty;

    public string HallOwnerId { get; set; } = string.Empty;

    public ConversationKind Kind { get; set; } = ConversationKind.HallBooking;

    public Guid? PendingContextPostId { get; set; }
    public Guid? PendingContextOfferId { get; set; }

    public ICollection<Message> Messages { get; set; } = [];
}
