namespace Wesal.Domain.Entities;

public class ConversationReadState
{
    public Guid ConversationId { get; set; }

    public Conversation Conversation { get; set; } = null!;

    public string UserId { get; set; } = string.Empty;

    public DateTimeOffset LastReadAt { get; set; }
}
