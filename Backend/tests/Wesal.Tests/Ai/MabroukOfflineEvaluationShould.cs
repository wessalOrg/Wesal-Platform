using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Ai;
using Wesal.Application.Ai.Navigation;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.AiAssistant;
using Xunit.Abstractions;

namespace Wesal.Tests.Ai;

/// <summary>
/// Offline, provider-free golden evaluation. The fixture describes realistic turns;
/// the runners call production deterministic services and scripted model/tool fakes.
/// </summary>
public sealed class MabroukOfflineEvaluationShould
{
    private static readonly DateOnly EvaluationToday = new(2026, 10, 1);

    private static readonly string[] RequiredDimensions =
    [
        "Intent accuracy",
        "Context resolution",
        "Hall reference resolution",
        "Date resolution",
        "Knowledge retrieval",
        "Capability truth",
        "Tool selection",
        "Tool arguments",
        "Grounded response type",
        "Navigation safety",
        "Fallback quality",
        "Dialect understanding",
        "English understanding",
        "Prompt-injection resistance",
        "Unsupported actions",
        "Session ownership",
        "Conversation continuity"
    ];

    private readonly ITestOutputHelper _output;

    public MabroukOfflineEvaluationShould(ITestOutputHelper output) => _output = output;

    [Fact]
    public async Task OfflineGoldenDataset_MeasuresAllRequiredDimensions_AndWritesJsonReport()
    {
        var fixturePath = Path.Combine(AppContext.BaseDirectory, "Ai", "Fixtures", "mabrouk-golden-eval.json");
        using var fixture = JsonDocument.Parse(await File.ReadAllTextAsync(fixturePath));
        var cases = fixture.RootElement.EnumerateArray().Select(item => item.Clone()).ToArray();
        Assert.True(cases.Length >= 100, $"Expected at least 100 golden turns, found {cases.Length}.");

        var actualDimensions = cases.Select(item => String(item, "dimension")).Where(value => value is not null).ToHashSet(StringComparer.Ordinal);
        var missingDimensions = RequiredDimensions.Where(dimension => !actualDimensions.Contains(dimension)).ToArray();
        Assert.Empty(missingDimensions);

        var results = new List<EvalResult>(cases.Length);
        var conversations = new Dictionary<string, EvalConversation>(StringComparer.Ordinal);
        var knowledge = new WesalKnowledgeService();
        var criteria = new NaturalLanguageCriteriaExtractor();
        var intentClassifier = new AiIntentFallbackClassifier(criteria);
        var sessions = new ChatSessionService();

        foreach (var item in cases)
        {
            var timer = Stopwatch.StartNew();
            var failures = await EvaluateCaseAsync(item, conversations, sessions, knowledge, intentClassifier);
            results.Add(new EvalResult(
                String(item, "id") ?? "missing-id",
                String(item, "dimension") ?? "Uncategorized",
                failures.Count == 0,
                timer.ElapsedMilliseconds,
                failures));
        }

        var projectDirectory = FindTestProjectDirectory();
        var reportDirectory = Path.Combine(projectDirectory, "TestResults");
        Directory.CreateDirectory(reportDirectory);
        var reportPath = Path.Combine(reportDirectory, "mabrouk-eval-report.json");
        var grouped = results
            .GroupBy(result => result.Dimension, StringComparer.Ordinal)
            .OrderBy(group => group.Key, StringComparer.Ordinal)
            .Select(group => new
            {
                dimension = group.Key,
                passed = group.Count(result => result.Passed),
                total = group.Count(),
                score = Math.Round(group.Count(result => result.Passed) * 100d / group.Count(), 2)
            })
            .ToArray();
        var report = new
        {
            suite = "Mabrouk offline golden evaluation",
            version = 1,
            generatedAtUtc = DateTimeOffset.UtcNow,
            offlineOnly = true,
            providerCalls = 0,
            modelProfile = "deterministic application services and scripted Gemini outputs",
            totalTurns = results.Count,
            passed = results.Count(result => result.Passed),
            failed = results.Count(result => !result.Passed),
            overallScore = Math.Round(results.Count(result => result.Passed) * 100d / results.Count, 2),
            dimensions = grouped,
            cases = results
        };
        await File.WriteAllTextAsync(reportPath, JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));

        _output.WriteLine("Offline evaluation report: {0}", reportPath);
        _output.WriteLine("Score: {0}/{1} ({2:F2}%)", report.passed, report.totalTurns, report.overallScore);
        foreach (var dimension in grouped)
        {
            _output.WriteLine("{0}: {1}/{2} ({3:F2}%)", dimension.dimension, dimension.passed, dimension.total, dimension.score);
        }

        var failedResults = results.Where(result => !result.Passed).ToArray();
        Assert.True(
            failedResults.Length == 0,
            "Golden evaluation failures: " + string.Join("; ", failedResults.Select(result => $"{result.Id}: {string.Join(", ", result.Failures)}")));
    }

    private static async Task<List<string>> EvaluateCaseAsync(
        JsonElement item,
        IDictionary<string, EvalConversation> conversations,
        ChatSessionService sessions,
        IWesalKnowledgeService knowledge,
        AiIntentFallbackClassifier intentClassifier)
    {
        var failures = new List<string>();
        var runner = String(item, "runner");
        var message = String(item, "message") ?? string.Empty;
        var language = String(item, "language") ?? "ar";

        switch (runner)
        {
            case "assistant":
                await EvaluateAssistantAsync(item, conversations, sessions, failures, message, language);
                break;
            case "intent":
                Check(
                    intentClassifier.Classify(message).Intent.ToString() == String(item, "expectedIntent"),
                    "intent",
                    failures);
                break;
            case "date":
                var date = AiRelativeDateResolver.Resolve(message, EvaluationToday);
                var dateText = date?.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
                Check(dateText == String(item, "expectedDate"), $"date expected={String(item, "expectedDate") ?? "null"} actual={dateText ?? "null"}", failures);
                Check(!Boolean(item, "expectNull") || date is null, "expected no date", failures);
                break;
            case "reference":
                var ordinal = AiReferenceResolver.TryGetOrdinal(message);
                if (TryInt(item, "expectedOrdinal", out var expectedOrdinal))
                    Check(ordinal == expectedOrdinal, $"ordinal expected={expectedOrdinal} actual={ordinal}", failures);
                if (String(item, "expectedHallName") is { } expectedHallName)
                    Check(AiReferenceResolver.TryGetExplicitHallName(message)?.Contains(expectedHallName, StringComparison.OrdinalIgnoreCase) == true,
                        $"explicit hall name did not contain '{expectedHallName}'", failures);
                if (Boolean(item, "expectNull"))
                    Check(ordinal is null && AiReferenceResolver.TryGetExplicitHallName(message) is null, "expected no hall reference", failures);
                break;
            case "knowledge":
                var articles = await knowledge.SearchAsync(message, language, 5);
                var title = String(item, "expectedTitleContains");
                var article = articles.FirstOrDefault(candidate => title is null || candidate.Title.Contains(title, StringComparison.OrdinalIgnoreCase));
                Check(article is not null, $"knowledge article '{title}' was not retrieved", failures);
                if (article is not null && String(item, "expectedStatus") is { } expectedStatus)
                    Check(article.Status.ToString() == expectedStatus, $"knowledge status expected={expectedStatus} actual={article.Status}", failures);
                break;
            case "capability":
                var capabilityKey = String(item, "expectedCapability");
                var capability = WesalCapabilityRegistry.Find(capabilityKey);
                Check(capability is not null, $"capability '{capabilityKey}' is missing", failures);
                if (capability is not null)
                    Check(capability.Status.ToString() == String(item, "expectedStatus"),
                        $"capability status expected={String(item, "expectedStatus")} actual={capability.Status}", failures);

                if (!Boolean(item, "capabilityDirect"))
                {
                    var detected = AiNavigationIntentDetector.DetectUnavailableTopic(message);
                    Check(detected?.Key == capabilityKey, $"capability detection expected={capabilityKey} actual={detected?.Key ?? "none"}", failures);
                }
                break;
            case "navigation":
                var match = Boolean(item, "suggestion")
                    ? AiNavigationIntentDetector.DetectSuggestion(message)
                    : AiNavigationIntentDetector.Detect(message);
                Check(!Boolean(item, "expectNull") || match is null, "expected no navigation match", failures);
                if (String(item, "expectedPageKey") is { } pageKey)
                    Check(match?.Page.Key == pageKey, $"page expected={pageKey} actual={match?.Page.Key ?? "none"}", failures);
                if (String(item, "expectedMode") is { } mode)
                    Check(match?.Mode.ToString() == mode, $"mode expected={mode} actual={match?.Mode.ToString() ?? "none"}", failures);
                if (match is not null)
                    Check(WesalNavigationRegistry.ResolveHref(match.Page.Key) == match.Page.Path,
                        $"navigation route is not registry-backed: {match.Page.Path}", failures);
                break;
            case "tool":
                await EvaluateScriptedToolAsync(item, failures, message, language);
                break;
            case "session":
                await EvaluateSessionOwnershipAsync(item, failures, sessions, language);
                break;
            default:
                failures.Add($"unknown runner '{runner}'");
                break;
        }

        return failures;
    }

    private static async Task EvaluateAssistantAsync(
        JsonElement item,
        IDictionary<string, EvalConversation> conversations,
        ChatSessionService sessions,
        ICollection<string> failures,
        string message,
        string language)
    {
        var conversationId = String(item, "conversationId") ?? String(item, "id") ?? Guid.NewGuid().ToString("N");
        if (!conversations.TryGetValue(conversationId, out var conversation))
        {
            var harness = new MabroukHarness();
            var session = await sessions.InitializeSessionAsync(language, userId: "offline-eval-user");
            conversation = new EvalConversation(harness, session.SessionId);
            conversations.Add(conversationId, conversation);
        }

        var context = await sessions.GetConversationContextAsync(conversation.SessionId, userId: "offline-eval-user");
        var page = String(item, "page");
        var pinnedAlias = String(item, "pinnedHall");
        var pinned = pinnedAlias switch
        {
            "nakheel" => conversation.Harness.NakheelId,
            "orchid" => conversation.Harness.OrchidId,
            "invalid" => Guid.NewGuid(),
            _ => (Guid?)null
        };

        var response = await conversation.Harness.AskAsync(
            message,
            language,
            pathname: page,
            pinnedHall: pinned,
            pinnedRaw: pinnedAlias == "invalid" ? "not-a-guid" : null,
            conversation: context);

        CheckEnum((AiAssistantResponseKind?)response.Kind, String(item, "expectedKind"), "kind", failures);
        CheckEnum(response.Intent?.Intent, String(item, "expectedIntent"), "intent", failures);
        Check(String(item, "expectedRegion") is not { } region || response.Intent?.Region == region,
            $"region expected={String(item, "expectedRegion")} actual={response.Intent?.Region ?? "none"}", failures);
        Check(!TryInt(item, "expectedCapacity", out var capacity) || response.Intent?.Capacity == capacity,
            $"capacity expected={capacity} actual={response.Intent?.Capacity?.ToString() ?? "none"}", failures);
        Check(!TryInt(item, "expectedHallCount", out var hallCount) || response.Halls.Count == hallCount,
            $"hall count expected={hallCount} actual={response.Halls.Count}", failures);

        var expectedHallAlias = String(item, "expectedHallId");
        if (expectedHallAlias is not null)
        {
            var expectedHallId = expectedHallAlias switch
            {
                "nakheel" => conversation.Harness.NakheelId,
                "orchid" => conversation.Harness.OrchidId,
                _ => Guid.Empty
            };
            var containsHall = response.HallDetails?.HallId == expectedHallId
                || response.Availability?.HallId == expectedHallId
                || response.Halls.Any(hall => hall.HallId == expectedHallId);
            Check(containsHall, $"hall '{expectedHallAlias}' was not present in the structured response", failures);
        }

        var availabilityDate = response.Availability?.Date.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
        Check(availabilityDate == String(item, "expectedAvailabilityDate"),
            $"availability date expected={String(item, "expectedAvailabilityDate")} actual={availabilityDate ?? "none"}", failures);

        var expectedActionPath = String(item, "expectedActionPath");
        var expectedActionPrefix = String(item, "expectedActionPathPrefix");
        if (expectedActionPath is not null)
            Check(response.Actions?.Any(action => action.Href == expectedActionPath) == true, $"expected action path '{expectedActionPath}'", failures);
        if (expectedActionPrefix is not null)
            Check(response.Actions?.Any(action => action.Href.StartsWith(expectedActionPrefix, StringComparison.Ordinal)) == true,
                $"expected action path prefix '{expectedActionPrefix}'", failures);
        if (String(item, "expectedActionMode") is { } expectedMode)
            Check(response.Actions?.Any(action => action.Mode == expectedMode) == true, $"expected action mode '{expectedMode}'", failures);
        if (Boolean(item, "forbidActions"))
            Check(response.Actions is null || response.Actions.Count == 0, "unexpected navigation action", failures);

        foreach (var required in Strings(item, "mustContain"))
            Check(response.Message.Contains(required, StringComparison.OrdinalIgnoreCase), $"response missing '{required}'", failures);
        foreach (var forbidden in Strings(item, "mustNotContain"))
            Check(!response.Message.Contains(forbidden, StringComparison.OrdinalIgnoreCase), $"response contained forbidden text '{forbidden}'", failures);

        var shownHalls = response.Halls.Select(hall => new AiHallRef(hall.HallId, hall.HallName)).ToArray();
        var focusedHall = response.HallDetails is { } details
            ? new AiHallRef(details.HallId, details.HallName)
            : response.Availability is { } availability
                ? new AiHallRef(availability.HallId, availability.HallName)
                : null;
        await sessions.SaveExchangeAsync(
            conversation.SessionId,
            message,
            response.Message,
            response.Intent,
            shownHalls,
            focusedHall);
    }

    private static async Task EvaluateScriptedToolAsync(JsonElement item, ICollection<string> failures, string message, string language)
    {
        var harness = new MabroukHarness(geminiAvailable: true);
        var toolName = String(item, "modelTool") ?? string.Empty;
        var argumentsElement = item.GetProperty("toolArguments");
        var arguments = JsonNode.Parse(argumentsElement.GetRawText()) as JsonObject ?? new JsonObject();
        harness.Gemini.Script.Enqueue(new GeminiToolTurn(null, new GeminiFunctionCall(toolName, arguments)));
        harness.Gemini.Script.Enqueue(new GeminiToolTurn("I completed the read-only request.", null));

        _ = await harness.AskAsync(message, language);
        Check(harness.Gemini.Calls.Count == 2, $"expected scripted model/tool/model flow, calls={harness.Gemini.Calls.Count}", failures);
        Check(toolName == String(item, "expectedTool"), $"tool expected={String(item, "expectedTool")} actual={toolName}", failures);

        var expectedAccepted = Boolean(item, "expectedToolAccepted");
        var searchExecuted = harness.Search.Requests.Count > 0;
        var detailsExecuted = harness.Details.Requested.Count > 0;
        var availabilityExecuted = harness.Slots.Calls.Count > 0;
        var anyToolExecuted = searchExecuted || detailsExecuted || availabilityExecuted;
        Check(anyToolExecuted == expectedAccepted, $"tool acceptance expected={expectedAccepted} actual={anyToolExecuted}", failures);

        if (String(item, "expectedRegion") is { } region)
            Check(harness.Search.Requests.LastOrDefault()?.Region?.ToString() == region,
                $"tool region expected={region} actual={harness.Search.Requests.LastOrDefault()?.Region?.ToString() ?? "none"}", failures);
        if (TryInt(item, "expectedCapacity", out var capacity))
            Check(harness.Search.Requests.LastOrDefault()?.MinimumCapacity == capacity,
                $"tool capacity expected={capacity} actual={harness.Search.Requests.LastOrDefault()?.MinimumCapacity?.ToString() ?? "none"}", failures);
        if (TryInt(item, "expectedPageSize", out var pageSize))
            Check(harness.Search.Requests.LastOrDefault()?.PageSize == pageSize,
                $"tool page size expected={pageSize} actual={harness.Search.Requests.LastOrDefault()?.PageSize.ToString() ?? "none"}", failures);
    }

    private static async Task EvaluateSessionOwnershipAsync(
        JsonElement item,
        ICollection<string> failures,
        ChatSessionService sessions,
        string language)
    {
        var owner = String(item, "sessionOwner");
        var requester = String(item, "sessionRequester");
        var session = await sessions.InitializeSessionAsync(language, userId: owner);
        var visible = await sessions.GetSessionAsync(session.SessionId, userId: requester);
        Check((visible is not null) == Boolean(item, "expectedAccessible"),
            $"session access expected={Boolean(item, "expectedAccessible")} actual={visible is not null}", failures);
    }

    private static void CheckEnum<T>(T? actual, string? expected, string label, ICollection<string> failures)
        where T : struct, Enum
    {
        if (expected is null) return;
        Check(actual?.ToString() == expected, $"{label} expected={expected} actual={actual?.ToString() ?? "none"}", failures);
    }

    private static void Check(bool condition, string failure, ICollection<string> failures)
    {
        if (!condition) failures.Add(failure);
    }

    private static string? String(JsonElement item, string name)
        => item.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static bool Boolean(JsonElement item, string name)
        => item.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True;

    private static bool TryInt(JsonElement item, string name, out int value)
    {
        value = default;
        return item.TryGetProperty(name, out var element) && element.TryGetInt32(out value);
    }

    private static IReadOnlyList<string> Strings(JsonElement item, string name)
        => item.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Array
            ? value.EnumerateArray().Where(element => element.ValueKind == JsonValueKind.String).Select(element => element.GetString()!).ToArray()
            : [];

    private static string FindTestProjectDirectory()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "Wesal.Tests.csproj")))
                return directory.FullName;
            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate Wesal.Tests.csproj for the offline evaluation report.");
    }

    private sealed record EvalConversation(MabroukHarness Harness, Guid SessionId);

    private sealed record EvalResult(string Id, string Dimension, bool Passed, long ElapsedMs, IReadOnlyList<string> Failures);
}
