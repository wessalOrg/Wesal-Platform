namespace Wesal.Application.Common.Models;

/// <summary>
/// A single recorded exchange in a session's conversation memory.
/// <see cref="Role"/> is the participant that produced the text ("user").
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
    AiAssistantIntentDto? LastIntent);
