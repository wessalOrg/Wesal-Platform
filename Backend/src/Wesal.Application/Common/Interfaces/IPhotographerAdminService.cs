using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Administrator-only review of Photographer account requests (WESAL Task 6).
///
/// Every member is reached only through a controller carrying the
/// <c>RequireAdmin</c> policy; the acting administrator is resolved exclusively from the
/// session, never from the request body or route.
/// </summary>
public interface IPhotographerAdminService
{
    /// <summary>
    /// The photographer account-request queue, newest submission first, optionally filtered
    /// by approval status (WESAL Task 6, requirement 6.1). An unfiltered call returns every
    /// submitted request regardless of its current status.
    /// </summary>
    Task<PagedResult<AdminPhotographerRequestDto>> GetPhotographerRequestsAsync(
        AccountApprovalStatus? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The full setup submission for one photographer: identity (including the
    /// administrator-only legal full name), every setup field and an authenticated
    /// endpoint for the ID document (WESAL Task 6, requirement 6.2).
    /// 404 when the user or the setup submission does not exist.
    /// </summary>
    Task<AdminPhotographerRequestDetailDto> GetPhotographerRequestDetailAsync(
        string userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Streams the photographer's personal ID document for the given user id. Only an
    /// administrator reaches this service (controller policy), and only a user who
    /// actually has a photographer setup submission can return a document.
    /// </summary>
    Task<StoredDocument> GetPhotographerIdentityDocumentAsync(
        string userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Approves the photographer's account (WESAL Task 6, requirement 6.3): sets the
    /// status to Approved and commits the "Your account has been approved!"
    /// notification in the same transaction. 409 when the account is already Approved.
    /// </summary>
    Task<AdminAccountRequestDecisionResultDto> ApprovePhotographerRequestAsync(
        string userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Rejects the photographer's account (WESAL Task 6, requirement 6.4): sets the status
    /// to Rejected and delivers the mandatory reason inside the rejection notification and
    /// as a message on the Admin conversation, all committed atomically.
    /// 409 when the account is already Rejected.
    /// </summary>
    Task<AdminAccountRequestDecisionResultDto> RejectPhotographerRequestAsync(
        string userId,
        AdminRejectAccountRequestDto request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Asks the photographer to edit their submission (WESAL Task 6, requirement 6.5):
    /// sets the status to NeedsChanges, posts the mandatory notes into the Admin
    /// conversation, and commits the "request needs editing" notification pointing at that
    /// conversation. 409 when the account is already NeedsChanges.
    /// </summary>
    Task<AdminAccountRequestDecisionResultDto> RequestPhotographerChangesAsync(
        string userId,
        AdminRequestChangesDto request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Resolves (creating on demand) the Admin↔photographer conversation for the
    /// "contact photographer" action (WESAL Task 6, requirement 6.6). Opening never posts
    /// a placeholder message.
    /// </summary>
    Task<AdminUserConversationDto> GetPhotographerConversationAsync(
        string userId,
        CancellationToken cancellationToken = default);
}
