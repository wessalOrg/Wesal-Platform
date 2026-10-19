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

namespace Wesal.Infrastructure.Photographers;

/// <summary>
/// Administrator-only review of Photographer account requests (WESAL Task 6): the
/// request queue, the full submission detail (including the administrator-only legal
/// name), the approve / reject / request-changes decisions with their notifications, and
/// the Admin↔photographer conversation behind the "contact photographer" action.
///
/// Every member runs behind the controller's RequireAdmin policy; the acting
/// Administrator is resolved from the session only. The identity document is streamed
/// from the private store through an authenticated endpoint — no public URL exists.
///
/// Consistency model (mirrors the setup and hall-review flows): for a decision, the
/// status change, the durable notification row, and — for reject/request-changes — the
/// conversation message all commit in ONE transaction; the realtime push runs after the
/// commit, best-effort, and can never fail or roll back the decision.
/// </summary>
public sealed class PhotographerAdminService : IPhotographerAdminService
{
    private const string RoutePrefix = "/api/v1/admin/photographers";

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IPhotographerRepository _photographerRepository;
    private readonly IIdentityDocumentStore _documentStore;
    private readonly IUnitOfWork _unitOfWork;
    private readonly AccountRequestReviewActions _reviewActions;

    public PhotographerAdminService(
        UserManager<ApplicationUser> userManager,
        IPhotographerRepository photographerRepository,
        IIdentityDocumentStore documentStore,
        IUnitOfWork unitOfWork,
        AccountRequestReviewActions reviewActions)
    {
        _userManager = userManager;
        _photographerRepository = photographerRepository;
        _documentStore = documentStore;
        _unitOfWork = unitOfWork;
        _reviewActions = reviewActions;
    }

    // --- Requirement 6.1: the queue with a status filter ------------------------------

    public async Task<PagedResult<AdminPhotographerRequestDto>> GetPhotographerRequestsAsync(
        AccountApprovalStatus? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        page = page <= 0 ? 1 : page;
        pageSize = pageSize <= 0 ? 10 : pageSize;

        var items = await _photographerRepository.GetRequestsAsync(
            status, (page - 1) * pageSize, pageSize, cancellationToken);
        var totalCount = await _photographerRepository.CountRequestsAsync(status, cancellationToken);

        return PagedResult<AdminPhotographerRequestDto>.Create(items, page, pageSize, totalCount);
    }

    // --- Requirement 6.2: full detail, including the admin-only legal name -----------

    public async Task<AdminPhotographerRequestDetailDto> GetPhotographerRequestDetailAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var (user, profile) = await LoadRequestAsync(userId, cancellationToken);

        return new AdminPhotographerRequestDetailDto
        {
            UserId = user.Id,
            FullName = user.FullName,
            Email = user.Email ?? string.Empty,
            UserPhoneNumber = user.PhoneNumber,
            ApprovalStatus = user.ApprovalStatus,
            IsSetupComplete = user.IsSetupComplete,
            HasStudio = profile.HasStudio,
            StudioName = profile.StudioName,
            StudioLocation = profile.StudioLocation,
            DetailedStudioLocation = profile.DetailedStudioLocation,
            // Administrator-only surface (requirement 6.2): this is the one response the
            // verification name may appear in; no client-facing endpoint ever returns it.
            LegalFullName = profile.FullName,
            SetupPhoneNumber = profile.PhoneNumber,
            SubmittedAt = profile.SubmittedAt,
            IdentityDocumentUrl = string.IsNullOrWhiteSpace(profile.IdentityDocumentUrl)
                ? null
                : $"{RoutePrefix}/{userId}/identity-document"
        };
    }

    // --- ID document stream -------------------------------------------------------------

    public async Task<StoredDocument> GetPhotographerIdentityDocumentAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var (_, profile) = await LoadRequestAsync(userId, cancellationToken);

        if (string.IsNullOrWhiteSpace(profile.IdentityDocumentUrl))
        {
            throw new NotFoundException("The photographer has not uploaded an identity document yet.");
        }

        var stored = await _documentStore.ReadAsync(profile.IdentityDocumentUrl, cancellationToken);
        if (stored is null)
        {
            throw new NotFoundException("The photographer identity document was not found.");
        }

        return new StoredDocument
        {
            RelativeUrl = profile.IdentityDocumentUrl,
            FullPath = stored.LocalPath ?? string.Empty,
            Content = stored.Bytes,
            ContentType = DocumentPath.ContentTypeFromUrl(profile.IdentityDocumentUrl),
            FileName = DocumentPath.FileNameFromUrl(profile.IdentityDocumentUrl) ?? profile.IdentityDocumentUrl
        };
    }

    // --- Requirement 6.3: approve ------------------------------------------------------

    public async Task<AdminAccountRequestDecisionResultDto> ApprovePhotographerRequestAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var (user, _) = await LoadRequestAsync(userId, cancellationToken);

        AccountRequestReviewActions.EnsureTransitionAllowed(
            user.ApprovalStatus, AccountApprovalStatus.Approved, "photographer account");

        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _reviewActions.BuildAndPersistNotificationAsync(
                NotificationKind.PhotographerApprovedForPhotographer,
                user.Id,
                values: null,
                targetId: null,
                cancellationToken);

            user.ApprovalStatus = AccountApprovalStatus.Approved;
            await UpdateUserAsync(user, cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);

        var delivered = await _reviewActions.DispatchBestEffortAsync(
            NotificationKind.PhotographerApprovedForPhotographer,
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

    // --- Requirement 6.4: reject with the mandatory reason -----------------------------

    public async Task<AdminAccountRequestDecisionResultDto> RejectPhotographerRequestAsync(
        string userId,
        AdminRejectAccountRequestDto request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var (user, _) = await LoadRequestAsync(userId, cancellationToken);

        AccountRequestReviewActions.EnsureTransitionAllowed(
            user.ApprovalStatus, AccountApprovalStatus.Rejected, "photographer account");

        var reason = AccountRequestReviewActions.ValidateAndTrimReason(request?.Reason);
        var values = new Dictionary<string, string?>
        {
            [NotificationTokens.Reason] = reason
        };

        var conversationId = await _unitOfWork.ExecuteInTransactionAsync<Guid>(async () =>
        {
            // Requirement 15.6: tapping the rejection opens the Admin conversation, so
            // the thread exists before the notification that points at it is rendered.
            var (conversation, _) = await _reviewActions.ResolveOrCreateConversationAsync(user.Id, cancellationToken);

            var content = await _reviewActions.BuildAndPersistNotificationAsync(
                NotificationKind.PhotographerRejectedForPhotographer,
                user.Id,
                values,
                conversation.Id.ToString(),
                cancellationToken);

            // The reason reaches the photographer inside the notification (the rendered
            // body carries it) and as the thread's first message, so it survives logout
            // in both the notification center and the conversation.
            await _reviewActions.PostMessageAsync(conversation, content.Body, cancellationToken);

            user.ApprovalStatus = AccountApprovalStatus.Rejected;
            await UpdateUserAsync(user, cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return conversation.Id;
        }, cancellationToken);

        var delivered = await _reviewActions.DispatchBestEffortAsync(
            NotificationKind.PhotographerRejectedForPhotographer,
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

    // --- Requirement 6.5: request changes with mandatory notes -------------------------

    public async Task<AdminAccountRequestDecisionResultDto> RequestPhotographerChangesAsync(
        string userId,
        AdminRequestChangesDto request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var (user, _) = await LoadRequestAsync(userId, cancellationToken);

        AccountRequestReviewActions.EnsureTransitionAllowed(
            user.ApprovalStatus, AccountApprovalStatus.NeedsChanges, "photographer account");

        var notes = AccountRequestReviewActions.ValidateAndTrimNotes(request?.Notes);

        var conversationId = await _unitOfWork.ExecuteInTransactionAsync<Guid>(async () =>
        {
            var (conversation, _) = await _reviewActions.ResolveOrCreateConversationAsync(user.Id, cancellationToken);

            // The notification deliberately does NOT repeat the notes (requirement 15.6):
            // its body points at the conversation, where the notes live as this message.
            await _reviewActions.BuildAndPersistNotificationAsync(
                NotificationKind.PhotographerNeedsChangesForPhotographer,
                user.Id,
                values: null,
                targetId: conversation.Id.ToString(),
                cancellationToken);

            await _reviewActions.PostMessageAsync(conversation, notes, cancellationToken);

            user.ApprovalStatus = AccountApprovalStatus.NeedsChanges;
            await UpdateUserAsync(user, cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return conversation.Id;
        }, cancellationToken);

        var delivered = await _reviewActions.DispatchBestEffortAsync(
            NotificationKind.PhotographerNeedsChangesForPhotographer,
            user.Id,
            values: null,
            targetId: conversationId.ToString(),
            cancellationToken);

        return new AdminAccountRequestDecisionResultDto
        {
            UserId = user.Id,
            Status = AccountApprovalStatus.NeedsChanges,
            NotificationDelivered = delivered
        };
    }

    // --- Requirement 6.6: contact the photographer (open/create the thread) ------------

    public async Task<AdminUserConversationDto> GetPhotographerConversationAsync(
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

    // --- Shared helpers -----------------------------------------------------------------

    /// <summary>
    /// Loads the account and its setup submission, 404 when either is missing — a user
    /// without a submission has no request to review, stream, or contact, so the endpoint
    /// cannot be used to probe arbitrary accounts.
    /// </summary>
    private async Task<(ApplicationUser User, PhotographerProfile Profile)> LoadRequestAsync(
        string userId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            throw new NotFoundException("Photographer", userId ?? string.Empty);
        }

        var profile = await _photographerRepository.GetByUserIdAsync(userId, cancellationToken);
        if (profile is null)
        {
            throw new NotFoundException("Photographer", userId);
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
        {
            throw new NotFoundException("User", userId);
        }

        return (user, profile);
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
