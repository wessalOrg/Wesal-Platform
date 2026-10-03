using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Shared wording for payment answers so the assistant gate and the how-to service can
/// never drift. Operational values (contact, price, cycle) always come from
/// <see cref="SubscriptionPaymentDetails"/> (configuration), never from literals here.
/// </summary>
internal static class AiPaymentTexts
{
    public static string BookingFallback(string language)
        => language == "en"
            ? "Deposit and payment details for a booking are arranged with the hall owner after you send your booking request. Use the Contact Hall Owner button on the hall page to talk to them."
            : "تفاصيل الدفع والعربون للحجز تُرتَّب مع صاحب القاعة بعد إرسال طلب الحجز. استخدم زر «التواصل مع صاحب القاعة» في صفحة القاعة للتحدث معه.";

    public static string Ambiguous(string language, SubscriptionPaymentDetails details)
        => language == "en"
            ? "Which payment do you mean?\n" +
              "• Booking deposit (as a guest): it is arranged with the hall owner after you send your booking request.\n" +
              $"• Hall subscription (as a hall owner): contact the Admin via WhatsApp at {details.AdminWhatsAppContact} to arrange payment. The subscription is {details.SubscriptionPriceIls:F0} ILS per {details.SubscriptionCycleDays}-day cycle per hall."
            : "أي دفع تقصد؟\n" +
              "• عربون حجز (كزبون): يُرتَّب مع صاحب القاعة بعد إرسال طلب الحجز.\n" +
              $"• اشتراك قاعة (كصاحب قاعة): تواصل مع المدير عبر واتساب على الرقم {details.AdminWhatsAppContact} لترتيب الدفع. الاشتراك {details.SubscriptionPriceIls:F0} شيكل لكل {details.SubscriptionCycleDays} يوم لكل قاعة.";
}
