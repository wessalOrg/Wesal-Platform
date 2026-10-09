using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class HowToServiceCreatorShould
{
    private static ISubscriptionPaymentService CreatePaymentService()
        => new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions()));

    private static HowToService CreateService(IWesalKnowledgeService? knowledge = null, IGeminiService? gemini = null)
        => new(CreatePaymentService(), geminiService: gemini, knowledgeService: knowledge);

    [Theory]
    [InlineData("Who is your creator?", "en")]
    [InlineData("who created Mabrook?", "en")]
    [InlineData("مين عمل مبروك؟", "ar")]
    [InlineData("مين عامل مبروك؟", "ar")]
    [InlineData("مين صنعك؟", "ar")]
    public async Task CreatorQuestion_AttributesMabroukToWesalTeam(string question, string language)
    {
        var result = await CreateService().AskHowToAsync(question, language, CancellationToken.None);

        Assert.Contains(language == "en" ? "Wesal team built me" : "فريق وصال صنعني", result.Answer, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("who developed wesal?", "en")]
    [InlineData("who built wesal?", "en")]
    [InlineData("Who is the team leader of Wesal?", "en")]
    [InlineData("مين مطورين وصال؟", "ar")]
    [InlineData("مين عمل وصال؟", "ar")]
    [InlineData("من هو منشئ وصال؟", "ar")]
    [InlineData("من هم فريق وصال؟", "ar")]
    public async Task WesalTeamQuestion_ReturnsVerifiedDevelopers(string question, string language)
    {
        var service = CreateService(knowledge: new WesalKnowledgeService());

        var result = await service.AskHowToAsync(question, language, CancellationToken.None);

        Assert.Contains(language == "en" ? "Abdulaziz Al-Khazendar" : "عبد العزيز الخزندار", result.Answer);
        Assert.Contains(language == "en" ? "Mohammed Shama" : "محمد شمعة", result.Answer);
        Assert.DoesNotContain("صنعني", result.Answer);
    }

    [Fact]
    public async Task CreatorQuestion_WinsOverGemini()
    {
        var gemini = new FakeGeminiService { Available = true, Result = "Gemini invented answer" };
        var result = await CreateService(gemini: gemini).AskHowToAsync("Who is your creator?", "en", CancellationToken.None);

        Assert.Contains("Wesal team built me", result.Answer);
        Assert.False(gemini.Called);
    }

    [Fact]
    public async Task CreatorQuestion_DoesNotHijackUnrelatedHowTo()
    {
        var result = await CreateService().AskHowToAsync("Who can book a hall?", "en", CancellationToken.None);

        Assert.Contains("registered account", result.Answer, StringComparison.OrdinalIgnoreCase);
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
            where T : class => Task.FromResult<T?>(null);
    }
}
