using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

public class Message : BaseAuditableEntity
{
    public Guid ConversationId { get; set; }

    public Conversation Conversation { get; set; } = null!;

    public string SenderUserId { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;
}