namespace Wesal.Application.Common.Models;

public sealed record InitializeAiSessionRequest(string? Language);

public sealed record AiSessionResponse(
    Guid SessionId,
    string Language,
    DateTime CreatedAt,
    DateTime ExpiresAt);
