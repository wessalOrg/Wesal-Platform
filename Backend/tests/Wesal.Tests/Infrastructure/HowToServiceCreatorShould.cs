using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class HowToServiceCreatorShould
{
    private const string ExpectedEnglish =
        "I’m Wesal’s smart assistant 😄🇵🇸\n" +
        "I was specially created to help you find the perfect wedding hall and answer your questions about halls, bookings, and the Wesal platform.\n\n" +
        "In short… the Wesal team built me to make your search easier and save you the headache of looking around 😂.";

    private const string ExpectedArabic =
        "أنا مساعد وصال الذكي 😄🇵🇸\n" +
        "انعملت خصيصًا عشان أساعدك تلاقي صالة أفراح مناسبة، وأجاوبك عن الصالات والحجز والمنصة.\n" +
        "يعني باختصار… فريق وصال صنعني، وأنا هون أخفف عنك وجعة راس البحث 😂.";

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

        Assert.Equal(ExpectedArabic, result.Answer);
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
