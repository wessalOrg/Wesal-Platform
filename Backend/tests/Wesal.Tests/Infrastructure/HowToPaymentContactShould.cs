using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Tests verifying that HowToService correctly uses the trusted subscription
/// payment contact from backend configuration (US-AI-08).
/// </summary>
public class HowToPaymentContactShould
{
    private static ISubscriptionPaymentService CreateService()
    {
        return new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions()));
    }

    [Fact]
    public async Task AskHowTo_PaymentQuestion_English_UsesTrustedContact()
    {
        var paymentService = CreateService();
        var howToService = new HowToService(paymentService);

        var result = await howToService.AskHowToAsync("how do I pay my subscription?", "en", CancellationToken.None);

        Assert.Contains("+972597744476", result.Answer);
        Assert.Equal("payment", result.Category);
    }

    [Fact]
    public async Task AskHowTo_PaymentQuestion_Arabic_UsesTrustedContact()
    {
        var paymentService = CreateService();
        var howToService = new HowToService(paymentService);

        var result = await howToService.AskHowToAsync("كيف أدفع الاشتراك", "ar", CancellationToken.None);

        Assert.Contains("+972597744476", result.Answer);
        Assert.Equal("payment", result.Category);
    }

    [Fact]
    public async Task AskHowTo_PaymentQuestion_English_ContainsPrice()
    {
        var paymentService = CreateService();
        var howToService = new HowToService(paymentService);

        var result = await howToService.AskHowToAsync("subscription payment", "en", CancellationToken.None);

        Assert.Contains("120", result.Answer);
        Assert.Contains("+972597744476", result.Answer);
    }

    [Fact]
    public async Task AskHowTo_PaymentQuestion_Arabic_ContainsPrice()
    {
        var paymentService = CreateService();
        var howToService = new HowToService(paymentService);

        var result = await howToService.AskHowToAsync("اشتراك دفع", "ar", CancellationToken.None);

        Assert.Contains("120", result.Answer);
        Assert.Contains("+972597744476", result.Answer);
    }

    [Fact]
    public async Task AskHowTo_PaymentQuestion_English_ResponseLanguageIsEnglish()
    {
        var paymentService = CreateService();
        var howToService = new HowToService(paymentService);

        var result = await howToService.AskHowToAsync("payment", "en", CancellationToken.None);

        Assert.Equal("en", result.ResponseLanguage);
    }

    [Fact]
    public async Task AskHowTo_PaymentQuestion_Arabic_ResponseLanguageIsArabic()
    {
        var paymentService = CreateService();
        var howToService = new HowToService(paymentService);

        var result = await howToService.AskHowToAsync("دفع", "ar", CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
    }
}
