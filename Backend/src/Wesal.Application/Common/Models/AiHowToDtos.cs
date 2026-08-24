namespace Wesal.Application.Common.Models;

/// <summary>
/// Request for AI how-to guidance. Used for validation support only - main orchestration belongs to Mohammed.
/// </summary>
public sealed record AiHowToRequest(
    string Question,
    Guid? SessionId = null,
    string? Language = null);

/// <summary>
/// Response for AI how-to guidance. Frontend-compatible contract with fallback flag.
/// </summary>
public sealed record AiHowToResponse(
    string Answer,
    bool IsFallback,
    Guid? SessionId = null,
    string Language = "ar");
