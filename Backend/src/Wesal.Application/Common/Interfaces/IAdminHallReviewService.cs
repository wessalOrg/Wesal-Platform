using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Admin Panel hall-review surface (US-ADMIN-01/03/05). All members assume the
/// caller has already passed the RequireAdmin authorization policy at the controller.
/// </summary>
public interface IAdminHallReviewService
{
    Task<PagedResult<AdminPendingHallDto>> GetPendingHallsAsync(
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<AdminHallDetailDto> GetAdminHallDetailAsync(
        Guid hallId,
        CancellationToken cancellationToken = default);

    Task<AdminRejectHallResultDto> RejectHallAsync(
        Guid hallId,
        AdminRejectHallRequestDto request,
        CancellationToken cancellationToken = default);

    Task<AdminLockHallResultDto> LockHallAsync(
        Guid hallId,
        CancellationToken cancellationToken = default);

    Task<AdminUnlockHallResultDto> UnlockHallAsync(
        Guid hallId,
        CancellationToken cancellationToken = default);

    Task<AdminOwnerMessageResponseDto> SendMessageToOwnerAsync(
        Guid hallId,
        string content,
        CancellationToken cancellationToken = default);

    /// <summary>Streams the owner's identity document (US-ADMIN-01); NotFound when the owner has none.</summary>
    Task<StoredDocument> GetOwnerIdentityDocumentAsync(
        string ownerId,
        CancellationToken cancellationToken = default);

    /// <summary>Streams the hall's uploaded payment receipt (US-ADMIN-10); NotFound when none exists.</summary>
    Task<StoredDocument> GetPaymentReceiptAsync(
        Guid hallId,
        CancellationToken cancellationToken = default);
}