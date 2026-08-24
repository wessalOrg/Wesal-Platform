using Wesal.Application.Ai;

namespace Wesal.Tests.Application;

public class SubscriptionPaymentIntentDetectorShould
{
    private readonly SubscriptionPaymentIntentDetector _detector = new();

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
    public void English_PaymentIntent_Detected(string message)
    {
        Assert.True(_detector.IsSubscriptionPaymentIntent(message));
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
    public void Arabic_PaymentIntent_Detected(string message)
    {
        Assert.True(_detector.IsSubscriptionPaymentIntent(message));
    }

    [Theory]
    [InlineData("I need help with my subscription.")]
    [InlineData("I have a problem with my subscription.")]
    [InlineData("I want to renew.")]
    [InlineData("Where do I pay?")]
    [InlineData("Who handles subscriptions?")]
    public void Ambiguous_SubscriptionRelated_PrefersPayment(string message)
    {
        Assert.True(_detector.IsSubscriptionPaymentIntent(message));
    }

    [Theory]
    [InlineData("How do I add a hall?")]
    [InlineData("What are the hall booking rules?")]
    [InlineData("How do I change my password?")]
    [InlineData("What is my hall rating?")]
    [InlineData("How does booking work?")]
    public void Unrelated_NotClassifiedAsPayment(string message)
    {
        Assert.False(_detector.IsSubscriptionPaymentIntent(message));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void EmptyOrWhitespace_NotPayment(string? message)
    {
        Assert.False(_detector.IsSubscriptionPaymentIntent(message));
    }
}
