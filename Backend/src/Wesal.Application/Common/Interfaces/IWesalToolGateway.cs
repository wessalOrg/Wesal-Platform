using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Internal, application-level abstraction over the approved read-only Wesal
/// tools. The Gemini model never chooses what code runs; the <see cref="GeminiToolOrchestrator"/>
/// (and any future consumer) validates an invocation and asks the gateway to
/// execute it against existing application services. The gateway enforces:
/// an allow-list of tool names, strict argument validation, safe normalized error
/// messages, and an explicit rejection of any invocation that smuggles
/// authentication fragments (userId/ownerId/role/jwt/token/claims). It is
/// deliberately read-only and never grants the model write access.
/// </summary>
public interface IWesalToolGateway
{
    /// <summary>
    /// The stable, approved tool definitions (name + description + JSON Schema)
    /// that may be advertised to a model. Consumed to build Gemini function
    /// declarations; nothing else may be executed.
    /// </summary>
    IReadOnlyList<WesalToolDefinition> ToolDefinitions { get; }

    /// <summary>True when <paramref name="toolName"/> is on the approved allow-list.</summary>
    bool IsKnownTool(string toolName);

    /// <summary>
    /// Executes one validated invocation. Unknown tools are rejected. Non-success
    /// results always carry a safety-normalized, user-safe error message.
    /// </summary>
    Task<WesalToolResult> ExecuteAsync(
        WesalToolInvocation invocation,
        CancellationToken cancellationToken = default);
}