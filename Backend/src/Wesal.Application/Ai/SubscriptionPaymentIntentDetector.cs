namespace Wesal.Application.Ai;

public interface ISubscriptionPaymentIntentDetector
{
    bool IsSubscriptionPaymentIntent(string? message);
}

/// <summary>
/// True only for the hall-owner SUBSCRIPTION payment/renewal intent. Booking payments
/// and ambiguous "how do I pay" questions are classified by
/// <see cref="AiPaymentIntentClassifier"/> and are deliberately NOT subscription intents
/// (a seeker asking "كيف أدفع الحجز؟" must never receive owner-subscription instructions).
/// </summary>
public sealed class SubscriptionPaymentIntentDetector : ISubscriptionPaymentIntentDetector
{
    public bool IsSubscriptionPaymentIntent(string? message)
        => AiPaymentIntentClassifier.Classify(message) == AiPaymentIntent.OwnerSubscription;
}
