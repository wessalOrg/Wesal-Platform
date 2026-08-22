namespace Wesal.Application.Common.Models;

public sealed class CreateConversationRequest
{
    public Guid HallId { get; init; }
}

public sealed class ConversationResponse
{
    public Guid ConversationId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string InitiatorUserId { get; init; } = string.Empty;

    public string OwnerUserId { get; init; } = string.Empty;

    public DateTimeOffset CreatedAt { get; init; }

    public bool IsExisting { get; init; }
}
