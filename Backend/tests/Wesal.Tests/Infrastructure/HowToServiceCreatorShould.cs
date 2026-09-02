using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class HowToServiceCreatorShould
{
    private const string ExpectedEnglish =
        "Wesal Platform was developed by the Wesal team, which includes backend and frontend developers, UX/UI designers, and a QA engineer, led by Mohammed Shamaa as the Team Leader and Backend Developer.";

    private static ISubscriptionPaymentService CreatePaymentService()
        => new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions()));

    [Theory]
    [InlineData("Who is your creator?")]
    [InlineData("who created wesal?")]
    [InlineData("Who developed this platform?")]
    [InlineData("who made wesal")]
    [InlineData("Who is the team leader of wesal?")]
    [InlineData("Tell me about Mohammed Shamaa")]
    public async Task CreatorQuestion_English_ReturnsExactEnglishAttribution(string question)
    {
        // No Gemini configured -> must come from the deterministic creator handler.
        var service = new HowToService(CreatePaymentService());

        var result = await service.AskHowToAsync(question, "en", CancellationToken.None);

        Assert.Equal(ExpectedEnglish, result.Answer);
    }

    [Theory]
    [InlineData("من هو منشئ وصال؟")]
    [InlineData("من أنشأ منصة وصال؟")]
    [InlineData("من هو قائد الفريق؟")]
    [InlineData("من صنع وصال")]
    [InlineData("من هو المطور محمد شمعة؟")]
    [InlineData("من هم فريق وصال؟")]
    public async Task CreatorQuestion_Arabic_ReturnsExactArabicAttribution(string question)
    {
        var service = new HowToService(CreatePaymentService());

        var result = await service.AskHowToAsync(question, "ar", CancellationToken.None);

        Assert.Contains("فريق وصال", result.Answer);
        Assert.Contains("محمد شمعة", result.Answer);
        Assert.Contains("قائد الفريق", result.Answer);
        Assert.Contains("مطور", result.Answer);
    }

    [Fact]
    public async Task CreatorQuestion_ReturnsEnglishWhenDetected_EvenIfSiteLanguageArabic()
    {
        var service = new HowToService(CreatePaymentService());

        // Detected language from the Arabic-detector: English text -> "en"
        var result = await service.AskHowToAsync("Who is your creator?", "ar", CancellationToken.None);

        Assert.Equal(ExpectedEnglish, result.Answer);
    }

    [Fact]
    public async Task CreatorQuestion_WinsOverGemini()
    {
        var gemini = new FakeGeminiService { Available = true, Result = "Gemini invented answer" };
        var service = new HowToService(CreatePaymentService(), geminiService: gemini);

        var result = await service.AskHowToAsync("Who is your creator?", "en", CancellationToken.None);

        // Creator answer must win over Gemini output.
        Assert.Equal(ExpectedEnglish, result.Answer);
        Assert.False(gemini.Called);
    }

    [Fact]
    public async Task CreatorQuestion_DoesNotHijackUnrelatedQuestions()
    {
        var service = new HowToService(CreatePaymentService());

        var result = await service.AskHowToAsync("Who can book a hall?", "en", CancellationToken.None);

        // This is a booking/how-to question, NOT a creator question.
        Assert.NotEqual(ExpectedEnglish, result.Answer);
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
