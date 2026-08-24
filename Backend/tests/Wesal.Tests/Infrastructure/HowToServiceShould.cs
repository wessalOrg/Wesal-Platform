using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class HowToServiceShould
{
    private static ISubscriptionPaymentService CreatePaymentService()
        => new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions()));

    private readonly HowToService _service = new(CreatePaymentService());

    [Fact]
    public async Task AskHowTo_SearchQuestion_ReturnsSearchAnswer()
    {
        var result = await _service.AskHowToAsync("how do I search for halls?", "en", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("search", result.Category, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Browse", result.Answer);
        Assert.Contains("region", result.Answer, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AskHowTo_BookingQuestion_ReturnsBookingAnswer()
    {
        var result = await _service.AskHowToAsync("how do I book a hall?", "en", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("booking", result.Category, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Book", result.Answer);
    }

    [Fact]
    public async Task AskHowTo_RatingQuestion_ReturnsRatingAnswer()
    {
        var result = await _service.AskHowToAsync("how do I rate a hall?", "en", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("rating", result.Category, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("star", result.Answer, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AskHowTo_CommentQuestion_ReturnsCommentAnswer()
    {
        var result = await _service.AskHowToAsync("how do I add a comment?", "en", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("comment", result.Category, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AskHowTo_ContactQuestion_ReturnsMessagingAnswer()
    {
        var result = await _service.AskHowToAsync("how do I contact the hall owner?", "en", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("messaging", result.Category, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AskHowTo_RegistrationQuestion_ReturnsRegistrationAnswer()
    {
        var result = await _service.AskHowToAsync("how do I create an account?", "en", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("registration", result.Category, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AskHowTo_LoginQuestion_ReturnsLoginAnswer()
    {
        var result = await _service.AskHowToAsync("how do I log in?", "en", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("login", result.Category, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AskHowTo_HallDetailsQuestion_ReturnsHallDetailsAnswer()
    {
        var result = await _service.AskHowToAsync("tell me about hall details", "en", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("hall-detail", result.Category, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AskHowTo_AvailabilityQuestion_ReturnsAvailabilityAnswer()
    {
        var result = await _service.AskHowToAsync("how do I check availability?", "en", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("availability", result.Category, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AskHowTo_GeneralQuestion_ReturnsGeneralAnswer()
    {
        var result = await _service.AskHowToAsync("what is wesal?", "en", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("general", result.Category, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AskHowTo_ArabicQuestion_ReturnsArabicAnswer()
    {
        var result = await _service.AskHowToAsync("كيف أبحث عن قاعات", "ar", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("search", result.Category, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("بحث", result.Answer);
    }

    [Fact]
    public async Task AskHowTo_NullLanguage_DefaultsToArabic()
    {
        var result = await _service.AskHowToAsync("كيف أبحث عن قاعات", null, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("بحث", result.Answer);
    }

    [Fact]
    public async Task AskHowTo_EmptyLanguage_DefaultsToArabic()
    {
        var result = await _service.AskHowToAsync("كيف أبحث عن قاعات", "", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("بحث", result.Answer);
    }

    [Fact]
    public async Task AskHowTo_WhitespaceLanguage_DefaultsToArabic()
    {
        var result = await _service.AskHowToAsync("كيف أبحث عن قاعات", "   ", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("بحث", result.Answer);
    }

    [Fact]
    public async Task AskHowTo_UnrecognizedQuestion_ReturnsFallback()
    {
        var result = await _service.AskHowToAsync("xyz123", "en", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("general", result.Category, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("I can help you", result.Answer);
    }

    [Fact]
    public async Task AskHowTo_ResponseContainsTimestamp()
    {
        var before = DateTime.UtcNow;
        var result = await _service.AskHowToAsync("how do I search?", "en", CancellationToken.None);
        var after = DateTime.UtcNow;

        Assert.NotNull(result);
        Assert.True(result.Timestamp >= before.AddSeconds(-1));
        Assert.True(result.Timestamp <= after.AddSeconds(1));
    }

    [Fact]
    public async Task AskHowTo_PaymentQuestion_ReturnsPaymentAnswer()
    {
        var result = await _service.AskHowToAsync("how do I pay my subscription?", "en", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("payment", result.Category, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("120", result.Answer);
    }

    [Fact]
    public async Task AskHowTo_LanguageQuestion_ReturnsLanguageAnswer()
    {
        var result = await _service.AskHowToAsync("how do I switch language?", "en", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("language", result.Category, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AskHowTo_CancelQuestion_ReturnsBookingAnswer()
    {
        var result = await _service.AskHowToAsync("how do I cancel a booking?", "en", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("booking", result.Category, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AskHowTo_ArabicLoginQuestion_ReturnsArabicLoginAnswer()
    {
        var result = await _service.AskHowToAsync("كيف أسجل الدخول", "ar", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("login", result.Category, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("تسجيل الدخول", result.Answer);
    }

    [Fact]
    public async Task AskHowTo_EnglishQuestionWithArabicLanguage_ReturnsArabicAnswer()
    {
        var result = await _service.AskHowToAsync("how do I search for halls", "ar", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("search", result.Category, StringComparison.OrdinalIgnoreCase);
    }
}
