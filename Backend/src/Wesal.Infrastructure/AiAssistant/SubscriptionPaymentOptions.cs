namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Backend-controlled configuration for the official subscription payment contact.
/// The AI model must never generate or invent this value.
/// Abdulaziz's future intent detection must use this as the single source of truth.
/// </summary>
public sealed class SubscriptionPaymentOptions
{
    public const string SectionName = "SubscriptionPayment";

    public const string DefaultAdminWhatsApp = "+972597744476";

    /// <summary>
    /// The canonical Admin WhatsApp contact for subscription payment inquiries.
    /// This is the ONLY official contact. The AI model must never generate this value.
    /// </summary>
    public string AdminWhatsAppContact { get; set; } = DefaultAdminWhatsApp;

    /// <summary>
    /// Subscription price in ILS per 30-day cycle per hall.
    /// </summary>
    public decimal SubscriptionPriceIls { get; set; } = 120m;

    /// <summary>
    /// Subscription cycle duration in days.
    /// </summary>
    public int SubscriptionCycleDays { get; set; } = 30;
}
