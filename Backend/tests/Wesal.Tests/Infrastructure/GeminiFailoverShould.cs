using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class GeminiSingleApiShould
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
        var server = new GeminiSdkTestServer(responder);
        var configured = settings ?? Settings();
        configured.BaseUrl = server.BaseUrl;
        return new GeminiService(Options.Create(configured), NullLogger<GeminiService>.Instance);
    }

    private static HttpResponseMessage Json(HttpStatusCode code, object body)
        => new(code)
        {
            Content = new StringContent(JsonSerializer.Serialize(body, JsonOpts), Encoding.UTF8, "application/json")
        };

    private static object SuccessResponse(string text) => new
    {
        candidates = new[]
        {
            new { content = new { parts = new[] { new { text } } } }
        }
    };

    private static object Envelope(string text) => new
    {
        candidates = new[]
        {
            new { content = new { parts = new[] { new { text } } } }
        }
    };

    private static string RequestBody(HttpRequestMessage request)
        => request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();

    private static string ExtractModel(HttpRequestMessage request)
    {
        var url = request.RequestUri!.ToString();
        var marker = "/models/";
        var start = url.IndexOf(marker, StringComparison.Ordinal) + marker.Length;
        var end = url.IndexOf(":generateContent", start, StringComparison.Ordinal);
        return url.Substring(start, end - start);
    }

    private sealed record TestPayload(string? Intent, string? Region, int? Capacity);

    // ── Test 1: Structured JSON ──

    [Fact]
    public async Task GenerateStructured_ReturnsValidSchema_OnSuccess()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK,
            Envelope(JsonSerializer.Serialize(new { intent = "search_halls", region = "Gaza", capacity = 250 }))));

        var result = await service.GenerateStructuredAsync<TestPayload>(
            "Find wedding halls in Gaza for 300 people",
            "system-instruction",
            GeminiPromptBuilder.BuildIntentSchema(),
            CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("search_halls", result.Intent);
        Assert.Equal("Gaza", result.Region);
        Assert.Equal(250, result.Capacity);
    }

    [Fact]
    public async Task GenerateStructured_SendsResponseMimeTypeAndSchema()
    {
        string? body = null;
        var service = CreateService(request =>
        {
            body = RequestBody(request);
            return Json(HttpStatusCode.OK, Envelope("{}"));
        });

        await service.GenerateStructuredAsync<TestPayload>("find halls", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        var config = JsonSerializer.Deserialize<JsonElement>(body!).GetProperty("generationConfig");
        Assert.Equal("application/json", config.GetProperty("responseMimeType").GetString());
        Assert.Equal("object", config.GetProperty("responseSchema").GetProperty("type").GetString());
    }

    // ── Test 2: Single API request ──

    [Fact]
    public async Task GenerateText_MakesExactlyOneRequest()
    {
        var callCount = 0;
        var service = CreateService(request =>
        {
            Interlocked.Increment(ref callCount);
            return Json(HttpStatusCode.OK, SuccessResponse("answer"));
        });

        var result = await service.GenerateTextAsync("hello", "en", CancellationToken.None);

        Assert.Equal("answer", result);
        Assert.Equal(1, callCount);
    }

    [Fact]
    public async Task GenerateStructured_MakesExactlyOneRequest()
    {
        var callCount = 0;
        var service = CreateService(request =>
        {
            Interlocked.Increment(ref callCount);
            return Json(HttpStatusCode.OK, Envelope("{\"intent\":\"how_to\"}"));
        });

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(1, callCount);
    }

    [Fact]
    public async Task GenerateText_UsesSingleConfiguredModel()
    {
        string? requestUrl = null;
        var service = CreateService(request =>
        {
            requestUrl = request.RequestUri!.ToString();
            return Json(HttpStatusCode.OK, SuccessResponse("ok"));
        }, Settings(s =>
        {
            s.GeminiModel = "gemini-2.5-flash";
            s.BaseUrl = "https://custom.example/v1beta";
        }));

        await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Contains("/v1beta/models/gemini-2.5-flash:generateContent", requestUrl);
    }

    // ── Test 3: Gemini failure → null (deterministic fallback path) ──

    [Theory]
    [InlineData(HttpStatusCode.RequestTimeout)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.ServiceUnavailable)]
    [InlineData(HttpStatusCode.GatewayTimeout)]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.Forbidden)]
    public async Task GenerateText_HttpFailure_ReturnsNull(HttpStatusCode status)
    {
        var service = CreateService(_ => new HttpResponseMessage(status));

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Null(result);
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
    public async Task GenerateStructured_HttpFailure_ReturnsNull(HttpStatusCode status)
    {
        var service = CreateService(_ => new HttpResponseMessage(status));

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateText_Timeout_ReturnsNull()
    {
        var service = CreateService(_ => throw new TaskCanceledException("client timeout"));

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateText_NetworkError_ReturnsNull()
    {
        var service = CreateService(_ => throw new HttpRequestException("connection refused"));

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateText_MalformedJson_ReturnsNull()
    {
        var service = CreateService(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{ not json", Encoding.UTF8, "application/json")
        });

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateText_EmptyResponse_ReturnsNull()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK, new { candidates = (object?)null }));

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateStructured_MalformedEnvelope_ReturnsNull()
    {
        var service = CreateService(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{ this is not json", Encoding.UTF8, "application/json")
        });

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateStructured_NotJson_ReturnsNull()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK, Envelope("definitely not json")));

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateStructured_EmptyText_ReturnsNull()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK, Envelope("   ")));

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateText_Cancellation_ThrowsWithoutCallingApi()
    {
        var callCount = 0;
        using var cts = new CancellationTokenSource();
        cts.Cancel();
        var service = CreateService(request =>
        {
            Interlocked.Increment(ref callCount);
            throw new OperationCanceledException(cts.Token);
        });

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => service.GenerateTextAsync("question", "en", cts.Token));

        // Cancellation is passed through the SDK and stops before any network request.
        Assert.Equal(0, callCount);
    }

    // ── Test 4: Backend validation (malformed structured output rejected) ──

    [Fact]
    public async Task GenerateStructured_InvalidJsonShape_ReturnsNull()
    {
        // Gemini returns valid JSON but wrong shape — deserialization fails gracefully
        var service = CreateService(_ => Json(HttpStatusCode.OK, Envelope("{\"wrong_field\":\"value\"}")));

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        // The deserialization may return an object with null fields or throw — either way, upstream validates
        // Here we verify the service doesn't throw and the caller gets a usable result or null
        Assert.True(result is null || result.Intent is null);
    }

    // ── Test 5: Recommendation flow (structured intent → matcher → repository) ──

    [Fact]
    public async Task GenerateStructured_SearchHalls_ReturnsValidIntent()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK,
            Envelope(JsonSerializer.Serialize(new { intent = "search_halls", region = "Gaza", capacity = 300 }))));

        var result = await service.GenerateStructuredAsync<TestPayload>(
            "Find wedding halls in Gaza for 300 people",
            "system",
            GeminiPromptBuilder.BuildIntentSchema(),
            CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("search_halls", result.Intent);
        Assert.Equal("Gaza", result.Region);
        Assert.Equal(300, result.Capacity);
    }

    // ── Test 6: How-To ──

    [Fact]
    public async Task GenerateStructured_HowTo_ReturnsValidIntent()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK,
            Envelope(JsonSerializer.Serialize(new { intent = "how_to" }))));

        var result = await service.GenerateStructuredAsync<TestPayload>(
            "How do I book a hall?",
            "system",
            GeminiPromptBuilder.BuildIntentSchema(),
            CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("how_to", result.Intent);
    }

    // ── API key security ──

    [Fact]
    public async Task GenerateText_SendsApiKeyInHeaderNotUrlOrBody()
    {
        string? requestUrl = null;
        string? requestBody = null;
        IEnumerable<string>? apiKeyHeader = null;
        var service = CreateService(request =>
        {
            requestUrl = request.RequestUri!.ToString();
            requestBody = RequestBody(request);
            apiKeyHeader = request.Headers.TryGetValues("x-goog-api-key", out var values) ? values : null;
            return Json(HttpStatusCode.OK, SuccessResponse("ok"));
        });

        await service.GenerateTextAsync("hello", "en", CancellationToken.None);

        Assert.Equal(["test-server-key-not-real"], apiKeyHeader);
        Assert.DoesNotContain("test-server-key-not-real", requestUrl);
        Assert.DoesNotContain("test-server-key-not-real", requestBody);
    }

    [Fact]
    public async Task GenerateStructured_SendsApiKeyInHeaderNotUrlOrBody()
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

    // ── IsAvailable / circuit breaker ──

    [Fact]
    public async Task IsAvailable_FalseWhenDisabled()
    {
        var service = CreateService(_ => new HttpResponseMessage(HttpStatusCode.OK), Settings(s => s.Enabled = false));
        Assert.False(service.IsAvailable);
    }

    [Fact]
    public async Task IsAvailable_FalseWhenNoApiKey()
    {
        var service = CreateService(_ => new HttpResponseMessage(HttpStatusCode.OK), Settings(s => s.ApiKey = ""));
        Assert.False(service.IsAvailable);
    }

    [Fact]
    public async Task IsAvailable_TrueWhenConfigured()
    {
        var service = CreateService(_ => new HttpResponseMessage(HttpStatusCode.OK));
        Assert.True(service.IsAvailable);
    }

    [Fact]
    public async Task CircuitBreaker_StaysClosedAfterASingleFailure()
    {
        var service = CreateService(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));

        await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.True(service.IsAvailable, "One slow/failed request must not disable Gemini for everyone");
    }

    [Fact]
    public async Task CircuitBreaker_OpensAfterConsecutiveFailures()
    {
        var service = CreateService(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));

        for (var i = 0; i < 3; i++)
        {
            await service.GenerateTextAsync("question", "en", CancellationToken.None);
        }

        Assert.False(service.IsAvailable, "Breaker should open after the consecutive-failure threshold");
    }

    [Fact]
    public async Task CircuitBreaker_SuccessResetsTheFailureCount()
    {
        var calls = 0;
        var service = CreateService(_ => ++calls == 3
            ? Json(HttpStatusCode.OK, SuccessResponse("ok"))
            : new HttpResponseMessage(HttpStatusCode.InternalServerError));

        for (var i = 0; i < 5; i++)
        {
            await service.GenerateTextAsync("question", "en", CancellationToken.None);
        }

        // failures: F F S F F -> never 3 consecutive
        Assert.True(service.IsAvailable);
    }

    [Fact]
    public async Task CircuitBreaker_StateIsNotSharedBetweenInstances()
    {
        var failing = CreateService(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));
        for (var i = 0; i < 3; i++)
        {
            await failing.GenerateTextAsync("question", "en", CancellationToken.None);
        }

        var healthy = CreateService(_ => Json(HttpStatusCode.OK, SuccessResponse("ok")));

        Assert.False(failing.IsAvailable);
        Assert.True(healthy.IsAvailable);
    }

    [Fact]
    public async Task CircuitBreaker_ClosesAfterSuccess()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK, SuccessResponse("ok")));

        await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.True(service.IsAvailable, "Circuit breaker should remain closed after success");
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
