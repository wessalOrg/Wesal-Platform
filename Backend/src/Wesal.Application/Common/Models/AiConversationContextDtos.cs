namespace Wesal.Application.Common.Models;

/// <summary>
/// A single recorded entry in a session's conversation memory.
/// <see cref="Role"/> is the participant that produced the text ("user" or "assistant").
/// </summary>
public sealed record AiConversationTurn(string Role, string Text);

/// <summary>
/// In-memory conversational state carried across turns of one chat session. This is
/// what lets the assistant resolve short references ("أقرب لغزة", "300 شخص", "فيه
/// قاعة...") without a second Gemini call or direct database access: recent user
/// turns are fed into the intent-classification prompt, and the last structured
/// intent is used to carry search criteria forward between turns.
/// </summary>
public sealed record AiConversationContext(
    IReadOnlyList<AiConversationTurn> Turns,
    AiAssistantIntentDto? LastIntent,
    IReadOnlyList<AiHallRef>? LastHalls = null,
    AiHallRef? LastHall = null);

/// <summary>A hall the conversation has shown or focused (id + display name only).</summary>
public sealed record AiHallRef(Guid HallId, string HallName);

/// <summary>
/// Validated, server-resolved context for one turn. <see cref="Hall"/> is a live
/// public projection fetched by the backend from the hall id — never client data.
/// <see cref="HallSource"/> says why that hall is in context
/// ("pinned", "page", "ordinal" or "conversation").
/// </summary>
public sealed record AiTurnContext(
    string? PageKey,
    string? PagePath,
    HallDetailsDto? Hall,
    string? HallSource,
    DateOnly Today,
    string TimeZoneLabel)
{
    public static AiTurnContext Empty(DateOnly today, string timeZoneLabel = "Asia/Gaza")
        => new(null, null, null, null, today, timeZoneLabel);
}
