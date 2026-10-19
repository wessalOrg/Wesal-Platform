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

namespace Wesal.Infrastructure.Coordinators;

/// <summary>
/// Event Coordinator account setup (WESAL coordinator setup).
///
/// The submission always applies to the authenticated caller's own account — the
/// acting user is resolved exclusively from the session, never from the request, so a
/// coordinator can never submit setup data for another account.
///
/// Consistency model: every file is validated and written to the private document
/// store FIRST (a database record must never point at bytes the store rejected); then
/// the coordinator profile row, the durable "request received" notification, and the
/// account flags (setup complete + Pending approval) are committed in ONE database
/// transaction. If any of those database operations fails, the transaction rolls back
/// and the already-uploaded files are deleted, so a failure can never leave the account
/// falsely marked as setup-complete. The realtime push that follows the commit is
/// best-effort and never affects the persisted result.
///
/// Documents are stored in the protected document area only (never public media); no
/// response produced by this service contains a document URL or storage key.
/// </summary>
public sealed class CoordinatorSetupService : ICoordinatorSetupService
{
    private const int ExpectedWorkPhotoCount = 2;

    private readonly ICurrentUserService _currentUser;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IValidator<CoordinatorSetupRequest> _validator;
    private readonly IIdentityDocumentStore _documentStore;
    private readonly ICoordinatorRepository _coordinatorRepository;
    private readonly IUserNotificationWriter _notificationWriter;
    private readonly IUnitOfWork _unitOfWork;
    private readonly INotificationService _notificationService;
    private readonly INotificationDispatcher _notificationDispatcher;
    private readonly ILogger<CoordinatorSetupService> _logger;

    public CoordinatorSetupService(
        ICurrentUserService currentUser,
        UserManager<ApplicationUser> userManager,
        IValidator<CoordinatorSetupRequest> validator,
        IIdentityDocumentStore documentStore,
        ICoordinatorRepository coordinatorRepository,
        IUserNotificationWriter notificationWriter,
        IUnitOfWork unitOfWork,
        INotificationService notificationService,
        INotificationDispatcher notificationDispatcher,
        ILogger<CoordinatorSetupService> logger)
    {
        _currentUser = currentUser;
        _userManager = userManager;
        _validator = validator;
        _documentStore = documentStore;
        _coordinatorRepository = coordinatorRepository;
        _notificationWriter = notificationWriter;
        _unitOfWork = unitOfWork;
        _notificationService = notificationService;
        _notificationDispatcher = notificationDispatcher;
        _logger = logger;
    }

    public async Task<CoordinatorSetupResult> SubmitSetupAsync(
        CoordinatorSetupSubmission submission,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var user = await ResolveCoordinatorUserAsync(cancellationToken);

        EnsureNotAlreadySubmitted(user);

        ValidateForm(submission.Form);

        var (shopPhoto, workPhotos, identityDocument) = ValidateAttachments(submission);

        // Bytes first: files are durably written before any database row references
        // them, and every saved handle is tracked so a later failure can compensate.
        var savedDocuments = new List<string>();
        string? shopPhotoUrl = null;
        string? workPhoto1Url = null;
        string? workPhoto2Url = null;
        string identityDocumentUrl;

        try
        {
            if (shopPhoto is not null)
            {
                shopPhotoUrl = await SaveDocumentAsync(user.Id, shopPhoto, cancellationToken);
                savedDocuments.Add(shopPhotoUrl);
            }

            if (workPhotos is not null)
            {
                workPhoto1Url = await SaveDocumentAsync(user.Id, workPhotos[0], cancellationToken);
                savedDocuments.Add(workPhoto1Url);

                workPhoto2Url = await SaveDocumentAsync(user.Id, workPhotos[1], cancellationToken);
                savedDocuments.Add(workPhoto2Url);
            }

            identityDocumentUrl = await SaveDocumentAsync(user.Id, identityDocument!, cancellationToken);
            savedDocuments.Add(identityDocumentUrl);

            var profile = new CoordinatorProfile
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                BusinessType = submission.Form.BusinessType!.Value,
                ShopName = TrimOrNull(submission.Form.ShopName),
                ShopLocation = TrimOrNull(submission.Form.ShopLocation),
                ShopPhotoUrl = shopPhotoUrl,
                OnlineStoreName = TrimOrNull(submission.Form.OnlineStoreName),
                WorkPhoto1Url = workPhoto1Url,
                WorkPhoto2Url = workPhoto2Url,
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
                    NotificationKind.CoordinatorSetupReceivedForCoordinator,
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

                await _coordinatorRepository.AddAsync(profile, cancellationToken);

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
                    NotificationKind.CoordinatorSetupReceivedForCoordinator,
                    user.Id,
                    values: null,
                    targetId: null,
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Realtime dispatch of the coordinator setup notification failed for user {UserId} after commit",
                    user.Id);
            }

            return new CoordinatorSetupResult
            {
                IsSetupComplete = true,
                ApprovalStatus = AccountApprovalStatus.Pending,
                BusinessType = profile.BusinessType,
                SubmittedAt = submittedAt
            };
        }
        catch
        {
            // The transaction already rolled back any database change. Compensate the
            // storage side for exactly the files this request wrote; cleanup failures
            // are logged (relative key only, never credentials or content) and never
            // mask the original exception.
            await TryDeleteDocumentsAsync(savedDocuments, cancellationToken);
            throw;
        }
    }

    private async Task<ApplicationUser> ResolveCoordinatorUserAsync(CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to submit your coordinator setup.");
        }

        if (!_currentUser.Roles.Any(role => string.Equals(role, ApplicationRoles.EventCoordinator, StringComparison.OrdinalIgnoreCase)))
        {
            throw new ForbiddenException("Only Event Coordinators can submit coordinator setup data.");
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
            throw new ConflictException("The coordinator setup has already been submitted.");
        }
    }

    private void ValidateForm(CoordinatorSetupRequest form)
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
    /// Validates the branch's attachments and rejects files the branch does not accept,
    /// so a shop submission can never smuggle work photos (or vice versa) past the
    /// branch contract. Returns the validated uploads for the selected branch.
    /// </summary>
    private static (OwnerDocumentUpload? ShopPhoto, List<OwnerDocumentUpload>? WorkPhotos, OwnerDocumentUpload? IdentityDocument)
        ValidateAttachments(CoordinatorSetupSubmission submission)
    {
        var businessType = submission.Form.BusinessType!.Value;

        OwnerDocumentUpload? shopPhoto = null;
        List<OwnerDocumentUpload>? workPhotos = null;

        if (businessType == CoordinatorBusinessType.Shop)
        {
            if (submission.ShopPhoto is null)
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    ["ShopPhoto"] = new[] { "A shop photo is required." }
                });
            }

            DocumentUploadValidator.EnsureValidImage(submission.ShopPhoto);
            shopPhoto = submission.ShopPhoto;

            if (submission.WorkPhotos is not null && submission.WorkPhotos.Count > 0)
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    ["WorkPhotos"] = new[] { "Work photos are only accepted for freelance coordinators." }
                });
            }
        }
        else
        {
            if (submission.ShopPhoto is not null)
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    ["ShopPhoto"] = new[] { "A shop photo is only accepted for coordinators who have a shop." }
                });
            }

            var submitted = submission.WorkPhotos ?? Array.Empty<OwnerDocumentUpload>();
            if (submitted.Count != ExpectedWorkPhotoCount)
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    ["WorkPhotos"] = new[] { $"Exactly {ExpectedWorkPhotoCount} work photos are required." }
                });
            }

            workPhotos = new List<OwnerDocumentUpload>(ExpectedWorkPhotoCount);
            foreach (var workPhoto in submitted)
            {
                DocumentUploadValidator.EnsureValidImage(workPhoto);
                workPhotos.Add(workPhoto);
            }
        }

        if (submission.IdentityDocument is null)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["IdentityDocument"] = new[] { "A personal ID document is required." }
            });
        }

        DocumentUploadValidator.EnsureValid(submission.IdentityDocument);

        return (shopPhoto, workPhotos, submission.IdentityDocument);
    }

    private async Task<string> SaveDocumentAsync(
        string userId,
        OwnerDocumentUpload upload,
        CancellationToken cancellationToken)
    {
        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(upload.FileName).ToLowerInvariant()}";
        var relativeUrl = DocumentPath.CoordinatorDocumentRelativeUrl(userId, fileName);

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
                    "Failed to clean up coordinator document {DocumentKey} after a failed setup submission",
                    relativeUrl);
            }
        }
    }

    private static string? TrimOrNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public async Task<CoordinatorSetupResult> ResubmitSetupAsync(
        CoordinatorSetupSubmission submission,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var user = await ResolveCoordinatorUserAsync(cancellationToken);

        // Only allow resubmit from Rejected status (per Task 7)
        if (user.ApprovalStatus != AccountApprovalStatus.Rejected)
        {
            throw new ConflictException("Coordinator resubmission is only allowed when the account is rejected.");
        }

        ValidateForm(submission.Form);
        var (shopPhoto, workPhotos, identityDocument) = ValidateAttachments(submission);

        var savedDocuments = new List<string>();
        string? shopPhotoUrl = null;
        string? workPhoto1Url = null;
        string? workPhoto2Url = null;
        string identityDocumentUrl;

        try
        {
            if (shopPhoto is not null)
            {
                shopPhotoUrl = await SaveDocumentAsync(user.Id, shopPhoto, cancellationToken);
                savedDocuments.Add(shopPhotoUrl);
            }

            if (workPhotos is not null)
            {
                workPhoto1Url = await SaveDocumentAsync(user.Id, workPhotos[0], cancellationToken);
                savedDocuments.Add(workPhoto1Url);
                workPhoto2Url = await SaveDocumentAsync(user.Id, workPhotos[1], cancellationToken);
                savedDocuments.Add(workPhoto2Url);
            }

            identityDocumentUrl = await SaveDocumentAsync(user.Id, identityDocument!, cancellationToken);
            savedDocuments.Add(identityDocumentUrl);

            var profile = await _coordinatorRepository.GetByUserIdAsync(user.Id, cancellationToken);
            if (profile is null)
            {
                throw new NotFoundException("CoordinatorProfile", user.Id);
            }

            profile.BusinessType = submission.Form.BusinessType!.Value;
            profile.ShopName = TrimOrNull(submission.Form.ShopName);
            profile.ShopLocation = TrimOrNull(submission.Form.ShopLocation);
            profile.ShopPhotoUrl = shopPhotoUrl;
            profile.OnlineStoreName = TrimOrNull(submission.Form.OnlineStoreName);
            profile.WorkPhoto1Url = workPhoto1Url;
            profile.WorkPhoto2Url = workPhoto2Url;
            profile.PhoneNumber = submission.Form.PhoneNumber!.Trim();
            profile.IdentityDocumentUrl = identityDocumentUrl;
            profile.SubmittedAt = DateTimeOffset.UtcNow;

            var submittedAt = profile.SubmittedAt;

            await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                var content = await _notificationService.BuildAsync(
                    NotificationKind.CoordinatorSetupReceivedForCoordinator,
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

                await _coordinatorRepository.UpdateAsync(profile, cancellationToken);

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
                    NotificationKind.CoordinatorSetupReceivedForCoordinator,
                    user.Id,
                    values: null,
                    targetId: null,
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Realtime dispatch of the coordinator resubmit notification failed for user {UserId} after commit",
                    user.Id);
            }

            return new CoordinatorSetupResult
            {
                IsSetupComplete = true,
                ApprovalStatus = AccountApprovalStatus.Pending,
                BusinessType = profile.BusinessType,
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
