using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class GeminiStructuredOutputShould
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

    private static IGeminiService CreateService(
        Func<HttpRequestMessage, HttpResponseMessage> responder,
        GoogleAiSettings? settings = null)
    {
        var handler = new FakeHttpHandler(responder);
        var factory = new FakeHttpClientFactory(handler);
        return new GeminiService(factory, Options.Create(settings ?? Settings()), NullLogger<GeminiService>.Instance);
    }

    private static HttpResponseMessage Json(HttpStatusCode code, object body)
        => new(code)
        {
            Content = new StringContent(JsonSerializer.Serialize(body, JsonOpts), Encoding.UTF8, "application/json")
        };

    private static object Envelope(string text) => new
    {
        candidates = new[]
        {
            new { content = new { parts = new[] { new { text } } } }
        }
    };

    private sealed record TestPayload(string? Intent, string? Region, int? Capacity);

    private static string RequestBody(HttpRequestMessage request)
        => request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();

    [Fact]
    public async Task ReturnsDeserializedPayload_OnSuccess()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK,
            Envelope(JsonSerializer.Serialize(new { intent = "search_halls", region = "Gaza", capacity = 250 }))));

        var result = await service.GenerateStructuredAsync<TestPayload>(
            "أريد قاعة في غزة",
            "system-instruction",
            GeminiPromptBuilder.BuildIntentSchema(),
            CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("search_halls", result.Intent);
        Assert.Equal("Gaza", result.Region);
        Assert.Equal(250, result.Capacity);
    }

    [Fact]
    public async Task SendsResponseMimeTypeAndSchema_InGenerationConfig()
    {
        string? body = null;
        var service = CreateService(request =>
        {
            body = RequestBody(request);
            return Json(HttpStatusCode.OK, Envelope("{}"));
        });

        await service.GenerateStructuredAsync<TestPayload>("find halls", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        var config = JsonSerializer.Deserialize<JsonElement>(body!)
            .GetProperty("generationConfig");

        Assert.Equal("application/json", config.GetProperty("responseMimeType").GetString());

        var schema = config.GetProperty("responseSchema");
        Assert.Equal("object", schema.GetProperty("type").GetString());
        var intentEnum = schema.GetProperty("properties").GetProperty("intent").GetProperty("enum");
        var values = intentEnum.EnumerateArray().Select(e => e.GetString()).ToList();
        Assert.Contains("search_halls", values);
        Assert.Contains("unknown", values);
    }

    [Fact]
    public async Task SendsProvidedSystemInstruction_Verbatim()
    {
        string? instruction = null;
        var service = CreateService(request =>
        {
            instruction = JsonSerializer.Deserialize<JsonElement>(RequestBody(request))
                .GetProperty("systemInstruction")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString();
            return Json(HttpStatusCode.OK, Envelope("{}"));
        });

        await service.GenerateStructuredAsync<TestPayload>("query", "CUSTOM-SYSTEM-INSTRUCTION", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.Equal("CUSTOM-SYSTEM-INSTRUCTION", instruction);
    }

    [Fact]
    public async Task SendsApiKeyInHeader_NotInUrlOrBody()
    {
        string? requestUrl = null;
        string? requestBody = null;
        IEnumerable<string>? apiKeyHeader = null;
        var service = CreateService(request =>
        {
            requestUrl = request.RequestUri!.ToString();
            requestBody = RequestBody(request);
            apiKeyHeader = request.Headers.TryGetValues("x-goog-api-key", out var values) ? values : null;
            return Json(HttpStatusCode.OK, Envelope("{}"));
        });

        await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.Equal(["test-server-key-not-real"], apiKeyHeader);
        Assert.DoesNotContain("test-server-key-not-real", requestUrl);
        Assert.DoesNotContain("test-server-key-not-real", requestBody);
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest)]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.Forbidden)]
    [InlineData(HttpStatusCode.NotFound)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.ServiceUnavailable)]
    [InlineData(HttpStatusCode.GatewayTimeout)]
    public async Task HttpFailure_ReturnsNull(HttpStatusCode status)
    {
        var service = CreateService(_ => new HttpResponseMessage(status));

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task MalformedEnvelope_ReturnsNull()
    {
        var service = CreateService(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{ this is not json", Encoding.UTF8, "application/json")
        });

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task StructuredOutputNotJson_ReturnsNull()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK, Envelope("definitely not json")));

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task EmptyText_ReturnsNull()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK, Envelope("   ")));

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Disabled_ReturnsNull_WithoutCallingGemini()
    {
        var called = false;
        var service = CreateService(_ =>
        {
            called = true;
            return Json(HttpStatusCode.OK, Envelope("{}"));
        }, Settings(s => s.Enabled = false));

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.Null(result);
        Assert.False(called);
    }

    [Fact]
    public async Task NoApiKey_ReturnsNull()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK, Envelope("{}")), Settings(s => s.ApiKey = ""));

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task NetworkError_ReturnsNull()
    {
        var service = CreateService(_ => throw new HttpRequestException("connection refused"));

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Timeout_ReturnsNull()
    {
        var service = CreateService(_ => throw new TaskCanceledException("client timeout"));

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public void Schema_RequiresIntent_AndCoversAllIntents()
    {
        var schema = GeminiPromptBuilder.BuildIntentSchema();

        var required = schema["required"]!.AsArray().Select(n => n!.GetValue<string>()).ToList();
        Assert.Contains("intent", required);

        var intentEnum = schema["properties"]!["intent"]!["enum"]!.AsArray()
            .Select(n => n!.GetValue<string>())
            .ToList();

        Assert.Contains("search_halls", intentEnum);
        Assert.Contains("get_hall_details", intentEnum);
        Assert.Contains("check_hall_availability", intentEnum);
        Assert.Contains("get_featured_halls", intentEnum);
        Assert.Contains("how_to", intentEnum);
        Assert.Contains("unsupported", intentEnum);
        Assert.Contains("unknown", intentEnum);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("ar")]
    [InlineData("en")]
    public void IntentSystemInstruction_ContainsInjectionDefense(string? language)
    {
        var instruction = GeminiPromptBuilder.BuildIntentSystemInstruction(language!);

        Assert.Contains("intent", instruction);
        Assert.Contains("schema", instruction);
        Assert.Contains("ignore", instruction);
        Assert.Contains("never guess", instruction, StringComparison.OrdinalIgnoreCase);
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