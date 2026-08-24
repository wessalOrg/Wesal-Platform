namespace Wesal.Application.Common.Models;

/// <summary>
/// Structured subscription payment details sourced from backend-controlled configuration.
/// The AI model must never generate or invent these values.
/// </summary>
public sealed record SubscriptionPaymentDetails(
    string AdminWhatsAppContact,
    decimal SubscriptionPriceIls,
    int SubscriptionCycleDays);

/// <summary>
/// Subscription payment response with trusted contact information.
/// The <see cref="TrustedContact"/> is always sourced from backend configuration,
/// never from AI-generated content. This ensures the canonical contact is reliable
/// regardless of how the intent was detected.
/// </summary>
public sealed record SubscriptionPaymentResponse(
    string Answer,
    string Category,
    string ResponseLanguage,
    TrustedContactInfo TrustedContact,
    DateTime Timestamp);

/// <summary>
/// Structured trusted contact information for frontend integration.
/// Contains the canonical WhatsApp contact and a direct WhatsApp link.
/// </summary>
public sealed record TrustedContactInfo(
    string PhoneNumber,
    string WhatsAppLink,
    string ContactType);
