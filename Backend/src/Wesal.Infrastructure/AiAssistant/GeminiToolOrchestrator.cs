using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Bounded Gemini tool-calling orchestration for the Wesal assistant. Grounds the
/// model in official Knowledge Base facts, exposes only the approved read-only
/// tools through <see cref="IWesalToolGateway"/>, and enforces strict budgets so a
/// misbehaving model can never loop: at most <see cref="MaxToolRounds"/> Gemini
/// turns per user message and at most <see cref="MaxRepeatedToolCalls"/> identical
/// tool invocations. Gemini is never trusted with authentication material, never
/// chooses which code runs, and may only request the three approved tools. Any
/// failure, empty result, or exhausted budget falls back to the deterministic
/// <see cref="IHowToService"/> so the assistant always answers safely.
/// </summary>
public sealed class GeminiToolOrchestrator : IGeminiToolOrchestrator
{
    public const int MaxToolRounds = 4;
    public const int MaxRepeatedToolCalls = 2;
    public const int MaxMessageLength = 2000;
    public const int MaxHistoryTurns = 5;
    public const int MaxKnowledgeResults = 3;
    public const int MaxKnowledgeInjections = 2;

    private const string DefaultLanguage = "ar";

    /// <summary>
    /// Official-fact categories injected as authoritative context (mirrors
    /// <see cref="HowToService"/>). Feature how-tos stay with the deterministic
    /// feature matcher and are never injected as model-grounding.
    /// </summary>
    private static readonly HashSet<string> OfficialKnowledgeCategories = new(
        ["platform", "faq", "policies"],
        StringComparer.OrdinalIgnoreCase);

    private static readonly string[] SupportContactMarkers =
    [
        "wesal", "وصال", "support", "دعم", "whatsapp", "واتساب", "phone", "هاتف",
        "email", "بريد", "tel", "رقم", "تواصل مع وصال"
    ];

    private readonly IGeminiToolCallService _gemini;
    private readonly IWesalToolGateway _gateway;
    private readonly IWesalKnowledgeService _knowledgeService;
    private readonly IHowToService _howToService;
    private readonly IAiLanguageDetector _languageDetector;
    private readonly ILogger<GeminiToolOrchestrator> _logger;

    public GeminiToolOrchestrator(
        IGeminiToolCallService gemini,
        IWesalToolGateway gateway,
        IWesalKnowledgeService knowledgeService,
        IHowToService howToService,
        IAiLanguageDetector? languageDetector = null,
        ILogger<GeminiToolOrchestrator>? logger = null)
    {
        _gemini = gemini;
        _gateway = gateway;
        _knowledgeService = knowledgeService;
        _howToService = howToService;
        _languageDetector = languageDetector ?? new AiLanguageDetector();
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<GeminiToolOrchestrator>.Instance;
    }

    public async Task<WesalToolOrchestrationResult> ExecuteAsync(
        string message,
        string? language,
        CancellationToken cancellationToken = default,
        AiConversationContext? context = null)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            throw new ArgumentException("Message must not be empty.", nameof(message));
        }

        var boundedMessage = BoundMessage(message);
        var effectiveLanguage = _languageDetector.Detect(boundedMessage)
            ?? (string.IsNullOrWhiteSpace(language) ? DefaultLanguage : language);

        if (!_gemini.IsAvailable)
        {
            _logger.LogInformation("Gemini unavailable; orchestrator falling back to deterministic HowTo.");
            return await FallbackToHowToAsync(boundedMessage, effectiveLanguage, cancellationToken);
        }

        var functions = _gateway.ToolDefinitions
            .Select(definition => new GeminiFunctionDeclaration(
                definition.Name,
                definition.Description,
                definition.Parameters))
            .ToList();

        var knowledgeContext = await BuildOfficialKnowledgeContextAsync(boundedMessage, effectiveLanguage, cancellationToken);
        var systemInstruction = GeminiPromptBuilder.BuildToolSystemInstruction(effectiveLanguage, knowledgeContext);

        var contents = BuildInitialContents(boundedMessage, context);
        var toolCalls = new List<WesalToolInvocation>();
        var invocationCounts = new Dictionary<string, int>(StringComparer.Ordinal);

        for (var round = 0; round < MaxToolRounds; round++)
        {
            var turn = await _gemini.GenerateToolTurnAsync(contents, systemInstruction, functions, cancellationToken);
            if (turn is null)
            {
                _logger.LogWarning("Gemini tool-calling produced no usable turn; falling back to deterministic HowTo.");
                return await FallbackToHowToAsync(boundedMessage, effectiveLanguage, cancellationToken);
            }

            if (turn.FunctionCall is not null)
            {
                var invocation = new WesalToolInvocation(
                    turn.FunctionCall.Name.Trim(),
                    turn.FunctionCall.Arguments ?? new JsonObject());

                var fingerprint = BuildFingerprint(invocation);
                var prior = invocationCounts.TryGetValue(fingerprint, out var count) ? count : 0;
                if (prior + 1 > MaxRepeatedToolCalls)
                {
                    _logger.LogWarning(
                        "Gemini requested identical tool call {ToolName} more than {Max} times; aborting this turn.",
                        invocation.Name,
                        MaxRepeatedToolCalls);
                    return BuildSafeTermination(effectiveLanguage, toolCalls);
                }

                invocationCounts[fingerprint] = prior + 1;
                toolCalls.Add(invocation);

                var modelMessageParts = new List<GeminiConversationPart>();
                if (turn.HasText)
                {
                    modelMessageParts.Add(new GeminiConversationPart(Text: turn.Text));
                }

                modelMessageParts.Add(new GeminiConversationPart(FunctionCall: turn.FunctionCall));
                contents.Add(new GeminiConversationMessage("model", modelMessageParts));

                var invocationResult = _gateway.IsKnownTool(invocation.Name)
                    ? await _gateway.ExecuteAsync(invocation, cancellationToken)
                    : WesalToolResult.Fail($"The tool '{invocation.Name}' is not a supported Wesal tool.");

                var responsePayload = new JsonObject
                {
                    ["result"] = invocationResult.Success ? (invocationResult.Data?.DeepClone() ?? new JsonObject()) : "tool_error",
                    ["error"] = invocationResult.ErrorMessage
                };

                contents.Add(new GeminiConversationMessage(
                    "function",
                    [
                        new GeminiConversationPart(FunctionResponse: new GeminiFunctionResponse(invocation.Name, responsePayload))
                    ]));

                continue;
            }

            if (turn.HasText)
            {
                return new WesalToolOrchestrationResult(
                    true,
                    turn.Text!,
                    effectiveLanguage,
                    toolCalls,
                    DateTime.UtcNow);
            }

            _logger.LogWarning("Gemini returned an empty tool-calling turn; falling back to deterministic HowTo.");
            return await FallbackToHowToAsync(boundedMessage, effectiveLanguage, cancellationToken);
        }

        _logger.LogWarning("Gemini tool-calling exceeded the maximum of {Max} rounds; safely stopping.", MaxToolRounds);
        return BuildSafeTermination(effectiveLanguage, toolCalls);
    }

    private async Task<WesalToolOrchestrationResult> FallbackToHowToAsync(
        string message,
        string language,
        CancellationToken cancellationToken)
    {
        var howTo = await _howToService.AskHowToAsync(message, language, cancellationToken);
        return new WesalToolOrchestrationResult(
            true,
            howTo.Answer,
            howTo.ResponseLanguage,
            [],
            DateTime.UtcNow);
    }

    private async Task<string> BuildOfficialKnowledgeContextAsync(
        string question,
        string language,
        CancellationToken cancellationToken)
    {
        var articles = await _knowledgeService.SearchAsync(
            question,
            language,
            MaxKnowledgeResults,
            cancellationToken);

        if (articles is null || articles.Count == 0)
        {
            return string.Empty;
        }

        var official = articles
            .Where(a => OfficialKnowledgeCategories.Contains(a.Category))
            .Where(a => !IsContactInterference(a, question))
            .Take(MaxKnowledgeInjections)
            .ToList();

        return GeminiPromptBuilder.BuildOfficialKnowledgeContext(official);
    }

    private static List<GeminiConversationMessage> BuildInitialContents(string message, AiConversationContext? context)
    {
        var contents = new List<GeminiConversationMessage>();

        if (context?.Turns is not null && context.Turns.Count > 0)
        {
            foreach (var turn in context.Turns.Where(t => !string.IsNullOrWhiteSpace(t.Text)).TakeLast(MaxHistoryTurns))
            {
                contents.Add(new GeminiConversationMessage("user", [new GeminiConversationPart(Text: turn.Text.Trim())]));
            }
        }

        contents.Add(new GeminiConversationMessage("user", [new GeminiConversationPart(Text: message)]));
        return contents;
    }

    private static WesalToolOrchestrationResult BuildSafeTermination(
        string language,
        IReadOnlyList<WesalToolInvocation> toolCalls)
    {
        var answer = language == "en"
            ? "I couldn't complete that request safely. Please try a different wording."
            : "تعذر إكمال طلبك بأمان. يرجى إعادة الصياغة والمحاولة مرة أخرى.";

        return new WesalToolOrchestrationResult(true, answer, language, toolCalls, DateTime.UtcNow);
    }

    private static string BoundMessage(string message)
    {
        var trimmed = message.Trim();
        return trimmed.Length <= MaxMessageLength
            ? trimmed
            : trimmed.Substring(trimmed.Length - MaxMessageLength);
    }

    private static string BuildFingerprint(WesalToolInvocation invocation)
    {
        var canonicalArguments = invocation.Arguments is null
            ? string.Empty
            : string.Join("|", invocation.Arguments
                .OrderBy(property => property.Key, StringComparer.Ordinal)
                .Select(property => $"{property.Key}={property.Value?.ToJsonString()}"));

        return $"{invocation.Name}|{canonicalArguments}";
    }

    /// <summary>
    /// When the top official hit is the support-contact article and the user is
    /// actually asking about messaging a Hall Owner, skip that article so tailored
    /// how-to guidance wins (mirrors the contact-interference guard in
    /// <see cref="HowToService"/>).
    /// </summary>
    private static bool IsContactInterference(WesalKnowledgeArticle article, string question)
    {
        if (!string.Equals(article.Category, "platform", StringComparison.OrdinalIgnoreCase)
            || !article.Title.Contains("contact", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var normalized = question.ToLowerInvariant();
        return !SupportContactMarkers.Any(marker => normalized.Contains(marker, StringComparison.Ordinal));
    }
}