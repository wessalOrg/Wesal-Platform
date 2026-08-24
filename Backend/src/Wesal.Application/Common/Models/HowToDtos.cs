namespace Wesal.Application.Common.Models;

public sealed record HowToRequest(string? Question);

/// <summary>
/// Language precedence for AI responses (bilingual contract):
/// 1. Detected user query language — when reliably determinable.
/// 2. Site/display language — only as fallback when query language is uncertain.
/// 3. Default ("ar") — if neither can determine the language.
/// <see cref="ResponseLanguage"/> declares which language was actually used.
/// </summary>
public sealed record HowToResponse(
    string Answer,
    string Category,
    string ResponseLanguage,
    DateTime Timestamp);
