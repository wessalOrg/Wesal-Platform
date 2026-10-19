using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Admin;
using Wesal.Infrastructure.Documents;
using Wesal.Infrastructure.Identity;
using ValidationException = Wesal.Domain.Exceptions.ValidationException;

namespace Wesal.Infrastructure.Coordinators;

/// <summary>
/// Administrator-only review of Event Coordinator account requests (WESAL Task 5): the
/// request queue, the full submission detail with authenticated image endpoints, the
/// approve/reject decisions with their notifications, and the Admin↔coordinator
/// conversation behind the "contact coordinator" action.
///
/// Every member runs behind the controller's RequireAdmin policy; the acting
/// Administrator is resolved from the session only. Documents are streamed from the
/// private store through authenticated endpoints — no public URL exists for them.
///
/// Consistency model (mirrors the setup and hall-review flows): for a decision, the
/// status change, the durable notification row, and — for a rejection — the conversation
/// message all commit in ONE transaction; the realtime push runs after the commit,
/// best-effort, and can never fail or roll back the decision.
/// </summary>
public sealed class CoordinatorAdminService : ICoordinatorAdminService
{
    private const string RoutePrefix = "/api/v1/admin/coordinators";

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICoordinatorRepository _coordinatorRepository;
    private readonly IIdentityDocumentStore _documentStore;
    private readonly IUnitOfWork _unitOfWork;
    private readonly AccountRequestReviewActions _reviewActions;

    public CoordinatorAdminService(
        UserManager<ApplicationUser> userManager,
        ICoordinatorRepository coordinatorRepository,
        IIdentityDocumentStore documentStore,
        IUnitOfWork unitOfWork,
        AccountRequestReviewActions reviewActions)
    {
        _userManager = userManager;
        _coordinatorRepository = coordinatorRepository;
        _documentStore = documentStore;
        _unitOfWork = unitOfWork;
        _reviewActions = reviewActions;
    }

    // --- Requirement 5.1: the queue with a status filter -----------------------------

    public async Task<PagedResult<AdminCoordinatorRequestDto>> GetCoordinatorRequestsAsync(
        AccountApprovalStatus? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        page = page <= 0 ? 1 : page;
        pageSize = pageSize <= 0 ? 10 : pageSize;

        var items = await _coordinatorRepository.GetRequestsAsync(
            status, (page - 1) * pageSize, pageSize, cancellationToken);
        var totalCount = await _coordinatorRepository.CountRequestsAsync(status, cancellationToken);

        return PagedResult<AdminCoordinatorRequestDto>.Create(items, page, pageSize, totalCount);
    }

    // --- Requirement 5.2: full detail, including every image ---

    public async Task<AdminCoordinatorRequestDetailDto> GetCoordinatorRequestDetailAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var (user, profile) = await LoadRequestAsync(userId, cancellationToken);

        return new AdminCoordinatorRequestDetailDto
        {
            UserId = user.Id,
            FullName = user.FullName,
            Email = user.Email ?? string.Empty,
            UserPhoneNumber = user.PhoneNumber,
            ApprovalStatus = user.ApprovalStatus,
            IsSetupComplete = user.IsSetupComplete,
            BusinessType = profile.BusinessType,
            ShopName = profile.ShopName,
            ShopLocation = profile.ShopLocation,
            OnlineStoreName = profile.OnlineStoreName,
            SetupPhoneNumber = profile.PhoneNumber,
            SubmittedAt = profile.SubmittedAt,
            IdentityDocumentUrl = string.IsNullOrWhiteSpace(profile.IdentityDocumentUrl)
                ? null
                : $"{RoutePrefix}/{userId}/identity-document",
            ShopPhotoUrl = profile.BusinessType == CoordinatorBusinessType.Shop
                && !string.IsNullOrWhiteSpace(profile.ShopPhotoUrl)
                    ? $"{RoutePrefix}/{userId}/shop-photo"
                    : null,
            WorkPhoto1Url = profile.BusinessType == CoordinatorBusinessType.Freelance
                && !string.IsNullOrWhiteSpace(profile.WorkPhoto1Url)
                    ? $"{RoutePrefix}/{userId}/work-photos/1"
                    : null,
            WorkPhoto2Url = profile.BusinessType == CoordinatorBusinessType.Freelance
                && !string.IsNullOrWhiteSpace(profile.WorkPhoto2Url)
                    ? $"{RoutePrefix}/{userId}/work-photos/2"
                    : null
        };
    }

    // --- Document streams (ID, shop photo, work photos) ------------------------------

    public async Task<StoredDocument> GetCoordinatorIdentityDocumentAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var (_, profile) = await LoadRequestAsync(userId, cancellationToken);

        if (string.IsNullOrWhiteSpace(profile.IdentityDocumentUrl))
        {
            throw new NotFoundException("The coordinator has not uploaded an identity document yet.");
        }

        return await StreamAsync(profile.IdentityDocumentUrl, "The coordinator identity document was not found.", cancellationToken);
    }

    public async Task<StoredDocument> GetCoordinatorShopPhotoAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var (_, profile) = await LoadRequestAsync(userId, cancellationToken);

        if (profile.BusinessType != CoordinatorBusinessType.Shop)
        {
            throw new ValidationException("A shop photo only exists for coordinators who have a shop.");
        }

        if (string.IsNullOrWhiteSpace(profile.ShopPhotoUrl))
        {
            throw new NotFoundException("The coordinator has not uploaded a shop photo.");
        }

        return await StreamAsync(profile.ShopPhotoUrl, "The coordinator shop photo was not found.", cancellationToken);
    }

    public async Task<StoredDocument> GetCoordinatorWorkPhotoAsync(
        string userId,
        int index,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (index is < 1 or > 2)
        {
            throw new ValidationException("Work photo index must be 1 or 2.");
        }

        var (_, profile) = await LoadRequestAsync(userId, cancellationToken);

        if (profile.BusinessType != CoordinatorBusinessType.Freelance)
        {
            throw new ValidationException("Work photos only exist for freelance coordinators.");
        }

        var relativeUrl = index == 1 ? profile.WorkPhoto1Url : profile.WorkPhoto2Url;

        if (string.IsNullOrWhiteSpace(relativeUrl))
        {
            throw new NotFoundException($"The coordinator has not uploaded work photo {index}.");
        }

        return await StreamAsync(relativeUrl, $"The coordinator work photo {index} was not found.", cancellationToken);
    }

    // --- Requirement 5.3: approve ----------------------------------------------------

    public async Task<AdminAccountRequestDecisionResultDto> ApproveCoordinatorRequestAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var (user, _) = await LoadRequestAsync(userId, cancellationToken);

        AccountRequestReviewActions.EnsureTransitionAllowed(
            user.ApprovalStatus, AccountApprovalStatus.Approved, "coordinator account");

        // Approved carries no conversation: the requirement's wording is purely
        // informational and the notification's action target is None.
        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _reviewActions.BuildAndPersistNotificationAsync(
                NotificationKind.CoordinatorApprovedForCoordinator,
                user.Id,
                values: null,
                targetId: null,
                cancellationToken);

            user.ApprovalStatus = AccountApprovalStatus.Approved;
            await UpdateUserAsync(user, cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);

        var delivered = await _reviewActions.DispatchBestEffortAsync(
            NotificationKind.CoordinatorApprovedForCoordinator,
            user.Id,
            values: null,
            targetId: null,
            cancellationToken);

        return new AdminAccountRequestDecisionResultDto
        {
            UserId = user.Id,
            Status = AccountApprovalStatus.Approved,
            NotificationDelivered = delivered
        };
    }

    // --- Requirement 5.5: reject with the mandatory reason ---------------------------

    public async Task<AdminAccountRequestDecisionResultDto> RejectCoordinatorRequestAsync(
        string userId,
        AdminRejectAccountRequestDto request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var (user, _) = await LoadRequestAsync(userId, cancellationToken);

        AccountRequestReviewActions.EnsureTransitionAllowed(
            user.ApprovalStatus, AccountApprovalStatus.Rejected, "coordinator account");

        var reason = AccountRequestReviewActions.ValidateAndTrimReason(request?.Reason);
        var values = new Dictionary<string, string?>
        {
            [NotificationTokens.Reason] = reason
        };

        var conversationId = await _unitOfWork.ExecuteInTransactionAsync<Guid>(async () =>
        {
            // The thread exists BEFORE the notification is rendered, because the
            // click-through target (and the durable row's TargetId) is this very
            // conversation — the same shape the hall rejection uses, so the deep link
            // always lands in a real, writable thread.
            var (conversation, _) = await _reviewActions.ResolveOrCreateConversationAsync(user.Id, cancellationToken);

            var content = await _reviewActions.BuildAndPersistNotificationAsync(
                NotificationKind.CoordinatorRejectedForCoordinator,
                user.Id,
                values,
                conversation.Id.ToString(),
                cancellationToken);

            // The reason is delivered inside the notification AND posted as the thread's
            // message (requirement 5.5), rendered once in the recipient's own language.
            await _reviewActions.PostMessageAsync(conversation, content.Body, cancellationToken);

            user.ApprovalStatus = AccountApprovalStatus.Rejected;
            await UpdateUserAsync(user, cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return conversation.Id;
        }, cancellationToken);

        var delivered = await _reviewActions.DispatchBestEffortAsync(
            NotificationKind.CoordinatorRejectedForCoordinator,
            user.Id,
            values,
            conversationId.ToString(),
            cancellationToken);

        return new AdminAccountRequestDecisionResultDto
        {
            UserId = user.Id,
            Status = AccountApprovalStatus.Rejected,
            NotificationDelivered = delivered
        };
    }

    // --- Requirement 5.6: contact the coordinator (open/create the thread) -----------

    public async Task<AdminUserConversationDto> GetCoordinatorConversationAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        await LoadRequestAsync(userId, cancellationToken);

        var (conversation, isExisting) = await _reviewActions.ResolveOrCreateConversationAsync(
            userId, cancellationToken);

        return new AdminUserConversationDto
        {
            ConversationId = conversation.Id,
            UserId = userId,
            IsExisting = isExisting
        };
    }

    // --- Shared helpers ---------------------------------------------------------------

    /// <summary>
    /// Loads the account and its setup submission, 404 when either is missing — the queue
    /// is the only surface that exists here, so a user without a submission has no request
    /// to review, stream, or contact.
    /// </summary>
    private async Task<(ApplicationUser User, CoordinatorProfile Profile)> LoadRequestAsync(
        string userId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            throw new NotFoundException("Coordinator", userId ?? string.Empty);
        }

        var profile = await _coordinatorRepository.GetByUserIdAsync(userId, cancellationToken);
        if (profile is null)
        {
            throw new NotFoundException("Coordinator", userId);
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
        {
            throw new NotFoundException("User", userId);
        }

        return (user, profile);
    }

    private async Task<StoredDocument> StreamAsync(
        string relativeUrl,
        string notFoundMessage,
        CancellationToken cancellationToken)
    {
        var stored = await _documentStore.ReadAsync(relativeUrl, cancellationToken);
        if (stored is null)
        {
            throw new NotFoundException(notFoundMessage);
        }

        return new StoredDocument
        {
            RelativeUrl = relativeUrl,
            FullPath = stored.LocalPath ?? string.Empty,
            Content = stored.Bytes,
            ContentType = DocumentPath.ContentTypeFromUrl(relativeUrl),
            FileName = DocumentPath.FileNameFromUrl(relativeUrl) ?? relativeUrl
        };
    }

    private async Task UpdateUserAsync(ApplicationUser user, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            var errors = updateResult.Errors
                .GroupBy(error => error.Code)
                .ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray());

            throw new ValidationException(errors.Count > 0
                ? errors
                : new Dictionary<string, string[]> { ["Approval"] = ["The approval status could not be saved; please try again."] });
        }
    }
}
