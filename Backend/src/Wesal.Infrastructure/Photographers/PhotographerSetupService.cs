using FluentValidation;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Documents;
using Wesal.Infrastructure.Identity;
using ValidationException = Wesal.Domain.Exceptions.ValidationException;

namespace Wesal.Infrastructure.Photographers;

/// <summary>
/// Photographer account setup (WESAL photographer setup).
///
/// The submission always applies to the authenticated caller's own account — the
/// acting user is resolved exclusively from the session, never from the request, so a
/// photographer can never submit setup data for another account.
///
/// Consistency model: the personal ID document is validated and written to the private
/// document store FIRST (a database record must never point at bytes the store
/// rejected); then the photographer profile row, the durable "request received"
/// notification, and the account flags (setup complete + Pending approval) are
/// committed in ONE database transaction. If any of those database operations fails,
/// the transaction rolls back and the already-uploaded file is deleted, so a failure
/// can never leave the account falsely marked as setup-complete. The realtime push
/// that follows the commit is best-effort and never affects the persisted result.
///
/// The no-studio branch's full name is STRICTLY ADMINISTRATOR-ONLY: it is persisted on
/// the protected profile column and is never included in any result, notification, or
/// log produced by this service.
///
/// Documents are stored in the protected document area only (never public media); no
/// response produced by this service contains a document URL or storage key.
/// </summary>
public sealed class PhotographerSetupService : IPhotographerSetupService
{
    private readonly ICurrentUserService _currentUser;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IValidator<PhotographerSetupRequest> _validator;
    private readonly IIdentityDocumentStore _documentStore;
    private readonly IPhotographerRepository _photographerRepository;
    private readonly IUserNotificationWriter _notificationWriter;
    private readonly IUnitOfWork _unitOfWork;
    private readonly INotificationService _notificationService;
    private readonly INotificationDispatcher _notificationDispatcher;
    private readonly ILogger<PhotographerSetupService> _logger;

    public PhotographerSetupService(
        ICurrentUserService currentUser,
        UserManager<ApplicationUser> userManager,
        IValidator<PhotographerSetupRequest> validator,
        IIdentityDocumentStore documentStore,
        IPhotographerRepository photographerRepository,
        IUserNotificationWriter notificationWriter,
        IUnitOfWork unitOfWork,
        INotificationService notificationService,
        INotificationDispatcher notificationDispatcher,
        ILogger<PhotographerSetupService> logger)
    {
        _currentUser = currentUser;
        _userManager = userManager;
        _validator = validator;
        _documentStore = documentStore;
        _photographerRepository = photographerRepository;
        _notificationWriter = notificationWriter;
        _unitOfWork = unitOfWork;
        _notificationService = notificationService;
        _notificationDispatcher = notificationDispatcher;
        _logger = logger;
    }

    public async Task<PhotographerSetupResult> SubmitSetupAsync(
        PhotographerSetupSubmission submission,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var user = await ResolvePhotographerUserAsync(cancellationToken);

        EnsureNotAlreadySubmitted(user);

        ValidateForm(submission.Form);

        var identityDocument = ValidateAttachments(submission);

        // Bytes first: the file is durably written before any database row references
        // it, and the saved handle is tracked so a later failure can compensate.
        var savedDocuments = new List<string>();
        string identityDocumentUrl;

        try
        {
            identityDocumentUrl = await SaveDocumentAsync(user.Id, identityDocument!, cancellationToken);
            savedDocuments.Add(identityDocumentUrl);

            var hasStudio = submission.Form.HasStudio!.Value;

            var profile = new PhotographerProfile
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                HasStudio = hasStudio,
                StudioName = hasStudio ? TrimOrNull(submission.Form.StudioName) : null,
                StudioLocation = hasStudio ? TrimOrNull(submission.Form.StudioLocation) : null,
                DetailedStudioLocation = hasStudio ? TrimOrNull(submission.Form.DetailedStudioLocation) : null,
                FullName = hasStudio ? null : TrimOrNull(submission.Form.FullName),
                PhoneNumber = submission.Form.PhoneNumber!.Trim(),
                IdentityDocumentUrl = identityDocumentUrl,
                SubmittedAt = DateTimeOffset.UtcNow
            };

            var submittedAt = profile.SubmittedAt;

            // Profile row, durable notification, and account flags commit atomically:
            // a failure of ANY database operation rolls the whole submission back, so
            // the account is never falsely marked setup-complete and the "request
            // received" notification is never reported persisted when it is not.
            await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                var content = await _notificationService.BuildAsync(
                    NotificationKind.PhotographerSetupReceivedForPhotographer,
                    user.Id,
                    values: null,
                    targetId: null,
                    cancellationToken);

                await _notificationWriter.AddAsync(new UserNotification
                {
                    Id = Guid.NewGuid(),
                    RecipientUserId = user.Id,
                    Kind = content.Kind,
                    Language = SupportedLanguages.ToCode(content.Language),
                    Title = content.Title,
                    Body = content.Body,
                    ActionLabel = content.ActionLabel,
                    ActionTarget = content.ActionTarget,
                    TargetId = content.TargetId,
                    CreatedAt = DateTimeOffset.UtcNow,
                    ReadAt = null
                }, cancellationToken);

                await _photographerRepository.AddAsync(profile, cancellationToken);

                user.IsSetupComplete = true;
                user.ApprovalStatus = AccountApprovalStatus.Pending;

                var updateResult = await _userManager.UpdateAsync(user);
                if (!updateResult.Succeeded)
                {
                    var errors = updateResult.Errors
                        .GroupBy(e => e.Code)
                        .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray());
                    throw new ValidationException(errors.Count > 0
                        ? errors
                        : new Dictionary<string, string[]> { ["Setup"] = new[] { "The setup could not be saved; please try again." } });
                }

                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }, cancellationToken);

            // The submission is committed. The realtime push is a best-effort twin of
            // the durable row: it runs in its own guard so a SignalR failure can never
            // fail the response, and — critically — can never trigger the storage
            // cleanup path for documents the committed transaction already references.
            try
            {
                await _notificationDispatcher.DispatchAsync(
                    NotificationKind.PhotographerSetupReceivedForPhotographer,
                    user.Id,
                    values: null,
                    targetId: null,
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Realtime dispatch of the photographer setup notification failed for user {UserId} after commit",
                    user.Id);
            }

            return new PhotographerSetupResult
            {
                IsSetupComplete = true,
                ApprovalStatus = AccountApprovalStatus.Pending,
                HasStudio = hasStudio,
                SubmittedAt = submittedAt
            };
        }
        catch
        {
            // The transaction already rolled back any database change. Compensate the
            // storage side for exactly the file this request wrote; cleanup failures
            // are logged (relative key only, never credentials or content) and never
            // mask the original exception.
            await TryDeleteDocumentsAsync(savedDocuments, cancellationToken);
            throw;
        }
    }

    private async Task<ApplicationUser> ResolvePhotographerUserAsync(CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to submit your photographer setup.");
        }

        if (!_currentUser.Roles.Any(role => string.Equals(role, ApplicationRoles.Photographer, StringComparison.OrdinalIgnoreCase)))
        {
            throw new ForbiddenException("Only Photographers can submit photographer setup data.");
        }

        var user = await _userManager.FindByIdAsync(_currentUser.UserId);
        if (user is null)
        {
            throw new NotFoundException("User", _currentUser.UserId);
        }

        return user;
    }

    private void EnsureNotAlreadySubmitted(ApplicationUser user)
    {
        if (user.IsSetupComplete)
        {
            throw new ConflictException("The photographer setup has already been submitted.");
        }
    }

    private void ValidateForm(PhotographerSetupRequest form)
    {
        var validationResult = _validator.Validate(form);
        if (!validationResult.IsValid)
        {
            throw new ValidationException(validationResult.Errors
                .GroupBy(failure => failure.PropertyName)
                .ToDictionary(
                    group => group.Key,
                    group => group.Select(failure => failure.ErrorMessage).ToArray()));
        }
    }

    /// <summary>
    /// Validates the required personal ID document. Both branches require it, and the
    /// shared identity-document policy (jpg/jpeg/png/webp/PDF, 5 MB, magic-byte check)
    /// is applied unchanged.
    /// </summary>
    private static OwnerDocumentUpload? ValidateAttachments(PhotographerSetupSubmission submission)
    {
        if (submission.IdentityDocument is null)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["IdentityDocument"] = new[] { "A personal ID document is required." }
            });
        }

        DocumentUploadValidator.EnsureValid(submission.IdentityDocument);

        return submission.IdentityDocument;
    }

    private async Task<string> SaveDocumentAsync(
        string userId,
        OwnerDocumentUpload upload,
        CancellationToken cancellationToken)
    {
        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(upload.FileName).ToLowerInvariant()}";
        var relativeUrl = DocumentPath.PhotographerDocumentRelativeUrl(userId, fileName);

        // A write the store rejects throws here; nothing has been persisted in the
        // database yet, so the account cannot be left falsely marked setup-complete.
        await _documentStore.SaveAsync(relativeUrl, upload.Content, cancellationToken);

        return relativeUrl;
    }

    private async Task TryDeleteDocumentsAsync(IReadOnlyList<string> relativeUrls, CancellationToken cancellationToken)
    {
        foreach (var relativeUrl in relativeUrls)
        {
            try
            {
                await _documentStore.DeleteAsync(relativeUrl, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Failed to clean up photographer document {DocumentKey} after a failed setup submission",
                    relativeUrl);
            }
        }
    }

    private static string? TrimOrNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public async Task<PhotographerSetupResult> ResubmitSetupAsync(
        PhotographerSetupSubmission submission,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var user = await ResolvePhotographerUserAsync(cancellationToken);

        // Allowed only when Rejected or NeedsChanges
        if (user.ApprovalStatus != AccountApprovalStatus.Rejected &&
            user.ApprovalStatus != AccountApprovalStatus.NeedsChanges)
        {
            throw new ConflictException("Photographer resubmission is only allowed when the account is rejected or needs changes.");
        }

        ValidateForm(submission.Form);
        var identityDocument = ValidateAttachments(submission);

        var savedDocuments = new List<string>();
        string identityDocumentUrl;

        try
        {
            identityDocumentUrl = await SaveDocumentAsync(user.Id, identityDocument!, cancellationToken);
            savedDocuments.Add(identityDocumentUrl);

            var hasStudio = submission.Form.HasStudio!.Value;

            var profile = await _photographerRepository.GetByUserIdAsync(user.Id, cancellationToken);
            if (profile is null)
            {
                throw new NotFoundException("PhotographerProfile", user.Id);
            }

            profile.HasStudio = hasStudio;
            profile.StudioName = hasStudio ? TrimOrNull(submission.Form.StudioName) : null;
            profile.StudioLocation = hasStudio ? TrimOrNull(submission.Form.StudioLocation) : null;
            profile.DetailedStudioLocation = hasStudio ? TrimOrNull(submission.Form.DetailedStudioLocation) : null;
            profile.FullName = hasStudio ? null : TrimOrNull(submission.Form.FullName);
            profile.PhoneNumber = submission.Form.PhoneNumber!.Trim();
            profile.IdentityDocumentUrl = identityDocumentUrl;
            profile.SubmittedAt = DateTimeOffset.UtcNow;

            var submittedAt = profile.SubmittedAt;

            await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                var content = await _notificationService.BuildAsync(
                    NotificationKind.PhotographerSetupReceivedForPhotographer,
                    user.Id,
                    values: null,
                    targetId: null,
                    cancellationToken);

                await _notificationWriter.AddAsync(new UserNotification
                {
                    Id = Guid.NewGuid(),
                    RecipientUserId = user.Id,
                    Kind = content.Kind,
                    Language = SupportedLanguages.ToCode(content.Language),
                    Title = content.Title,
                    Body = content.Body,
                    ActionLabel = content.ActionLabel,
                    ActionTarget = content.ActionTarget,
                    TargetId = content.TargetId,
                    CreatedAt = DateTimeOffset.UtcNow,
                    ReadAt = null
                }, cancellationToken);

                await _photographerRepository.UpdateAsync(profile, cancellationToken);

                user.IsSetupComplete = true;
                user.ApprovalStatus = AccountApprovalStatus.Pending;

                var updateResult = await _userManager.UpdateAsync(user);
                if (!updateResult.Succeeded)
                {
                    var errors = updateResult.Errors
                        .GroupBy(e => e.Code)
                        .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray());
                    throw new ValidationException(errors.Count > 0
                        ? errors
                        : new Dictionary<string, string[]> { ["Setup"] = new[] { "The setup could not be saved; please try again." } });
                }

                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }, cancellationToken);

            try
            {
                await _notificationDispatcher.DispatchAsync(
                    NotificationKind.PhotographerSetupReceivedForPhotographer,
                    user.Id,
                    values: null,
                    targetId: null,
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Realtime dispatch of the photographer resubmit notification failed for user {UserId} after commit",
                    user.Id);
            }

            return new PhotographerSetupResult
            {
                IsSetupComplete = true,
                ApprovalStatus = AccountApprovalStatus.Pending,
                HasStudio = profile.HasStudio,
                SubmittedAt = submittedAt
            };
        }
        catch
        {
            await TryDeleteDocumentsAsync(savedDocuments, cancellationToken);
            throw;
        }
    }
}
