using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Owner payment-receipt flow (US-OWNER-31): upload and retrieval of the payment receipt
/// for one of the owner's own Approved-but-not-yet-paid halls. The upload moves the hall
/// to <see cref="Wesal.Domain.Enums.HallPaymentStatus.ReceiptUploaded"/> and notifies the
/// Admin via the existing conversation inbox; the hall stays private until the Admin
/// confirms the payment (US-ADMIN-10). Ownership is enforced server-side from the
/// authenticated session.
/// </summary>
public interface IPaymentReceiptService
{
    Task<PaymentReceiptUploadResult> UploadPaymentReceiptAsync(
        Guid hallId,
        OwnerDocumentUpload upload,
        CancellationToken cancellationToken = default);

    Task<StoredDocument> GetPaymentReceiptAsync(Guid hallId, CancellationToken cancellationToken = default);
}