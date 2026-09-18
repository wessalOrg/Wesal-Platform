namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Abstraction over outbound email delivery (US-ADMIN-08, FR-SUB-02). The
/// implementation is responsible for reporting whether the e-mail was actually
/// accepted for delivery; callers such as the subscription-expiry warning job use the
/// boolean to drive retry-with-escalation and must never treat a failed send as
/// success. Email is a complement to the in-app Messages notification, never a
/// replacement for it.
/// </summary>
public interface IEmailService
{
    /// <summary>
    /// Attempts to send an e-mail. Returns true only when the e-mail was handed to the
    /// mail server; returns false (without throwing) when it could not be sent, e.g. no
    /// SMTP endpoint is configured.
    /// </summary>
    Task<bool> TrySendAsync(
        string to,
        string subject,
        string body,
        CancellationToken cancellationToken = default);
}