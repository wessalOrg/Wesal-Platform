namespace Wesal.Application.Common.Models;

public sealed class ConversationResponse
{
    public Guid ConversationId { get; init; }

    public Guid HallId { get; init; }

    public string HallOwnerId { get; init; } = string.Empty;

    public string SenderUserId { get; init; } = string.Empty;

    public DateTimeOffset CreatedAt { get; init; }
}
