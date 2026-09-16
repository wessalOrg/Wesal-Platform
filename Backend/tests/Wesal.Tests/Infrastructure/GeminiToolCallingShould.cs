using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public sealed class GeminiToolCallingShould
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private static GoogleAiSettings Settings(Action<GoogleAiSettings>? configure = null)
    {
        var settings = new GoogleAiSettings
        {
            ApiKey = "test-server-key-not-real",
            GeminiModel = "gemini-3.6-flash",
            BaseUrl = "https://generativelanguage.googleapis.com/v1beta",
            Enabled = true,
            MaxContextCharacters = 2000,
            TimeoutSeconds = 15
        };
        configure?.Invoke(settings);
        return settings;
    }

    private static IGeminiToolCallService CreateService(
        Func<HttpRequestMessage, HttpResponseMessage> responder,
        GoogleAiSettings? settings = null)
    {
        GeminiService.ResetCircuitBreaker();
        var handler = new FakeHttpHandler(responder);
        var factory = new FakeHttpClientFactory(handler);
        return new GeminiService(factory, Options.Create(settings ?? Settings()), NullLogger<GeminiService>.Instance);
    }

    private static HttpResponseMessage Json(HttpStatusCode code, object body)
        => new(code)
        {
            Content = new StringContent(JsonSerializer.Serialize(body, JsonOpts), Encoding.UTF8, "application/json")
        };

    private static object FunctionCallEnvelope(string name, object args) => new
    {
        candidates = new[]
        {
            new { content = new { parts = new[] { new { functionCall = new { name, args } } } } }
        }
    };

    private static object TextEnvelope(string text) => new
    {
        candidates = new[]
        {
            new { content = new { parts = new[] { new { text } } } }
        }
    };

    private static object TextAndFunctionCallEnvelope(string text, string name, object args) => new
    {
        candidates = new[]
        {
            new { content = new { parts = new object[] { new { text }, new { functionCall = new { name, args } } } } }
        }
    };

    private static string RequestBody(HttpRequestMessage request)
        => request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();

    private static IReadOnlyList<GeminiFunctionDeclaration> SampleFunctions() =>
    [
        new("search_halls", "Search halls", new JsonObject { ["type"] = "object", ["properties"] = new JsonObject() }),
        new("get_hall_details", "Get hall details", new JsonObject { ["type"] = "object", ["properties"] = new JsonObject() })
    ];

    private static IReadOnlyList<GeminiConversationMessage> SingleUserMessage(string text)
        => [new GeminiConversationMessage("user", [new GeminiConversationPart(Text: text)])];

    [Fact]
    public async Task ReturnsFunctionCall_OnSuccess()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK,
            FunctionCallEnvelope("search_halls", new { region = "Gaza" })));

        var result = await service.GenerateToolTurnAsync(
            SingleUserMessage("find halls in Gaza"),
            "system",
            SampleFunctions(),
            CancellationToken.None);

        Assert.NotNull(result);
        Assert.True(result!.HasFunctionCall);
        Assert.Equal("search_halls", result.FunctionCall!.Name);
        Assert.Equal("Gaza", result.FunctionCall.Arguments["region"]!.GetValue<string>());
    }

    [Fact]
    public async Task ReturnsText_OnSuccess()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK, TextEnvelope("Wesal is a wedding-hall platform.")));

        var result = await service.GenerateToolTurnAsync(
            SingleUserMessage("what is wesal?"),
            "system",
            SampleFunctions(),
            CancellationToken.None);

        Assert.NotNull(result);
        Assert.True(result!.HasText);
        Assert.Contains("Wesal", result.Text!);
        Assert.False(result.HasFunctionCall);
    }

    [Fact]
    public async Task PrioritizesFunctionCall_WhenBothTextAndCallPresent()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK,
            TextAndFunctionCallEnvelope("Let me search.", "search_halls", new { region = "Gaza" })));

        var result = await service.GenerateToolTurnAsync(
            SingleUserMessage("find halls in Gaza"),
            "system",
            SampleFunctions(),
            CancellationToken.None);

        Assert.NotNull(result);
        Assert.True(result!.HasFunctionCall);
        Assert.Contains("Let me search", result.Text!);
    }

    [Fact]
    public async Task SendsToolsAndAutoCallingConfigInBody()
    {
        JsonNode? body = null;
        var service = CreateService(request =>
        {
            body = JsonSerializer.Deserialize<JsonNode>(RequestBody(request), JsonOpts);
            return Json(HttpStatusCode.OK, TextEnvelope("ok"));
        });

        await service.GenerateToolTurnAsync(
            SingleUserMessage("find halls"),
            "system",
            SampleFunctions(),
            CancellationToken.None);

        var tools = body!["tools"]!.AsArray();
        Assert.Single(tools);
        var declarations = tools[0]!["functionDeclarations"]!.AsArray();
        Assert.Equal(2, declarations.Count);
        var names = declarations.Select(d => d!["name"]!.GetValue<string>()).OrderBy(n => n).ToList();
        Assert.Equal(["get_hall_details", "search_halls"], names);

        var mode = body!["toolConfig"]!["functionCallingConfig"]!["mode"]!.GetValue<string>();
        Assert.Equal("AUTO", mode);
    }

    [Fact]
    public async Task SendsSystemInstruction_Verbatim()
    {
        string? instruction = null;
        var service = CreateService(request =>
        {
            instruction = JsonSerializer.Deserialize<JsonElement>(RequestBody(request))
                .GetProperty("systemInstruction")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString();
            return Json(HttpStatusCode.OK, TextEnvelope("ok"));
        });

        await service.GenerateToolTurnAsync(
            SingleUserMessage("query"),
            "CUSTOM-INSTRUCTION",
            SampleFunctions(),
            CancellationToken.None);

        Assert.Equal("CUSTOM-INSTRUCTION", instruction);
    }

    [Fact]
    public async Task SendsApiKeyInHeader_NotInUrlOrBody()
    {
        string? url = null;
        string? body = null;
        IEnumerable<string>? apiKeyHeader = null;
        var service = CreateService(request =>
        {
            url = request.RequestUri!.ToString();
            body = RequestBody(request);
            apiKeyHeader = request.Headers.TryGetValues("x-goog-api-key", out var values) ? values : null;
            return Json(HttpStatusCode.OK, TextEnvelope("ok"));
        });

        await service.GenerateToolTurnAsync(
            SingleUserMessage("find halls"),
            "system",
            SampleFunctions(),
            CancellationToken.None);

        Assert.Equal(["test-server-key-not-real"], apiKeyHeader);
        Assert.DoesNotContain("test-server-key-not-real", url!);
        Assert.DoesNotContain("test-server-key-not-real", body!);
    }

    [Fact]
    public async Task CapsContentHistoryAtSevenMessages()
    {
        JsonNode? body = null;
        var service = CreateService(request =>
        {
            body = JsonSerializer.Deserialize<JsonNode>(RequestBody(request), JsonOpts);
            return Json(HttpStatusCode.OK, TextEnvelope("ok"));
        });

        var messages = Enumerable.Range(1, 10)
            .Select(i => new GeminiConversationMessage("user", [new GeminiConversationPart(Text: $"message {i}")]))
            .ToList();

        await service.GenerateToolTurnAsync(messages, "system", SampleFunctions(), CancellationToken.None);

        var contents = body!["contents"]!.AsArray();
        Assert.True(contents.Count <= 7);
    }

    [Fact]
    public async Task Disabled_ReturnsNull_WithoutCallingGemini()
    {
        var called = false;
        var service = CreateService(_ =>
        {
            called = true;
            return Json(HttpStatusCode.OK, FunctionCallEnvelope("search_halls", new { }));
        }, Settings(s => s.Enabled = false));

        var result = await service.GenerateToolTurnAsync(
            SingleUserMessage("query"),
            "system",
            SampleFunctions(),
            CancellationToken.None);

        Assert.Null(result);
        Assert.False(called);
    }

    [Fact]
    public async Task NoApiKey_ReturnsNull()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK, FunctionCallEnvelope("search_halls", new { })),
            Settings(s => s.ApiKey = ""));

        var result = await service.GenerateToolTurnAsync(
            SingleUserMessage("query"),
            "system",
            SampleFunctions(),
            CancellationToken.None);

        Assert.Null(result);
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest)]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.GatewayTimeout)]
    public async Task HttpFailure_ReturnsNull(HttpStatusCode status)
    {
        var service = CreateService(_ => new HttpResponseMessage(status));

        var result = await service.GenerateToolTurnAsync(
            SingleUserMessage("query"),
            "system",
            SampleFunctions(),
            CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task MalformedJson_ReturnsNull()
    {
        var service = CreateService(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{ broken json", Encoding.UTF8, "application/json")
        });

        var result = await service.GenerateToolTurnAsync(
            SingleUserMessage("query"),
            "system",
            SampleFunctions(),
            CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task EmptyCandidates_ReturnsNull()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK, new { candidates = Array.Empty<object>() }));

        var result = await service.GenerateToolTurnAsync(
            SingleUserMessage("query"),
            "system",
            SampleFunctions(),
            CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task NetworkError_ReturnsNull()
    {
        var service = CreateService(_ => throw new HttpRequestException("connection refused"));

        var result = await service.GenerateToolTurnAsync(
            SingleUserMessage("query"),
            "system",
            SampleFunctions(),
            CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Timeout_ReturnsNull()
    {
        var service = CreateService(_ => throw new TaskCanceledException("client timeout"));

        var result = await service.GenerateToolTurnAsync(
            SingleUserMessage("query"),
            "system",
            SampleFunctions(),
            CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task NormalizesInvalidRoleToUser()
    {
        var capturedContents = JsonNode.Parse("{}")!;
        var service = CreateService(request =>
        {
            capturedContents = JsonSerializer.Deserialize<JsonNode>(RequestBody(request), JsonOpts)!;
            return Json(HttpStatusCode.OK, TextEnvelope("ok"));
        });

        var badRoleMessage = new GeminiConversationMessage("admin", [new GeminiConversationPart(Text: "do something")]);
        await service.GenerateToolTurnAsync([badRoleMessage], "system", SampleFunctions(), CancellationToken.None);

        var firstRole = capturedContents["contents"]![0]!["role"]!.GetValue<string>();
        Assert.Equal("user", firstRole);
    }

    private sealed class FakeHttpHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;

        public FakeHttpHandler(Func<HttpRequestMessage, HttpResponseMessage> responder) => _responder = responder;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(_responder(request));
    }

    private sealed class FakeHttpClientFactory : IHttpClientFactory
    {
        private readonly HttpMessageHandler _handler;

        public FakeHttpClientFactory(HttpMessageHandler handler) => _handler = handler;

        public HttpClient CreateClient(string name) => new(_handler) { Timeout = TimeSpan.FromSeconds(10) };
    }
}