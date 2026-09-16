using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public sealed class GeminiToolOrchestratorShould
{
    private readonly FakeToolCallService _gemini = new();
    private readonly FakeToolGateway _gateway = new();
    private readonly FakeKnowledgeService _knowledge = new();
    private readonly FakeHowToService _howTo = new();
    private readonly FakeLanguageDetector _languageDetector = new();

    private GeminiToolOrchestrator CreateOrchestrator()
        => new(_gemini, _gateway, _knowledge, _howTo, _languageDetector, NullLogger<GeminiToolOrchestrator>.Instance);

    [Fact]
    public async Task ReturnModelTextDirectly_WhenNoToolCall()
    {
        _gemini.Script = [new GeminiToolTurn("Wesal is a wedding-hall platform.", null)];

        var result = await CreateOrchestrator().ExecuteAsync("what is wesal?", "en");

        Assert.True(result.Success);
        Assert.Equal("Wesal is a wedding-hall platform.", result.Answer);
        Assert.Empty(result.ToolCalls);
        Assert.Equal("en", result.ResponseLanguage);
    }

    [Fact]
    public async Task ExecuteToolCallThenReturnModelText()
    {
        var hallId = Guid.NewGuid();
        _gemini.Script =
        [
            new GeminiToolTurn(null, new GeminiFunctionCall("search_halls", new JsonObject { ["region"] = "Gaza" })),
            new GeminiToolTurn("Found Gaza Hall!", null)
        ];
        _gateway.ExecuteResult = WesalToolResult.Ok(new JsonObject { ["halls"] = new JsonArray() });

        var result = await CreateOrchestrator().ExecuteAsync("search Gaza", "en");

        Assert.True(result.Success);
        Assert.Equal("Found Gaza Hall!", result.Answer);
        Assert.Single(result.ToolCalls);
        Assert.Equal("search_halls", result.ToolCalls[0].Name);
        Assert.Equal("Gaza", result.ToolCalls[0].Arguments["region"]!.GetValue<string>());
    }

    [Fact]
    public async Task GeminiUnavailable_FallsBackToHowTo()
    {
        _gemini.Available = false;
        _howTo.Answer = "HowTo deterministic answer";
        _howTo.Language = "en";

        var result = await CreateOrchestrator().ExecuteAsync("how do I book?", "en");

        Assert.True(result.Success);
        Assert.Equal("HowTo deterministic answer", result.Answer);
        Assert.Equal("en", result.ResponseLanguage);
        Assert.Empty(result.ToolCalls);
        Assert.False(_gemini.WasCalled);
    }

    [Fact]
    public async Task GeminiReturnsNullTurn_FallsBackToHowTo()
    {
        _gemini.Script = [null!];
        _howTo.Answer = "HowTo fallback";

        var result = await CreateOrchestrator().ExecuteAsync("how do I book?", "ar");

        Assert.True(result.Success);
        Assert.Equal("HowTo fallback", result.Answer);
        Assert.Empty(result.ToolCalls);
    }

    [Fact]
    public async Task GeminiReturnsEmptyTurn_FallsBackToHowTo()
    {
        _gemini.Script = [new GeminiToolTurn(null, null)];
        _howTo.Answer = "HowTo fallback";

        var result = await CreateOrchestrator().ExecuteAsync("how do I book?", "ar");

        Assert.True(result.Success);
        Assert.Equal("HowTo fallback", result.Answer);
    }

    [Fact]
    public async Task MaxToolRounds_Reached_StopsSafely()
    {
        _gemini.Script = Enumerable.Range(1, 5)
            .Select(i => new GeminiToolTurn(null, new GeminiFunctionCall("search_halls", new JsonObject { ["name"] = $"hall-{i}" })))
            .ToList();
        _gateway.ExecuteResult = WesalToolResult.Ok(new JsonObject { ["halls"] = new JsonArray() });

        var result = await CreateOrchestrator().ExecuteAsync("search", "en");

        Assert.True(result.Success);
        Assert.Contains("different wording", result.Answer);
        Assert.Equal(GeminiToolOrchestrator.MaxToolRounds, result.ToolCalls.Count);
    }

    [Fact]
    public async Task RepeatedIdenticalCall_AbortsAfterBudget()
    {
        _gemini.Script =
        [
            new GeminiToolTurn(null, new GeminiFunctionCall("search_halls", new JsonObject { ["name"] = "identical" })),
            new GeminiToolTurn(null, new GeminiFunctionCall("search_halls", new JsonObject { ["name"] = "identical" })),
            new GeminiToolTurn(null, new GeminiFunctionCall("search_halls", new JsonObject { ["name"] = "identical" })),
            new GeminiToolTurn("final", null)
        ];
        _gateway.ExecuteResult = WesalToolResult.Ok(new JsonObject { ["halls"] = new JsonArray() });

        var result = await CreateOrchestrator().ExecuteAsync("search", "en");

        Assert.True(result.Success);
        Assert.Contains("different wording", result.Answer);
        Assert.Equal(2, result.ToolCalls.Count);
    }

    [Fact]
    public async Task DifferentCallsNotCountedAsRepeated()
    {
        _gemini.Script =
        [
            new GeminiToolTurn(null, new GeminiFunctionCall("search_halls", new JsonObject { ["name"] = "Gaza Hall" })),
            new GeminiToolTurn(null, new GeminiFunctionCall("get_hall_details", new JsonObject { ["hallId"] = Guid.NewGuid().ToString() })),
            new GeminiToolTurn("Found!", null)
        ];
        _gateway.ExecuteResult = WesalToolResult.Ok(new JsonObject());

        var result = await CreateOrchestrator().ExecuteAsync("search", "en");

        Assert.Equal("Found!", result.Answer);
        Assert.Equal(2, result.ToolCalls.Count);
    }

    [Fact]
    public async Task UnknownToolFromModel_ReturnsSafeErrorToGemini()
    {
        _gemini.Script =
        [
            new GeminiToolTurn(null, new GeminiFunctionCall("get_my_bookings", new JsonObject())),
            new GeminiToolTurn("I cannot do that.", null)
        ];

        var result = await CreateOrchestrator().ExecuteAsync("show my bookings", "en");

        Assert.True(result.Success);
        Assert.Equal("I cannot do that.", result.Answer);
        var functionResponse = FindFunctionResponse(_gemini.CapturedContentsPerCall, "get_my_bookings");
        Assert.NotNull(functionResponse);
        Assert.Equal("tool_error", functionResponse.Response["result"]!.GetValue<string>());
    }

    [Fact]
    public async Task ToolFailure_ReturnsErrorToGemini()
    {
        _gemini.Script =
        [
            new GeminiToolTurn(null, new GeminiFunctionCall("get_hall_details", new JsonObject { ["hallId"] = Guid.NewGuid().ToString() })),
            new GeminiToolTurn("The hall is not found.", null)
        ];
        _gateway.ExecuteResult = WesalToolResult.Fail("The requested hall was not found.");

        var result = await CreateOrchestrator().ExecuteAsync("tell me about that hall", "en");

        Assert.Equal("The hall is not found.", result.Answer);
        var functionResponse = FindFunctionResponse(_gemini.CapturedContentsPerCall, "get_hall_details");
        Assert.NotNull(functionResponse);
        Assert.Equal("tool_error", functionResponse.Response["result"]!.GetValue<string>());
        Assert.Contains("not found", functionResponse.Response["error"]!.GetValue<string>());
    }

    [Fact]
    public async Task OfficialKBArticleInjectedIntoSystemInstruction()
    {
        _knowledge.Articles =
        [
            new WesalKnowledgeArticle("Wesal", "platform", "team.md", new DateOnly(2026, 1, 1),
                WesalKnowledgeStatus.Verified, "Wesal was created by Gaza engineers.")
        ];
        _gemini.Script = [new GeminiToolTurn("test", null)];

        await CreateOrchestrator().ExecuteAsync("what is wesal?", "en");

        Assert.Contains("Wesal was created by Gaza engineers", _gemini.LastSystemInstruction);
    }

    [Fact]
    public async Task ContactArticleSkipped_WhenQuestionAboutMessagingOwner()
    {
        _knowledge.Articles =
        [
            new WesalKnowledgeArticle("Contact", "platform", "contact.md", new DateOnly(2026, 1, 1),
                WesalKnowledgeStatus.Verified, "WhatsApp: +970567581412"),
            new WesalKnowledgeArticle("Booking Rules", "faq", "booking.md", new DateOnly(2026, 1, 1),
                WesalKnowledgeStatus.Verified, "You need a registered account.")
        ];
        _gemini.Script = [new GeminiToolTurn("reply", null)];

        await CreateOrchestrator().ExecuteAsync("كيف أتواصل مع صاحب القاعة", "ar");

        Assert.Contains("You need a registered account.", _gemini.LastSystemInstruction);
        Assert.DoesNotContain("WhatsApp: +970567581412", _gemini.LastSystemInstruction);
    }

    [Fact]
    public async Task NoOfficialKBArticles_UsesSafeDefaultContext()
    {
        _knowledge.Articles = [];
        _gemini.Script = [new GeminiToolTurn("reply", null)];

        await CreateOrchestrator().ExecuteAsync("query", "en");

        Assert.Contains("No official Wesal knowledge was available", _gemini.LastSystemInstruction);
    }

    [Fact]
    public async Task ConversationHistoryTurnsAreIncluded()
    {
        _gemini.Script = [new GeminiToolTurn("reply", null)];
        var context = new AiConversationContext(
            [
                new AiConversationTurn("user", "previous question"),
                new AiConversationTurn("user", "another question")
            ],
            null);

        await CreateOrchestrator().ExecuteAsync("current question", "en", context: context);

        Assert.Equal(3, _gemini.LastContents.Count);
        Assert.Contains("previous question", _gemini.LastContents[0].Parts[0].Text!);
        Assert.Contains("current question", _gemini.LastContents[2].Parts[0].Text!);
    }

    [Fact]
    public async Task EmptyMessage_ThrowsArgumentException()
    {
        await Assert.ThrowsAsync<ArgumentException>(
            () => CreateOrchestrator().ExecuteAsync("", "en"));
    }

    [Fact]
    public async Task LanguageDetectorCalledWithCurrentMessage()
    {
        _gemini.Script = [new GeminiToolTurn("reply", null)];
        _languageDetector.ReturnedLanguage = "ar";

        var result = await CreateOrchestrator().ExecuteAsync("مرحبا", "en");

        Assert.Equal("ar", result.ResponseLanguage);
        Assert.Equal("مرحبا", _languageDetector.LastText);
    }

    [Fact]
    public async Task FallbackToHowTo_UseDetectedLanguage()
    {
        _gemini.Available = false;
        _languageDetector.ReturnedLanguage = "ar";
        _howTo.Answer = "AR answer";
        _howTo.Language = "ar";

        var result = await CreateOrchestrator().ExecuteAsync("سؤال", "en");

        Assert.Equal("ar", result.ResponseLanguage);
        Assert.Equal("AR answer", result.Answer);
    }

    private static GeminiFunctionResponse? FindFunctionResponse(
        IReadOnlyList<List<GeminiConversationMessage>> capturedContents,
        string toolName)
    {
        foreach (var contents in capturedContents)
        {
            var message = contents.LastOrDefault(m =>
                string.Equals(m.Role, "function", StringComparison.Ordinal)
                && m.Parts.Any(p => p.FunctionResponse?.Name == toolName));
            if (message is null)
                continue;

            var part = message.Parts.First(p => p.FunctionResponse?.Name == toolName);
            return part.FunctionResponse;
        }

        return null;
    }

    private sealed class FakeToolCallService : IGeminiToolCallService
    {
        public bool Available { get; set; } = true;
        public List<GeminiToolTurn> Script { get; set; } = new();
        public bool WasCalled { get; private set; }
        public string LastSystemInstruction { get; private set; } = string.Empty;
        public List<GeminiConversationMessage> LastContents { get; private set; } = [];
        public List<List<GeminiConversationMessage>> CapturedContentsPerCall { get; } = [];
        private int _callIndex;

        public bool IsAvailable => Available;

        public Task<GeminiToolTurn?> GenerateToolTurnAsync(
            IReadOnlyList<GeminiConversationMessage> contents,
            string systemInstruction,
            IReadOnlyList<GeminiFunctionDeclaration> functions,
            CancellationToken cancellationToken = default)
        {
            WasCalled = true;
            LastSystemInstruction = systemInstruction;
            LastContents = contents.ToList();
            CapturedContentsPerCall.Add(LastContents);
            var turn = _callIndex < Script.Count ? Script[_callIndex] : null;
            _callIndex++;

            return Task.FromResult(turn);
        }
    }

    private sealed class FakeToolGateway : IWesalToolGateway
    {
        public IReadOnlyList<WesalToolDefinition> ToolDefinitions { get; } =
        [
            new WesalToolDefinition("search_halls", "Search halls",
                new JsonObject { ["type"] = "object", ["properties"] = new JsonObject() }),
            new WesalToolDefinition("get_hall_details", "Get hall details",
                new JsonObject { ["type"] = "object", ["properties"] = new JsonObject() }),
            new WesalToolDefinition("check_hall_availability", "Check availability",
                new JsonObject { ["type"] = "object", ["properties"] = new JsonObject() })
        ];

        public WesalToolResult ExecuteResult { get; set; } = WesalToolResult.Ok(new JsonObject());
        public List<WesalToolInvocation> Invocations { get; } = [];

        public bool IsKnownTool(string toolName) =>
            ToolDefinitions.Any(d => d.Name == toolName);

        public Task<WesalToolResult> ExecuteAsync(WesalToolInvocation invocation, CancellationToken cancellationToken = default)
        {
            Invocations.Add(invocation);
            return Task.FromResult(ExecuteResult);
        }
    }

    private sealed class FakeKnowledgeService : IWesalKnowledgeService
    {
        public IReadOnlyList<WesalKnowledgeArticle> Articles { get; set; } = [];

        public Task<IReadOnlyList<WesalKnowledgeArticle>> SearchAsync(string question, string? language,
            int maxResults = 3, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<WesalKnowledgeArticle>>(Articles);
    }

    private sealed class FakeHowToService : IHowToService
    {
        public string Answer { get; set; } = string.Empty;
        public string Language { get; set; } = "ar";

        public Task<HowToResponse> AskHowToAsync(string question, string? language, CancellationToken cancellationToken = default)
            => Task.FromResult(new HowToResponse(Answer, "general", Language, DateTime.UtcNow));
    }

    private sealed class FakeLanguageDetector : IAiLanguageDetector
    {
        public string? ReturnedLanguage { get; set; }
        public string? LastText { get; private set; }

        public string? Detect(string? text)
        {
            LastText = text;
            return ReturnedLanguage;
        }
    }
}