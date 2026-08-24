using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.AiAssistant;

public sealed class SubscriptionPaymentService : ISubscriptionPaymentService
{
    private const string DefaultLanguage = "ar";

    private readonly SubscriptionPaymentOptions _options;

    public SubscriptionPaymentService(IOptions<SubscriptionPaymentOptions> options)
    {
        _options = options.Value;
    }

    public string GetAdminWhatsAppContact()
    {
        return _options.AdminWhatsAppContact;
    }

    public SubscriptionPaymentDetails GetPaymentDetails()
    {
        return new SubscriptionPaymentDetails(
            _options.AdminWhatsAppContact,
            _options.SubscriptionPriceIls,
            _options.SubscriptionCycleDays);
    }

    public Task<SubscriptionPaymentResponse> GetSubscriptionPaymentResponseAsync(
        string? language,
        CancellationToken cancellationToken = default)
    {
        var effectiveLanguage = string.IsNullOrWhiteSpace(language) ? DefaultLanguage : language;
        var contact = _options.AdminWhatsAppContact;
        var price = _options.SubscriptionPriceIls;
        var cycle = _options.SubscriptionCycleDays;
        var whatsappLink = $"https://wa.me/{contact.Replace("+", "")}";

        var answer = effectiveLanguage == "en"
            ? $"To pay your subscription as a Hall Owner: contact the Admin via WhatsApp at {contact} to arrange payment. The subscription is {price:F0} ILS per {cycle}-day cycle per hall. Once the Admin confirms your payment, your hall's management features unlock."
            : $"لدفع اشتراكك كصاحب قاعة: تواصل مع المدير عبر واتساب على الرقم {contact} لترتيب الدفع. الاشتراك {price:F0} شيكل لكل {cycle} يوم لكل قاعة. بمجرد تأكيد المدير للدفع، يتم فتح ميزات إدارة قاعدتك.";

        var trustedContact = new TrustedContactInfo(
            contact,
            whatsappLink,
            "admin-whatsapp");

        return Task.FromResult(new SubscriptionPaymentResponse(
            answer,
            "subscription-payment",
            effectiveLanguage,
            trustedContact,
            DateTime.UtcNow));
    }
}
