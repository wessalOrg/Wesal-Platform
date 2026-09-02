using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class HowToServiceGeminiShould
{
    private static ISubscriptionPaymentService CreatePaymentService()
        => new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions()));

    [Fact]
    public async Task AskHowTo_GeminiAvailableAndSucceeds_ReturnsGeminiAnswer()
    {
        var gemini = new FakeGeminiService { Available = true, Result = "Gemini says: use the Browse page." };
        var service = new HowToService(CreatePaymentService(), geminiService: gemini);

        var result = await service.AskHowToAsync("how do I search for halls?", "en", CancellationToken.None);

        Assert.Equal("Gemini says: use the Browse page.", result.Answer);
        Assert.True(gemini.Called);
    }

    [Fact]
    public async Task AskHowTo_GeminiFails_ReturnsDeterministicFallback()
    {
        var gemini = new FakeGeminiService { Available = true, Result = null };
        var service = new HowToService(CreatePaymentService(), geminiService: gemini);

        var result = await service.AskHowToAsync("how do I search for halls?", "en", CancellationToken.None);

        Assert.True(gemini.Called);
        Assert.Contains("Browse", result.Answer);
        Assert.Contains("search", result.Category, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AskHowTo_GeminiUnavailable_SkipsGeminiAndFallsBack()
    {
        var gemini = new FakeGeminiService { Available = false, Result = "should not be used" };
        var service = new HowToService(CreatePaymentService(), geminiService: gemini);

        var result = await service.AskHowToAsync("how do I book a hall?", "en", CancellationToken.None);

        Assert.False(gemini.Called);
        Assert.Contains("booking", result.Category, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AskHowTo_NoGeminiConfigured_FallsBackToRuleBased()
    {
        var service = new HowToService(CreatePaymentService());

        var result = await service.AskHowToAsync("how do I search for halls?", "en", CancellationToken.None);

        Assert.Contains("Browse", result.Answer);
        Assert.Contains("search", result.Category, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AskHowTo_PaymentIntent_StillUsesTrustedBackendEvenWhenGeminiAvailable()
    {
        var gemini = new FakeGeminiService { Available = true, Result = "Gemini payment answer" };
        var service = new HowToService(CreatePaymentService(), geminiService: gemini);

        var result = await service.AskHowToAsync("how do I pay my subscription?", "en", CancellationToken.None);

        Assert.False(gemini.Called);
        Assert.Contains("payment", result.Category, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("120", result.Answer);
    }

    private sealed class FakeGeminiService : IGeminiService
    {
        public bool Available { get; set; }
        public string? Result { get; set; }
        public bool Called { get; set; }

        public bool IsAvailable => Available;

        public Task<string?> GenerateTextAsync(string prompt, string language, CancellationToken cancellationToken = default)
        {
            Called = true;
            return Task.FromResult(Result);
        }

        public Task<T?> GenerateStructuredAsync<T>(string prompt, string systemInstruction, System.Text.Json.Nodes.JsonNode responseSchema, CancellationToken cancellationToken = default)
            where T : class
            => Task.FromResult<T?>(null);
    }
}
