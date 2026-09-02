using System.Text.RegularExpressions;

namespace Wesal.Application.Ai;

public interface ISubscriptionPaymentIntentDetector
{
    bool IsSubscriptionPaymentIntent(string? message);
}

public sealed class SubscriptionPaymentIntentDetector : ISubscriptionPaymentIntentDetector
{
    public bool IsSubscriptionPaymentIntent(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
            return false;

        var normalized = message.Trim().ToLowerInvariant();

        // Check for subscription/payment intent keywords
        // This covers all examples from the user story and handles natural variations
        return ContainsAny(normalized, EnglishPaymentKeywords) || ContainsAny(normalized, ArabicPaymentKeywords);
    }

    private static bool ContainsAny(string text, string[] keywords)
    {
        foreach (var keyword in keywords)
        {
            // For single-word keywords (no space), use word boundaries to avoid false positives like "ils" in "details"
            if (!keyword.Contains(' '))
            {
                var pattern = $@"\b{Regex.Escape(keyword)}\b";
                if (Regex.IsMatch(text, pattern, RegexOptions.IgnoreCase))
                    return true;
            }
            else
            {
                if (text.Contains(keyword, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
        }
        return false;
    }

    private static readonly string[] EnglishPaymentKeywords = new[]
    {
        "pay my subscription",
        "pay subscription",
        "subscription payment",
        "pay the subscription",
        "subscription fee",
        "renew my subscription",
        "renew subscription",
        "renew",
        "subscription renewal",
        "pay my", // covers "how do i pay my subscription"
        "how do i pay",
        "how can i pay",
        "where can i pay",
        "where do i pay",
        "who do i contact for payment",
        "who should i message about my subscription",
        "who do i contact about my subscription",
        "who handles subscriptions",
        "i want to pay for my subscription",
        "i need to renew my subscription",
        "i need help with my subscription",
        "i have a problem with my subscription",
        "where do i pay",
        "payment",
        "subscription",
        "pay",
        "ils"
    };

    private static readonly string[] ArabicPaymentKeywords = new[]
    {
        "كيف أدفع الاشتراك",
        "كيف ادفع الاشتراك",
        "كيف أدفع",
        "كيف ادفع",
        "مع مين أتواصل للدفع",
        "مع مين اتواصل للدفع",
        "وين أتواصل عشان أدفع الاشتراك",
        "وين اتواصل عشان ادفع الاشتراك",
        "كيف أجدد الاشتراك",
        "كيف اجدد الاشتراك",
        "مين أتواصل معه بخصوص الاشتراك",
        "مين اتواصل معه بخصوص الاشتراك",
        "وين أدفع الاشتراك",
        "وين ادفع الاشتراك",
        "كيف أدفع رسوم الاشتراك",
        "كيف ادفع رسوم الاشتراك",
        "بدي أجدد اشتراكي",
        "بدي اجدد اشتراكي",
        "بدي أدفع الاشتراك",
        "بدي ادفع الاشتراك",
        "أحتاج مساعدة في اشتراكي",
        "احتاج مساعدة في اشتراكي",
        "عندي مشكلة في اشتراكي",
        "أريد التجديد",
        "اريد التجديد",
        "وين أدفع",
        "وين ادفع",
        "من المسؤول عن الاشتراكات",
        "اشتراك",
        "دفع",
        "تجديد",
        "أدفع",
        "ادفع",
        "جدد"
    };
}
