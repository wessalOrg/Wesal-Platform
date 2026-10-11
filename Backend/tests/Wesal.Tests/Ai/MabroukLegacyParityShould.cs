using System.Text.Json;
using Wesal.Application.Ai;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Ai;

/// <summary>
/// Permanent legacy-parity contracts (§36): every valid recovered behavior stays
/// green, and product-owner-reported real-user phrasings are covered without new
/// test code (append items to the JSON fixtures). Fixture schema:
/// {id, prompt, turns?, expect{kind?, intent?, contains?[], notContains?[],
/// action?}}.
/// </summary>
public sealed class MabroukLegacyParityShould
{
    private sealed record ParityExpectation(
        string? Kind,
        string? Intent,
        string[]? Contains,
        string[]? NotContains,
        string? Action);

    private sealed record ParityCase(
        string Id,
        string Prompt,
        string[]? Turns,
        ParityExpectation Expect);

    public static TheoryData<string> ContractFiles => new()
    {
        "mabrouk-legacy-must-preserve.json",
        "mabrouk-real-user-regressions.json"
    };

    [Theory]
    [MemberData(nameof(ContractFiles))]
    public async Task LegacyContractHoldsForEveryCorpusItem(string file)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Ai", "Fixtures", file);
        var cases = JsonSerializer.Deserialize<List<ParityCase>>(await File.ReadAllTextAsync(path),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        Assert.NotNull(cases);
        Assert.NotEmpty(cases);

        var failures = new List<string>();
        foreach (var scenario in cases)
        {
            try
            {
                await RunCaseAsync(scenario, failures);
            }
            catch (Exception ex)
            {
                failures.Add($"{scenario.Id}: threw {ex.GetType().Name}: {ex.Message}");
            }
        }

        Assert.True(failures.Count == 0,
            file + " failures: " + string.Join("; ", failures.Take(15)));
    }

    private static async Task RunCaseAsync(ParityCase scenario, List<string> failures)
    {
        var harness = new MabroukHarness();
        using var sessions = new ChatSessionService();
        var session = await sessions.InitializeSessionAsync("ar");
        AiAssistantResponse response = null!;

        foreach (var turn in scenario.Turns ?? [])
        {
            var context = await sessions.GetConversationContextAsync(session.SessionId);
            response = await harness.AskAsync(turn, conversation: context);
            await sessions.SaveExchangeAsync(session.SessionId, turn, response.Message, response.Intent,
                AiResponseMemory.ShownHalls(response), AiResponseMemory.FocusedHall(response),
                conversationState: AdvanceLikeController(context, turn, response));
        }

        {
            var context = await sessions.GetConversationContextAsync(session.SessionId);
            response = await harness.AskAsync(scenario.Prompt, conversation: context);
        }

        void Check(bool condition, string detail)
        {
            if (!condition) failures.Add($"{scenario.Id} [{scenario.Prompt}]: {detail} (kind={response.Kind}, message={Truncate(response.Message)})");
        }

        var expect = scenario.Expect;
        if (expect.Kind is not null)
            Check(response.Kind.ToString() == expect.Kind, $"expected kind {expect.Kind}");
        if (expect.Intent is not null)
            Check(response.Intent?.Intent.ToString() == expect.Intent, $"expected intent {expect.Intent}");
        foreach (var required in expect.Contains ?? [])
            Check(response.Message.Contains(required, StringComparison.Ordinal), $"missing '{required}'");
        foreach (var forbidden in expect.NotContains ?? [])
            Check(!response.Message.Contains(forbidden, StringComparison.Ordinal), $"forbidden '{forbidden}' present");
        if (expect.Action is not null)
            Check(response.Actions?.Any(action => action.PageKey == expect.Action) == true, $"missing action '{expect.Action}'");
    }

    private static string Truncate(string message)
        => message.Length <= 160 ? message : message[..160];

    private static AiConversationState AdvanceLikeController(AiConversationContext context, string message, AiAssistantResponse response)
    {
        if (response.Intent?.Intent == AiIntentType.SearchHalls && response.Halls.Count > 0)
            return AiConversationStateResolver.WithCollectionResults(context.State, AiResponseMemory.ShownHalls(response));
        if (AiReferenceResolver.TryGetOrdinal(message) is { } ordinal)
        {
            IReadOnlyList<Guid> ids = context.LastHalls is { Count: > 0 } halls
                ? halls.Select(hall => hall.HallId).ToList()
                : context.State?.ShownHallIds ?? (IReadOnlyList<Guid>)Array.Empty<Guid>();
            if (ids.Count > (ordinal < 0 ? ids.Count - 1 : ordinal)
                && AiResponseMemory.FocusedHall(response) is { } ordinalHall)
                return AiConversationStateResolver.AdvanceSelection(context.State, ordinalHall, ordinal < 0 ? ids.Count - 1 : ordinal);
        }
        if (AiConversationStateResolver.IsNextResult(message) && AiResponseMemory.FocusedHall(response) is { } nextHall)
            return AiConversationStateResolver.AdvanceSelection(context.State, nextHall, (context.State?.SelectedResultIndex ?? -1) + 1);
        var conversationHall = context.LastHall ?? (context.LastHalls is { Count: 1 } single ? single[0] : null);
        return AiConversationStateResolver.Advance(context.State, message, response, conversationHall);
    }
}
