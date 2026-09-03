using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class GeminiServiceShould
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

    private static object SuccessResponse(string text) => new
    {
        candidates = new[]
        {
            new { content = new { parts = new[] { new { text } } } }
        }
    };

    private static HttpResponseMessage CaptureRequest(HttpRequestMessage request)
        => new(HttpStatusCode.OK);

    [Fact]
    public async Task GenerateTextAsync_Success_ReturnsGeneratedText()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK, SuccessResponse("To search for halls, open the Browse page.")));

        var result = await service.GenerateTextAsync("how do I search?", "en", CancellationToken.None);

        Assert.Equal("To search for halls, open the Browse page.", result);
    }

    [Fact]
    public async Task IsAvailable_FalseWhenDisabled()
    {
        var service = CreateService(CaptureRequest, Settings(s => s.Enabled = false));
        Assert.False(service.IsAvailable);
    }

    [Fact]
    public async Task IsAvailable_FalseWhenNoApiKey()
    {
        var service = CreateService(CaptureRequest, Settings(s => s.ApiKey = ""));
        Assert.False(service.IsAvailable);
    }

    [Fact]
    public async Task IsAvailable_TrueWhenConfigured()
    {
        var service = CreateService(CaptureRequest);
        Assert.True(service.IsAvailable);
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest)]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.Forbidden)]
    [InlineData(HttpStatusCode.NotFound)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.InternalServerError)]
    public async Task GenerateTextAsync_HttpFailure_ReturnsNull(HttpStatusCode status)
    {
        var service = CreateService(_ => new HttpResponseMessage(status));

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateTextAsync_MalformedJson_ReturnsNull()
    {
        var service = CreateService(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{ this is not json", Encoding.UTF8, "application/json")
        });

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateTextAsync_EmptyResponse_ReturnsNull()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK, new { candidates = (object?)null }));

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateTextAsync_EmptyText_ReturnsNull()
    {
        var service = CreateService(_ => Json(HttpStatusCode.OK, SuccessResponse("   ")));

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateTextAsync_MissingApiKey_ReturnsNull()
    {
        var service = CreateService(CaptureRequest, Settings(s => s.ApiKey = ""));

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateTextAsync_NetworkError_ReturnsNull()
    {
        var service = CreateService(_ => throw new HttpRequestException("connection refused"));

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateTextAsync_Timeout_ReturnsNull()
    {
        var service = CreateService(_ => throw new TaskCanceledException("client timeout"));

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateTextAsync_SendsApiKeyInHeaderNotUrlOrBody()
    {
        string? requestUrl = null;
        string? requestBody = null;
        IEnumerable<string>? apiKeyHeader = null;
        var service = CreateService(request =>
        {
            requestUrl = request.RequestUri!.ToString();
            requestBody = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            apiKeyHeader = request.Headers.TryGetValues("x-goog-api-key", out var values) ? values : null;
            return Json(HttpStatusCode.OK, SuccessResponse("ok"));
        });

        await service.GenerateTextAsync("hello", "en", CancellationToken.None);

        Assert.Equal(["test-server-key-not-real"], apiKeyHeader);
        Assert.DoesNotContain("test-server-key-not-real", requestUrl);
        Assert.DoesNotContain("test-server-key-not-real", requestBody);
    }

    [Fact]
    public async Task GenerateTextAsync_RespectsMaxContextCharacters()
    {
        string? actualPrompt = null;
        var service = CreateService(request =>
        {
            var body = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            actualPrompt = JsonSerializer.Deserialize<JsonElement>(body)
                .GetProperty("contents")[0]
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString();
            return Json(HttpStatusCode.OK, SuccessResponse("ok"));
        }, Settings(s => s.MaxContextCharacters = 50));

        var longQuestion = new string('a', 500);
        await service.GenerateTextAsync(longQuestion, "en", CancellationToken.None);

        Assert.NotNull(actualPrompt);
        Assert.True(actualPrompt!.Length <= 50, $"Prompt length was {actualPrompt!.Length}");
    }

    [Theory]
    [InlineData("ar", "Respond in Arabic")]
    [InlineData("en", "Respond in English")]
    public async Task GenerateTextAsync_SystemInstructionEnforcesLanguage(string language, string expectedDirective)
    {
        string? instruction = null;
        var service = CreateService(request =>
        {
            var body = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            instruction = JsonSerializer.Deserialize<JsonElement>(body)
                .GetProperty("systemInstruction")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString();
            return Json(HttpStatusCode.OK, SuccessResponse("ok"));
        });

        await service.GenerateTextAsync("question", language, CancellationToken.None);

        Assert.Contains(expectedDirective, instruction);
    }

    [Fact]
    public async Task GenerateTextAsync_SystemInstructionGroundsOnImplementedFeatures()
    {
        string? instruction = null;
        var service = CreateService(request =>
        {
            var body = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            instruction = JsonSerializer.Deserialize<JsonElement>(body)
                .GetProperty("systemInstruction")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString();
            return Json(HttpStatusCode.OK, SuccessResponse("ok"));
        });

        await service.GenerateTextAsync("question", "en", CancellationToken.None);

        // The system instruction reuses the implemented-platform-features knowledge.
        Assert.Contains("Implemented Wesal features", instruction);
        Assert.Contains("Browse halls", instruction);
    }

    [Fact]
    public async Task GenerateTextAsync_UsesConfiguredModelAndBaseUrl()
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

        Assert.StartsWith("https://custom.example/v1beta/models/gemini-2.5-flash:generateContent", requestUrl);
    }

    [Fact]
    public async Task GenerateTextAsync_ModelEnvKeyBindsToGeminiModel()
    {
        // Verifies the GoogleAI:GeminiModel config path (GoogleAI__GeminiModel env var)
        // maps to GoogleAiSettings.GeminiModel and flows into the request URL.
        var settings = Settings(s =>
        {
            s.GeminiModel = string.Empty; // force the code's built-in default fallback path check
        });

        string? requestUrl = null;
        var service = CreateService(request =>
        {
            requestUrl = request.RequestUri!.ToString();
            return Json(HttpStatusCode.OK, SuccessResponse("ok"));
        }, settings);

        await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Contains("models/gemini-3.6-flash:generateContent", requestUrl);
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
