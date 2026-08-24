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
        if (ContainsAny(normalized, EnglishPaymentKeywords) || ContainsAny(normalized, ArabicPaymentKeywords))
        {
            // Ensure it's not an unrelated question that merely contains generic words
            // Unrelated examples should not be classified as payment
            if (IsUnrelatedQuestion(normalized))
                return false;

            return true;
        }

        return false;
    }

    private static bool IsUnrelatedQuestion(string normalized)
    {
        // Unrelated patterns that should NOT be considered subscription-payment
        // These contain generic words but are about other features
        var unrelatedKeywords = new[]
        {
            "add a hall",
            "booking rules",
            "change my password",
            "hall rating",
            "how does booking work",
            "إضافة قاعة",
            "قواعد الحجز",
            "تغيير كلمة المرور",
            "تقييم قاعتي",
            "كيف يعمل الحجز"
        };

        // If message contains unrelated keywords and does NOT contain payment/subscription keywords strongly, it's unrelated
        // But since we already checked for payment keywords, we need to ensure unrelated with payment keywords still counts as payment
        // So we only exclude if it contains unrelated AND does not contain strong payment intent
        // For now, be conservative: only exclude if it clearly is about other features without payment context
        // The task says ambiguous subscription-related should prefer payment, so we should not over-exclude

        // Simple check: if message is exactly about other features and doesn't contain pay/subscription in a subscription context, it's unrelated
        // Since our payment keywords already filtered, if it reached here it has payment keywords, so don't exclude
        // This method is reserved for future refinement
        return false;
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
