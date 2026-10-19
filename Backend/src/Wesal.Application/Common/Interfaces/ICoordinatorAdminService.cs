using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Administrator-only review of Event Coordinator account requests (WESAL Task 5).
///
/// Every member is reached only through a controller carrying the
/// <c>RequireAdmin</c> policy; the acting administrator is resolved exclusively from the
/// session, never from the request body or route.
/// </summary>
public interface ICoordinatorAdminService
{
    /// <summary>
    /// The coordinator account-request queue, newest submission first, optionally filtered
    /// by approval status (WESAL Task 5, requirement 5.1). An unfiltered call returns every
    /// submitted request regardless of its current status.
    /// </summary>
    Task<PagedResult<AdminCoordinatorRequestDto>> GetCoordinatorRequestsAsync(
        AccountApprovalStatus? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The full setup submission for one coordinator: identity, every setup field and an
    /// authenticated endpoint for every image (WESAL Task 5, requirement 5.2).
    /// 404 when the user or the setup submission does not exist.
    /// </summary>
    Task<AdminCoordinatorRequestDetailDto> GetCoordinatorRequestDetailAsync(
        string userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Streams the coordinator's personal ID document for the given user id. Only an
    /// administrator reaches this service (controller policy), and only a user who
    /// actually has a coordinator setup submission can return a document.
    /// </summary>
    Task<StoredDocument> GetCoordinatorIdentityDocumentAsync(
        string userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Streams the coordinator's shop photo (shop branch). 400 when the branch does not
    /// apply, 404 when no photo was uploaded or the file is missing.
    /// </summary>
    Task<StoredDocument> GetCoordinatorShopPhotoAsync(
        string userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Streams one of the coordinator's two work photos (freelance branch).
    /// <paramref name="index"/> is 1-based (1 or 2); out-of-range is 400, a branch that
    /// does not apply or a missing photo is 404.
    /// </summary>
    Task<StoredDocument> GetCoordinatorWorkPhotoAsync(
        string userId,
        int index,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Approves the coordinator's account (WESAL Task 5, requirement 5.3): sets the
    /// status to Approved and commits the "Congratulations! Your account has been
    /// approved" notification in the same transaction. 409 when the account is already
    /// Approved.
    /// </summary>
    Task<AdminAccountRequestDecisionResultDto> ApproveCoordinatorRequestAsync(
        string userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Rejects the coordinator's account (WESAL Task 5, requirement 5.5): sets the status
    /// to Rejected and delivers the mandatory reason inside the rejection notification and
    /// as a message on the Admin conversation, all committed atomically.
    /// 409 when the account is already Rejected.
    /// </summary>
    Task<AdminAccountRequestDecisionResultDto> RejectCoordinatorRequestAsync(
        string userId,
        AdminRejectAccountRequestDto request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Resolves (creating on demand) the Admin↔coordinator conversation for the
    /// "contact coordinator" action (WESAL Task 5, requirement 5.6). Opening never posts
    /// a placeholder message.
    /// </summary>
    Task<AdminUserConversationDto> GetCoordinatorConversationAsync(
        string userId,
        CancellationToken cancellationToken = default);
}
