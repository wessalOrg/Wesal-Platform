using System.Diagnostics;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Bounded Gemini tool-calling orchestration for the Wesal assistant. Grounds the
/// model in official Knowledge Base facts and trusted per-turn context (today's date,
/// the semantic page, the hall in context), exposes only the approved read-only tools
/// through <see cref="IWesalToolGateway"/>, and enforces strict budgets so a
/// misbehaving model can never loop: at most <see cref="MaxToolRounds"/> Gemini turns
/// per user message, at most <see cref="MaxRepeatedToolCalls"/> identical tool
/// invocations, and a wall-clock budget for the whole turn. Gemini is never trusted
/// with authentication material, never chooses which code runs, and may only request
/// the approved tools.
///
/// When Gemini cannot serve the request (unavailable, failed, timed out, empty) the
/// result is <see cref="AiOrchestrationDisposition.NotHandled"/> — NOT a generic
/// answer — so the caller runs the deterministic search/details/availability/
/// knowledge/navigation path. Live tool results are kept as typed payloads so the
/// response can carry hall cards, details and availability, not just prose.
/// </summary>
public sealed class GeminiToolOrchestrator : IGeminiToolOrchestrator
{
    public const int MaxToolRounds = 4;
    public const int MaxRepeatedToolCalls = 2;
    public const int MaxMessageLength = 2000;
    public const int MaxHistoryTurns = 5;
    public const int MaxKnowledgeResults = 4;
    public const int MaxKnowledgeInjections = 2;
    public const int MaxStructuredHalls = 8;

    private const string DefaultLanguage = "ar";

    private static readonly string[] SupportContactMarkers =
    [
        "wesal", "وصال", "support", "دعم", "whatsapp", "واتساب", "phone", "هاتف",
        "email", "بريد", "tel", "رقم", "تواصل مع وصال"
    ];

    private readonly IGeminiToolCallService _gemini;
    private readonly IWesalToolGateway _gateway;
    private readonly IWesalKnowledgeService _knowledgeService;
    private readonly IAiLanguageDetector _languageDetector;
    private readonly GoogleAiSettings _settings;
    private readonly ILogger<GeminiToolOrchestrator> _logger;

    public GeminiToolOrchestrator(
        IGeminiToolCallService gemini,
        IWesalToolGateway gateway,
        IWesalKnowledgeService knowledgeService,
        IAiLanguageDetector? languageDetector = null,
        IOptions<GoogleAiSettings>? settings = null,
        ILogger<GeminiToolOrchestrator>? logger = null)
    {
        _gemini = gemini;
        _gateway = gateway;
        _knowledgeService = knowledgeService;
        _languageDetector = languageDetector ?? new AiLanguageDetector();
        _settings = settings?.Value ?? new GoogleAiSettings();
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<GeminiToolOrchestrator>.Instance;
    }

    public async Task<WesalToolOrchestrationResult> ExecuteAsync(
        string message,
        string? language,
        CancellationToken cancellationToken = default,
        AiConversationContext? context = null,
        AiTurnContext? turnContext = null)
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
            _logger.LogInformation("Gemini unavailable; orchestrator reports NotHandled so the deterministic path runs.");
            return WesalToolOrchestrationResult.NotHandled(effectiveLanguage);
        }

        var total = Stopwatch.StartNew();
        var budgetSeconds = _settings.TotalBudgetSeconds > 0 ? _settings.TotalBudgetSeconds : 15;
        using var budget = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        budget.CancelAfter(TimeSpan.FromSeconds(budgetSeconds));

        try
        {
            return await RunAsync(boundedMessage, effectiveLanguage, context, turnContext, budget.Token, total);
        }
        catch (OperationCanceledException) when (budget.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Gemini orchestration exceeded its {Budget}s budget after {ElapsedMs} ms; degrading to the deterministic path.",
                budgetSeconds,
                total.ElapsedMilliseconds);
            return WesalToolOrchestrationResult.NotHandled(effectiveLanguage);
        }
    }

    private async Task<WesalToolOrchestrationResult> RunAsync(
        string boundedMessage,
        string effectiveLanguage,
        AiConversationContext? context,
        AiTurnContext? turnContext,
        CancellationToken cancellationToken,
        Stopwatch total)
    {
        var functions = _gateway.ToolDefinitions
            .Select(definition => new GeminiFunctionDeclaration(
                definition.Name,
                definition.Description,
                definition.Parameters))
            .ToList();

        var knowledgeTimer = Stopwatch.StartNew();
        var knowledgeContext = await BuildOfficialKnowledgeContextAsync(boundedMessage, effectiveLanguage, cancellationToken);
        knowledgeTimer.Stop();

        var systemInstruction = GeminiPromptBuilder.BuildToolSystemInstruction(
            effectiveLanguage,
            knowledgeContext,
            GeminiPromptBuilder.MaxToolSystemContextCharacters,
            turnContext,
            context,
            functions);

        var contents = BuildInitialContents(boundedMessage, context);
        var thinkingLevel = ChooseThinkingLevel(boundedMessage, context, turnContext);
        var toolCalls = new List<WesalToolInvocation>();
        var invocationCounts = new Dictionary<string, int>(StringComparer.Ordinal);
        var hallNames = new Dictionary<Guid, string>();
        if (turnContext?.Hall is { } pinned)
        {
            hallNames[pinned.HallId] = pinned.HallName;
        }

        foreach (var shown in context?.LastHalls ?? [])
        {
            hallNames[shown.HallId] = shown.HallName;
        }

        WesalToolResult? lastStructured = null;
        long modelMs = 0;
        long toolMs = 0;

        for (var round = 0; round < MaxToolRounds; round++)
        {
            var modelTimer = Stopwatch.StartNew();
            var turn = await _gemini.GenerateToolTurnWithThinkingAsync(
                contents,
                systemInstruction,
                functions,
                thinkingLevel,
                cancellationToken);
            modelMs += modelTimer.ElapsedMilliseconds;

            if (turn is null)
            {
                _logger.LogWarning("Gemini tool-calling produced no usable turn; NotHandled (round {Round}).", round + 1);
                return WesalToolOrchestrationResult.NotHandled(effectiveLanguage);
            }

            if (turn.HasFunctionCall)
            {
                var calls = turn.FunctionCalls.Count > 0
                    ? turn.FunctionCalls
                    : turn.FunctionCall is null ? [] : [turn.FunctionCall];
                var invocations = calls
                    .Where(call => !string.IsNullOrWhiteSpace(call.Name))
                    .Select(call => (Call: call, Invocation: new WesalToolInvocation(
                        call.Name.Trim(), call.Arguments ?? new JsonObject())))
                    .ToList();

                // Check the whole model turn before executing any part of it, so a
                // mixed valid/repeated parallel batch cannot partially run.
                var nextCounts = new Dictionary<string, int>(invocationCounts, StringComparer.Ordinal);
                foreach (var item in invocations)
                {
                    var fingerprint = BuildFingerprint(item.Invocation);
                    var prior = nextCounts.TryGetValue(fingerprint, out var count) ? count : 0;
                    if (prior + 1 > MaxRepeatedToolCalls)
                    {
                        _logger.LogWarning(
                            "Gemini requested identical tool call {ToolName} more than {Max} times; aborting this turn.",
                            item.Invocation.Name,
                            MaxRepeatedToolCalls);
                        return BuildSafeTermination(effectiveLanguage, toolCalls);
                    }

                    nextCounts[fingerprint] = prior + 1;
                }

                invocationCounts = nextCounts;
                toolCalls.AddRange(invocations.Select(item => item.Invocation));

                var modelMessageParts = new List<GeminiConversationPart>();
                if (turn.HasText)
                {
                    modelMessageParts.Add(new GeminiConversationPart(Text: turn.Text));
                }

                modelMessageParts.AddRange(calls.Select(call => new GeminiConversationPart(FunctionCall: call)));
                contents.Add(new GeminiConversationMessage("model", modelMessageParts)
                {
                    ProviderContinuation = turn.ProviderContinuation
                });

                var responseParts = new List<GeminiConversationPart>(invocations.Count);
                foreach (var item in invocations)
                {
                    var toolTimer = Stopwatch.StartNew();
                    var invocationResult = _gateway.IsKnownTool(item.Invocation.Name)
                        ? await _gateway.ExecuteAsync(item.Invocation, cancellationToken)
                        : WesalToolResult.Fail($"The tool '{item.Invocation.Name}' is not a supported Wesal tool.");
                    toolMs += toolTimer.ElapsedMilliseconds;

                    if (invocationResult.Success)
                    {
                        RememberNames(hallNames, invocationResult);
                        if (invocationResult.Halls is not null
                            || invocationResult.HallDetails is not null
                            || invocationResult.Availability is not null)
                        {
                            lastStructured = invocationResult;
                        }
                    }

                    var responsePayload = new JsonObject
                    {
                        ["result"] = invocationResult.Success ? (invocationResult.Data?.DeepClone() ?? new JsonObject()) : "tool_error",
                        ["error"] = invocationResult.ErrorMessage
                    };

                    responseParts.Add(new GeminiConversationPart(FunctionResponse: new GeminiFunctionResponse(
                        item.Invocation.Name,
                        responsePayload,
                        item.Call.Id)));
                }

                if (responseParts.Count > 0)
                {
                    // Gemini accepts function responses in a user message. The SDK
                    // keeps the call/response ids and opaque thought signatures.
                    contents.Add(new GeminiConversationMessage("user", responseParts));
                }

                continue;
            }

            if (turn.HasText)
            {
                _logger.LogInformation(
                    "Assistant orchestration handled by Gemini: model={Model} thinking={ThinkingLevel} tools={ToolCount} rounds={Rounds} knowledgeMs={KnowledgeMs} modelMs={ModelMs} toolMs={ToolMs} totalMs={TotalMs}",
                    _settings.GeminiModel,
                    thinkingLevel,
                    toolCalls.Count,
                    round + 1,
                    knowledgeTimer.ElapsedMilliseconds,
                    modelMs,
                    toolMs,
                    total.ElapsedMilliseconds);

                return BuildHandled(turn.Text!, effectiveLanguage, toolCalls, lastStructured, hallNames);
            }

            _logger.LogWarning("Gemini returned an empty tool-calling turn; NotHandled.");
            return WesalToolOrchestrationResult.NotHandled(effectiveLanguage);
        }

        _logger.LogWarning("Gemini tool-calling exceeded the maximum of {Max} rounds; safely stopping.", MaxToolRounds);
        return BuildSafeTermination(effectiveLanguage, toolCalls);
    }

    /// <summary>
    /// Uses existing structured criteria extraction to select model effort. High
    /// effort is reserved for requests with three or more explicit constraints;
    /// ordinary turns stay low/medium and deterministic fast paths never reach here.
    /// </summary>
    internal string ChooseThinkingLevel(
        string message,
        AiConversationContext? conversation,
        AiTurnContext? turn)
    {
        var criteria = new NaturalLanguageCriteriaExtractor().Extract(message);
        var hasDate = criteria.Date is not null
                      || (turn is not null && AiRelativeDateResolver.Resolve(message, turn.Today) is not null);
        var explicitConstraints = new object?[] { criteria.Region, criteria.Area, hasDate ? true : null, criteria.Capacity }
            .Count(value => value is not null);

        if (explicitConstraints >= 3)
            return _settings.DeepThinkingLevel;

        if (explicitConstraints >= 2 || (conversation?.LastHalls?.Count ?? 0) >= 2)
            return _settings.NormalThinkingLevel;

        return _settings.FastThinkingLevel;
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

        // All categories are grounding for the model (user-guide and hall-owner included);
        // contact info is skipped when the user is clearly asking about a hall owner.
        var selected = articles
            .Where(a => !IsContactInterference(a, question))
            .Take(MaxKnowledgeInjections)
            .ToList();

        return GeminiPromptBuilder.BuildOfficialKnowledgeContext(selected);
    }

    /// <summary>
    /// Builds the Gemini history: the last <see cref="MaxHistoryTurns"/> complete
    /// exchanges (user text as role <c>user</c>, assistant text as role <c>model</c>),
    /// then the current message. History is made of whole exchanges only; tool
    /// call/response pairs exist only inside the current turn, so no pair can ever be
    /// split by truncation.
    /// </summary>
    internal static List<GeminiConversationMessage> BuildInitialContents(string message, AiConversationContext? context)
    {
        var contents = new List<GeminiConversationMessage>();

        if (context?.Turns is { Count: > 0 } turns)
        {
            var usable = turns.Where(t => !string.IsNullOrWhiteSpace(t.Text)).ToList();

            // Keep the last N user turns together with the assistant replies that follow them.
            var userIndexes = usable
                .Select((turn, index) => (turn, index))
                .Where(x => x.turn.Role == "user")
                .Select(x => x.index)
                .ToList();
            var startAt = userIndexes.Count > MaxHistoryTurns ? userIndexes[^MaxHistoryTurns] : 0;
            var firstUser = userIndexes.Count == 0 ? usable.Count : userIndexes[0];
            startAt = Math.Max(startAt, firstUser);

            foreach (var turn in usable.Skip(startAt))
            {
                var role = turn.Role == "assistant" ? "model" : "user";
                contents.Add(new GeminiConversationMessage(role, [new GeminiConversationPart(Text: turn.Text.Trim())]));
            }
        }

        contents.Add(new GeminiConversationMessage("user", [new GeminiConversationPart(Text: message)]));
        return contents;
    }

    private static void RememberNames(Dictionary<Guid, string> names, WesalToolResult result)
    {
        foreach (var hall in result.Halls ?? [])
        {
            names[hall.HallId] = hall.HallName;
        }

        if (result.HallDetails is { } details)
        {
            names[details.HallId] = details.HallName;
        }
    }

    private static WesalToolOrchestrationResult BuildHandled(
        string answer,
        string language,
        IReadOnlyList<WesalToolInvocation> toolCalls,
        WesalToolResult? lastStructured,
        IReadOnlyDictionary<Guid, string> hallNames)
    {
        var result = new WesalToolOrchestrationResult(true, answer, language, toolCalls, DateTime.UtcNow);
        if (lastStructured is null)
        {
            return result;
        }

        if (lastStructured.Availability is { } availability)
        {
            var name = hallNames.TryGetValue(availability.HallId, out var known) ? known : availability.HallName;
            return result with { Availability = availability with { HallName = name } };
        }

        if (lastStructured.HallDetails is { } details)
        {
            return result with { HallDetails = details };
        }

        if (lastStructured.Halls is { Count: > 0 } halls)
        {
            return result with
            {
                Halls = halls
                    .Take(MaxStructuredHalls)
                    .Select(hall => new HallRecommendationDto(
                        hall.HallId,
                        hall.HallName,
                        hall.Region,
                        hall.Address,
                        hall.Capacity,
                        hall.Price,
                        hall.MainImage,
                        IsAvailable: true,
                        UnavailableReason: null))
                    .ToList()
            };
        }

        return result;
    }

    private static WesalToolOrchestrationResult BuildSafeTermination(
        string language,
        IReadOnlyList<WesalToolInvocation> toolCalls)
    {
        var answer = language == "en"
            ? "I couldn't complete that request safely. Please try a different wording."
            : "تعذر إكمال طلبك بأمان. يرجى إعادة الصياغة والمحاولة مرة أخرى.";

        return new WesalToolOrchestrationResult(true, answer, language, toolCalls, DateTime.UtcNow)
        {
            Disposition = AiOrchestrationDisposition.SafeTermination
        };
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
    /// When the top hit is the support-contact article and the user is actually asking
    /// about messaging a Hall Owner, skip that article so tailored how-to guidance wins.
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
