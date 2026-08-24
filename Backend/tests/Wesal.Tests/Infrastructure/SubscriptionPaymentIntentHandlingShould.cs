using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class SubscriptionPaymentIntentHandlingShould
{
    private static ISubscriptionPaymentService CreatePaymentService()
        => new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions()));

    private static HowToService CreateHowToService()
        => new HowToService(CreatePaymentService());

    [Theory]
    [InlineData("How do I pay my subscription?")]
    [InlineData("How do I pay?")]
    [InlineData("Who do I contact for payment?")]
    [InlineData("Where can I pay my subscription?")]
    [InlineData("Where do I pay?")]
    [InlineData("How can I renew my subscription?")]
    [InlineData("Who should I message about my subscription?")]
    [InlineData("Who do I contact about my subscription?")]
    [InlineData("I want to pay for my subscription.")]
    [InlineData("I need to renew my subscription.")]
    [InlineData("How can I pay the subscription fee?")]
    public async Task English_PaymentIntent_ReturnsTrustedContact(string message)
    {
        var service = CreateHowToService();
        var result = await service.AskHowToAsync(message, "en", CancellationToken.None);
        Assert.Contains("+972597765489", result.Answer);
        Assert.DoesNotContain("+970567581412", result.Answer);
        Assert.Equal("payment", result.Category);
    }

    [Theory]
    [InlineData("كيف أدفع الاشتراك؟")]
    [InlineData("كيف أدفع؟")]
    [InlineData("مع مين أتواصل للدفع؟")]
    [InlineData("وين أتواصل عشان أدفع الاشتراك؟")]
    [InlineData("كيف أجدد الاشتراك؟")]
    [InlineData("مين أتواصل معه بخصوص الاشتراك؟")]
    [InlineData("وين أدفع الاشتراك؟")]
    [InlineData("كيف أدفع رسوم الاشتراك؟")]
    [InlineData("بدي أجدد اشتراكي")]
    [InlineData("بدي أدفع الاشتراك")]
    public async Task Arabic_PaymentIntent_ReturnsTrustedContact(string message)
    {
        var service = CreateHowToService();
        var result = await service.AskHowToAsync(message, "ar", CancellationToken.None);
        Assert.Contains("+972597765489", result.Answer);
        Assert.DoesNotContain("+970567581412", result.Answer);
        Assert.Equal("payment", result.Category);
    }

    [Theory]
    [InlineData("I need help with my subscription.")]
    [InlineData("I have a problem with my subscription.")]
    [InlineData("I want to renew.")]
    [InlineData("Where do I pay?")]
    [InlineData("Who handles subscriptions?")]
    public async Task Ambiguous_SubscriptionRelated_ReturnsPaymentGuidance(string message)
    {
        var service = CreateHowToService();
        var result = await service.AskHowToAsync(message, "en", CancellationToken.None);
        Assert.Contains("+972597765489", result.Answer);
        Assert.Equal("payment", result.Category);
    }

    [Theory]
    [InlineData("How do I add a hall?")]
    [InlineData("What are the hall booking rules?")]
    [InlineData("How do I change my password?")]
    [InlineData("What is my hall rating?")]
    [InlineData("How does booking work?")]
    public async Task Unrelated_NotClassifiedAsPayment(string message)
    {
        var service = CreateHowToService();
        var result = await service.AskHowToAsync(message, "en", CancellationToken.None);
        Assert.NotEqual("payment", result.Category);
        Assert.DoesNotContain("+972597765489", result.Answer);
    }

    [Fact]
    public async Task ContactIntegrity_UsesTrustedBackendValue()
    {
        var service = CreateHowToService();
        var result = await service.AskHowToAsync("How do I pay my subscription?", "en", CancellationToken.None);
        Assert.Contains("+972597765489", result.Answer);
        Assert.DoesNotContain("+970567581412", result.Answer);
        // Ensure no alternative number is returned
        Assert.DoesNotContain("+970", result.Answer);
    }

    [Fact]
    public async Task ArabicContactIntegrity_UsesTrustedValue()
    {
        var service = CreateHowToService();
        var result = await service.AskHowToAsync("كيف أدفع الاشتراك؟", "ar", CancellationToken.None);
        Assert.Contains("+972597765489", result.Answer);
        Assert.DoesNotContain("+970567581412", result.Answer);
    }

    [Fact]
    public async Task DifferentPhrasings_SameIntent()
    {
        var service = CreateHowToService();
        var r1 = await service.AskHowToAsync("How do I pay my subscription?", "en", CancellationToken.None);
        var r2 = await service.AskHowToAsync("I want to pay for my subscription.", "en", CancellationToken.None);
        var r3 = await service.AskHowToAsync("Where can I pay my subscription?", "en", CancellationToken.None);
        Assert.Equal(r1.Category, r2.Category);
        Assert.Equal(r2.Category, r3.Category);
        Assert.Equal("payment", r1.Category);
    }

    [Fact]
    public async Task HallOwnerContext_StillReturnsPaymentGuidance()
    {
        // Verify that even without explicit role check, payment guidance is returned via trusted contact
        // This ensures Hall Owner flow works without breaking existing AllowAnonymous behavior
        var service = CreateHowToService();
        var result = await service.AskHowToAsync("I need to renew my subscription", "en", CancellationToken.None);
        Assert.Contains("+972597765489", result.Answer);
    }
}
