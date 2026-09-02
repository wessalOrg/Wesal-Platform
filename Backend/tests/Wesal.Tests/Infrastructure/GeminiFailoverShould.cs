using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class GeminiFailoverShould
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private static GoogleAiSettings Settings(Action<GoogleAiSettings>? configure = null)
    {
        var settings = new GoogleAiSettings
        {
            ApiKey = "primary-server-key-not-real",
            GeminiModel = "gemini-3.6-flash",
            ApiKey2 = "secondary-server-key-not-real",
            GeminiModel2 = "gemini-3.6-flash",
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

    private static object SuccessResponse(string text) => new
    {
        candidates = new[]
        {
            new { content = new { parts = new[] { new { text } } } }
        }
    };

    private static string RequestBody(HttpRequestMessage request)
        => request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();

    private static void AssertApiKey(HttpRequestMessage request, string expectedKey)
    {
        var values = request.Headers.TryGetValues("x-goog-api-key", out var v) ? v : null;
        Assert.Equal([expectedKey], values);
    }

    private static void AssertModelAndKey(HttpRequestMessage request, string expectedModel, string expectedKey)
    {
        Assert.Contains($"/models/{expectedModel}:generateContent", request.RequestUri!.ToString());
        AssertApiKey(request, expectedKey);
    }

    private static void AssertStructuredConfig(HttpRequestMessage request)
    {
        var config = JsonSerializer.Deserialize<JsonElement>(RequestBody(request)).GetProperty("generationConfig");
        Assert.Equal("application/json", config.GetProperty("responseMimeType").GetString());
        Assert.Equal("object", config.GetProperty("responseSchema").GetProperty("type").GetString());
    }

    [Fact]
    public async Task GenerateText_PrimarySuccess_DoesNotUseSecondary()
    {
        var primaryCalls = 0;
        var secondaryCalls = 0;
        var service = CreateService(request =>
        {
            if (request.Headers.TryGetValues("x-goog-api-key", out var keys) && keys.Contains("secondary-server-key-not-real"))
            {
                secondaryCalls++;
            }
            else
            {
                primaryCalls++;
            }
            return Json(HttpStatusCode.OK, SuccessResponse("primary answer"));
        });

        var result = await service.GenerateTextAsync("hello", "en", CancellationToken.None);

        Assert.Equal("primary answer", result);
        Assert.Equal(1, primaryCalls);
        Assert.Equal(0, secondaryCalls);
    }

    [Theory]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.ServiceUnavailable)]
    [InlineData(HttpStatusCode.GatewayTimeout)]
    public async Task GenerateText_RecoverableHttpFailure_FailsOverToSecondary(HttpStatusCode status)
    {
        var primaryCalls = 0;
        var secondaryCalls = 0;
        var service = CreateService(request =>
        {
            if (request.Headers.TryGetValues("x-goog-api-key", out var keys) && keys.Contains("secondary-server-key-not-real"))
            {
                secondaryCalls++;
                return Json(HttpStatusCode.OK, SuccessResponse("secondary answer"));
            }
            primaryCalls++;
            return new HttpResponseMessage(status);
        });

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Equal("secondary answer", result);
        Assert.Equal(1, primaryCalls);
        Assert.Equal(1, secondaryCalls);
    }

    [Fact]
    public async Task GenerateText_Timeout_FailsOverToSecondary()
    {
        var primaryCalls = 0;
        var secondaryCalls = 0;
        var service = CreateService(request =>
        {
            if (request.Headers.TryGetValues("x-goog-api-key", out var keys) && keys.Contains("secondary-server-key-not-real"))
            {
                secondaryCalls++;
                return Json(HttpStatusCode.OK, SuccessResponse("secondary answer"));
            }
            primaryCalls++;
            throw new TaskCanceledException("client timeout");
        });

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Equal("secondary answer", result);
        Assert.Equal(1, primaryCalls);
        Assert.Equal(1, secondaryCalls);
    }

    [Fact]
    public async Task GenerateText_NetworkError_FailsOverToSecondary()
    {
        var secondaryCalls = 0;
        var service = CreateService(request =>
        {
            if (request.Headers.TryGetValues("x-goog-api-key", out var keys) && keys.Contains("secondary-server-key-not-real"))
            {
                secondaryCalls++;
                return Json(HttpStatusCode.OK, SuccessResponse("secondary answer"));
            }
            throw new HttpRequestException("connection refused");
        });

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Equal("secondary answer", result);
        Assert.Equal(1, secondaryCalls);
    }

    [Fact]
    public async Task GenerateText_MalformedPrimary_FailsOverToSecondary()
    {
        var secondaryCalls = 0;
        var service = CreateService(request =>
        {
            if (request.Headers.TryGetValues("x-goog-api-key", out var keys) && keys.Contains("secondary-server-key-not-real"))
            {
                secondaryCalls++;
                return Json(HttpStatusCode.OK, SuccessResponse("secondary answer"));
            }
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{ not json", Encoding.UTF8, "application/json")
            };
        });

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Equal("secondary answer", result);
        Assert.Equal(1, secondaryCalls);
    }

    [Fact]
    public async Task GenerateText_PermanentBadRequest_DoesNotDuplicateToSecondary()
    {
        var secondaryCalls = 0;
        var service = CreateService(request =>
        {
            if (request.Headers.TryGetValues("x-goog-api-key", out var keys) && keys.Contains("secondary-server-key-not-real"))
            {
                secondaryCalls++;
            }
            return new HttpResponseMessage(HttpStatusCode.BadRequest);
        });

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Null(result);
        Assert.Equal(0, secondaryCalls);
    }

    [Fact]
    public async Task GenerateText_BothFail_ReturnsNull()
    {
        var service = CreateService(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateText_Cancellation_DoesNotUseSecondary()
    {
        var secondaryCalls = 0;
        using var cts = new CancellationTokenSource();
        cts.Cancel();
        var service = CreateService(request =>
        {
            if (request.Headers.TryGetValues("x-goog-api-key", out var keys) && keys.Contains("secondary-server-key-not-real"))
            {
                secondaryCalls++;
            }
            throw new OperationCanceledException(cts.Token);
        });

        await Assert.ThrowsAsync<OperationCanceledException>(
            () => service.GenerateTextAsync("question", "en", cts.Token));

        Assert.Equal(0, secondaryCalls);
    }

    [Fact]
    public async Task GenerateText_PrimaryOnly_NoSecondaryConfigured_NormalBehavior()
    {
        var service = CreateService(
            request => Json(HttpStatusCode.OK, SuccessResponse("primary only")),
            Settings(s => s.ApiKey2 = ""));

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Equal("primary only", result);
    }

    [Fact]
    public async Task GenerateStructured_RecoverableHttpFailure_FailsOverToSecondary_WithSameSchema()
    {
        var primaryModel = string.Empty;
        var secondaryModel = string.Empty;
        bool secondarySchemaOk = false;
        var service = CreateService(request =>
        {
            if (request.Headers.TryGetValues("x-goog-api-key", out var keys) && keys.Contains("secondary-server-key-not-real"))
            {
                secondaryModel = ExtractModel(request);
                var config = JsonSerializer.Deserialize<JsonElement>(RequestBody(request)).GetProperty("generationConfig");
                secondarySchemaOk = config.GetProperty("responseMimeType").GetString() == "application/json"
                    && config.GetProperty("responseSchema").GetProperty("type").GetString() == "object";
                return Json(HttpStatusCode.OK, Envelope("{\"intent\":\"search_halls\"}"));
            }
            primaryModel = ExtractModel(request);
            return new HttpResponseMessage(HttpStatusCode.TooManyRequests);
        }, Settings(s =>
        {
            s.GeminiModel = "gemini-3.6-flash";
            s.GeminiModel2 = "gemini-2.5-flash";
        }));

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("search_halls", result.Intent);
        Assert.Equal("gemini-3.6-flash", primaryModel);
        Assert.Equal("gemini-2.5-flash", secondaryModel);
        Assert.True(secondarySchemaOk, "Secondary attempt must send responseMimeType=application/json and the same responseSchema.");
    }

    [Fact]
    public async Task GenerateStructured_InvalidOutput_FailsOverToSecondary()
    {
        var secondaryCalls = 0;
        var service = CreateService(request =>
        {
            if (request.Headers.TryGetValues("x-goog-api-key", out var keys) && keys.Contains("secondary-server-key-not-real"))
            {
                secondaryCalls++;
                return Json(HttpStatusCode.OK, Envelope("{\"intent\":\"how_to\"}"));
            }
            return Json(HttpStatusCode.OK, Envelope("not valid json"));
        });

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("how_to", result.Intent);
        Assert.Equal(1, secondaryCalls);
    }

    [Fact]
    public async Task GenerateStructured_PermanentBadRequest_DoesNotDuplicateToSecondary()
    {
        var secondaryCalls = 0;
        var service = CreateService(request =>
        {
            if (request.Headers.TryGetValues("x-goog-api-key", out var keys) && keys.Contains("secondary-server-key-not-real"))
            {
                secondaryCalls++;
            }
            return new HttpResponseMessage(HttpStatusCode.BadRequest);
        });

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.Null(result);
        Assert.Equal(0, secondaryCalls);
    }

    [Fact]
    public async Task GenerateStructured_PrimarySuccess_NoSecondary()
    {
        var secondaryCalls = 0;
        var service = CreateService(request =>
        {
            if (request.Headers.TryGetValues("x-goog-api-key", out var keys) && keys.Contains("secondary-server-key-not-real"))
            {
                secondaryCalls++;
            }
            return Json(HttpStatusCode.OK, Envelope("{\"intent\":\"search_halls\"}"));
        });

        var result = await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(0, secondaryCalls);
    }

    [Fact]
    public async Task GenerateStructured_SecondaryUsed_SendsApiKeyInHeaderNotUrlOrBody()
    {
        string? secondaryUrl = null;
        string? secondaryBody = null;
        IEnumerable<string>? secondaryKeyHeader = null;
        var service = CreateService(request =>
        {
            if (request.Headers.TryGetValues("x-goog-api-key", out var keys) && keys.Contains("secondary-server-key-not-real"))
            {
                secondaryUrl = request.RequestUri!.ToString();
                secondaryBody = RequestBody(request);
                secondaryKeyHeader = keys;
                return Json(HttpStatusCode.OK, Envelope("{\"intent\":\"search_halls\"}"));
            }
            return new HttpResponseMessage(HttpStatusCode.InternalServerError);
        });

        await service.GenerateStructuredAsync<TestPayload>("query", "system", GeminiPromptBuilder.BuildIntentSchema(), CancellationToken.None);

        Assert.Equal(["secondary-server-key-not-real"], secondaryKeyHeader);
        Assert.DoesNotContain("secondary-server-key-not-real", secondaryUrl);
        Assert.DoesNotContain("secondary-server-key-not-real", secondaryBody);
    }

    [Fact]
    public async Task GenerateText_SecondaryUsed_UsesSecondaryModelInUrl()
    {
        string? primaryUrl = null;
        string? secondaryUrl = null;
        var service = CreateService(request =>
        {
            if (request.Headers.TryGetValues("x-goog-api-key", out var keys) && keys.Contains("secondary-server-key-not-real"))
            {
                secondaryUrl = request.RequestUri!.ToString();
                return Json(HttpStatusCode.OK, SuccessResponse("secondary answer"));
            }
            primaryUrl = request.RequestUri!.ToString();
            return new HttpResponseMessage(HttpStatusCode.InternalServerError);
        }, Settings(s => s.GeminiModel2 = "gemini-2.5-flash"));

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("/models/gemini-3.6-flash:generateContent", primaryUrl);
        Assert.Contains("/models/gemini-2.5-flash:generateContent", secondaryUrl);
    }

    [Fact]
    public async Task ConfigBinding_SecondaryEnvVars_PopulateSecondarySettings()
    {
        // Guards against the production regression where GoogleAI__ApiKey_2 /
        // GoogleAI__GeminiModel_2 did not bind to the settings object, leaving the
        // failover path inactive. The binder must map the underscored key names.
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GoogleAI:ApiKey"] = "primary-key",
                ["GoogleAI:GeminiModel"] = "gemini-3.6-flash",
                ["GoogleAI:ApiKey_2"] = "secondary-key",
                ["GoogleAI:GeminiModel_2"] = "gemini-2.5-flash",
                ["GoogleAI:Enabled"] = "true"
            })
            .Build();

        var settings = config.GetSection(GoogleAiSettings.SectionName).Get<GoogleAiSettings>()!;

        Assert.Equal("secondary-key", settings.ApiKey2);
        Assert.Equal("gemini-2.5-flash", settings.GeminiModel2);
    }

    [Fact]
    public async Task GenerateText_FailsOver_WhenSecondaryBoundFromConfig()
    {
        // End-to-end check through the binder: a 401 on the primary must switch to
        // the secondary key that was bound from the GoogleAI__ApiKey_2 config path.
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GoogleAI:ApiKey"] = "primary-key",
                ["GoogleAI:GeminiModel"] = "gemini-3.6-flash",
                ["GoogleAI:ApiKey_2"] = "secondary-key",
                ["GoogleAI:GeminiModel_2"] = "gemini-3.6-flash",
                ["GoogleAI:Enabled"] = "true"
            })
            .Build();
        var settings = config.GetSection(GoogleAiSettings.SectionName).Get<GoogleAiSettings>()!;

        var secondaryCalls = 0;
        var handler = new FakeHttpHandler(request =>
        {
            if (request.Headers.TryGetValues("x-goog-api-key", out var keys) && keys.Contains("secondary-key"))
            {
                secondaryCalls++;
                return Json(HttpStatusCode.OK, SuccessResponse("secondary answer"));
            }
            return new HttpResponseMessage(HttpStatusCode.Unauthorized);
        });
        var factory = new FakeHttpClientFactory(handler);
        var service = new GeminiService(factory, Options.Create(settings), NullLogger<GeminiService>.Instance);

        var result = await service.GenerateTextAsync("question", "en", CancellationToken.None);

        Assert.Equal("secondary answer", result);
        Assert.Equal(1, secondaryCalls);
    }

    private static string ExtractModel(HttpRequestMessage request)
    {
        var url = request.RequestUri!.ToString();
        var marker = "/models/";
        var start = url.IndexOf(marker, StringComparison.Ordinal) + marker.Length;
        var end = url.IndexOf(":generateContent", start, StringComparison.Ordinal);
        return url.Substring(start, end - start);
    }

    private static object Envelope(string text) => new
    {
        candidates = new[]
        {
            new { content = new { parts = new[] { new { text } } } }
        }
    };

    private sealed record TestPayload(string? Intent, string? Region, int? Capacity);

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
