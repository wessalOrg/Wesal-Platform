using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Backend-controlled subscription payment contact service.
/// Provides the canonical Admin WhatsApp contact and payment information.
/// The AI model must never generate, guess, or invent the contact number.
/// This service is the single source of truth for subscription payment contacts.
///
/// Integration contract for Abdulaziz's future intent detection:
/// When intent detection identifies a subscription-payment request, call this
/// service to obtain the trusted canonical contact and compose the response.
/// </summary>
public interface ISubscriptionPaymentService
{
    /// <summary>
    /// Returns the canonical Admin WhatsApp contact for subscription payments.
    /// This value is backend-controlled and must never be AI-generated.
    /// </summary>
    string GetAdminWhatsAppContact();

    /// <summary>
    /// Returns the subscription payment details including the trusted contact,
    /// price, and cycle information.
    /// </summary>
    SubscriptionPaymentDetails GetPaymentDetails();

    /// <summary>
    /// Generates a bilingual subscription payment response using the trusted
    /// canonical contact. The contact is always sourced from backend configuration,
    /// never from AI-generated content.
    /// </summary>
    Task<SubscriptionPaymentResponse> GetSubscriptionPaymentResponseAsync(
        string? language,
        CancellationToken cancellationToken = default);
}
