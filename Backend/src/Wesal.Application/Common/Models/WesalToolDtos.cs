using System.Text.Json.Nodes;

namespace Wesal.Application.Common.Models;

/// <summary>
/// Stable, deterministic names of the approved Wesal AI tools. These also map to
/// the public MCP tool names so the internal AI gateway and the external MCP
/// surface expose the same capabilities.
/// </summary>
public static class WesalToolNames
{
    public const string SearchHalls = "search_halls";
    public const string GetHallDetails = "get_hall_details";
    public const string CheckHallAvailability = "check_hall_availability";
}

/// <summary>
/// Metadata describing one approved AI tool: its stable name, a user-facing
/// descriptive summary (never internal implementation details), and an
/// OpenAPI-compatible JSON Schema describing its arguments.
/// </summary>
public sealed record WesalToolDefinition(
    string Name,
    string Description,
    JsonObject Parameters);

/// <summary>
/// A single tool invocation requested by the model. <see cref="Arguments"/> must
/// only ever be validated and executed by an application-owned gateway; the model
/// never chooses which method runs and never touches the database.
/// </summary>
public sealed record WesalToolInvocation(
    string Name,
    JsonObject Arguments);

/// <summary>
/// Normalized outcome of a tool execution. <see cref="Data"/> is populated only on
/// success and contains only safe, public data. <see cref="ErrorMessage"/> is a
/// safety-normalized, user-safe message that never reveals stack traces or
/// internal database errors.
/// </summary>
public sealed record WesalToolResult(
    bool Success,
    JsonObject? Data,
    string? ErrorMessage)
{
    public static WesalToolResult Ok(JsonObject data) => new(true, data, null);

    public static WesalToolResult Fail(string message) => new(false, null, message);
}

/// <summary>
/// A Gemini function declaration (tool) sent to the model. Mirrors the official
/// Gemini <c>functionDeclarations</c> element; <see cref="Parameters"/> is an
/// OpenAPI-compatible JSON Schema object.
/// </summary>
public sealed record GeminiFunctionDeclaration(
    string Name,
    string Description,
    JsonObject Parameters);

/// <summary>
/// A parsed <c>functionCall</c> requested by the model. <see cref="Arguments"/> is
/// the raw JSON object supplied by the model and must never be trusted as an
/// authorization mechanism.
/// </summary>
public sealed record GeminiFunctionCall(
    string Name,
    JsonObject Arguments);

/// <summary>
/// The application's response to one <c>functionCall</c>, returned to Gemini as a
/// <c>functionResponse</c> part.
/// </summary>
public sealed record GeminiFunctionResponse(
    string Name,
    JsonObject Response);

/// <summary>
/// One part of a Gemini conversation message: either free text, a function call
/// (model role), or a function response (function role).
/// </summary>
public sealed record GeminiConversationPart(
    string? Text = null,
    GeminiFunctionCall? FunctionCall = null,
    GeminiFunctionResponse? FunctionResponse = null);

/// <summary>
/// One message in the Gemini conversation history. <c>Role</c> is one of "user",
/// "model" or "function" (the roles Gemini accepts for <c>generateContent</c>).
/// </summary>
public sealed record GeminiConversationMessage(
    string Role,
    IReadOnlyList<GeminiConversationPart> Parts);

/// <summary>
/// The outcome of one Gemini tool-calling turn: either a final natural-language
/// <see cref="Text"/> or a requested <see cref="FunctionCall"/> (mutually exclusive
/// in practice; when both appear the call takes precedence).
/// </summary>
public sealed record GeminiToolTurn(
    string? Text,
    GeminiFunctionCall? FunctionCall)
{
    public bool HasFunctionCall => FunctionCall is not null;
    public bool HasText => !string.IsNullOrWhiteSpace(Text);
}

/// <summary>
/// Safe, user-facing result of a Gemini tool-calling orchestration run.
/// <see cref="ToolCalls"/> is an audit trail of every invocation requested this
/// turn; the final <see cref="Answer"/> is always safe, bilingual text.
/// </summary>
public sealed record WesalToolOrchestrationResult(
    bool Success,
    string Answer,
    string ResponseLanguage,
    IReadOnlyList<WesalToolInvocation> ToolCalls,
    DateTime Timestamp);