using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

public class Message : BaseAuditableEntity
{
    public Guid ConversationId { get; set; }

    public Conversation Conversation { get; set; } = null!;

    public string SenderUserId { get; set; } = string.Empty;

    /// <summary>
    /// Text body of the message. Null only for an attachment-only message; a message must
    /// carry text, an attachment, or both.
    /// </summary>
    public string? Content { get; set; }

    public string? ClientRequestId { get; set; }

    /// <summary>
    /// Relative storage URL of an image attached to this message (WESAL-TASK-4, Edit 4).
    /// The file is stored OUTSIDE the public static-file area and is only served through
    /// the protected conversation-attachment endpoint to conversation participants.
    /// Null for a plain text message.
    /// </summary>
    public string? AttachmentUrl { get; set; }

    /// <summary>Stored MIME type of <see cref="AttachmentUrl"/> (e.g. image/jpeg).</summary>
    public string? AttachmentContentType { get; set; }

    /// <summary>Original display file name of the attachment.</summary>
    public string? AttachmentFileName { get; set; }

    /// <summary>True when this message carries an image attachment.</summary>
    public bool HasAttachment => !string.IsNullOrWhiteSpace(AttachmentUrl);
}
