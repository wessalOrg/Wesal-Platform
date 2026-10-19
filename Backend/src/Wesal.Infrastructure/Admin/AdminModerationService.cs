using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Admin;

public sealed class AdminModerationService : IAdminModerationService
{
    private readonly IAdminModerationRepository _moderation;
    private readonly IAccountLockRepository _restrictions;
    private readonly IUserNotificationWriter _notificationWriter;
    private readonly INotificationService _notificationService;
    private readonly INotificationDispatcher _dispatcher;
    private readonly IUnitOfWork _unitOfWork;
    private readonly UserManager<ApplicationUser> _users;
    private readonly ICurrentUserService _currentUser;
    private readonly IIdentityDocumentStore _files;
    private readonly TimeProvider _clock;
    private readonly ILogger<AdminModerationService> _logger;

    public AdminModerationService(IAdminModerationRepository moderation, IAccountLockRepository restrictions,
        IUserNotificationWriter notificationWriter, INotificationService notificationService, INotificationDispatcher dispatcher,
        IUnitOfWork unitOfWork, UserManager<ApplicationUser> users, ICurrentUserService currentUser,
        IIdentityDocumentStore files, TimeProvider clock, ILogger<AdminModerationService> logger)
    {
        _moderation = moderation; _restrictions = restrictions; _notificationWriter = notificationWriter;
        _notificationService = notificationService; _dispatcher = dispatcher; _unitOfWork = unitOfWork;
        _users = users; _currentUser = currentUser; _files = files; _clock = clock; _logger = logger;
    }

    public async Task<AdminActionResult> DeletePostAsync(Guid postId, string reason, CancellationToken cancellationToken = default)
    {
        var cleanReason = ValidateReason(reason, ModerationLimits.DeletionReasonMaximumLength);
        var post = await _moderation.GetPostForModerationAsync(postId, cancellationToken)
            ?? throw new NotFoundException("Post", postId);
        var owner = await _users.FindByIdAsync(post.OwnerUserId) ?? throw new NotFoundException("User", post.OwnerUserId);
        var kind = await ResolvePostDeletionKindAsync(owner, cancellationToken);
        var values = new Dictionary<string, string?> { [NotificationTokens.Reason] = cleanReason };
        var content = await _notificationService.BuildAsync(kind, owner.Id, values, cancellationToken: cancellationToken);
        var keys = post.Images.Select(row => row.StorageKey).ToArray();
        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            _moderation.RemovePost(post);
            await AddNotificationAsync(owner.Id, kind, content, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);
        await DeleteFilesBestEffortAsync(keys);
        await _dispatcher.DispatchAsync(kind, owner.Id, values, cancellationToken: cancellationToken);
        return new AdminActionResult { Success = true, RemovedCount = 1, RemovedItems = new Dictionary<string, int> { ["posts"] = 1 } };
    }

    public async Task<AdminActionResult> DeleteProfessionalOfferAsync(Guid offerId, string reason, CancellationToken cancellationToken = default)
    {
        var cleanReason = ValidateReason(reason, ModerationLimits.DeletionReasonMaximumLength);
        var offer = await _moderation.GetOfferForModerationAsync(offerId, cancellationToken)
            ?? throw new NotFoundException("Professional offer", offerId);
        var owner = await _users.FindByIdAsync(offer.OwnerUserId) ?? throw new NotFoundException("User", offer.OwnerUserId);
        await RequireProfessionalUserAsync(owner);
        var kind = NotificationKind.ProfessionalOfferDeletedByAdmin;
        var values = new Dictionary<string, string?> { [NotificationTokens.Reason] = cleanReason };
        var content = await _notificationService.BuildAsync(kind, owner.Id, values, cancellationToken: cancellationToken);
        var keys = offer.Images.Select(row => row.StorageKey).ToArray();
        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            _moderation.RemoveOffer(offer);
            await AddNotificationAsync(owner.Id, kind, content, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);
        await DeleteFilesBestEffortAsync(keys);
        await _dispatcher.DispatchAsync(kind, owner.Id, values, cancellationToken: cancellationToken);
        return new AdminActionResult { Success = true, RemovedCount = 1, RemovedItems = new Dictionary<string, int> { ["offers"] = 1 } };
    }

    public async Task<AccountLockStatusResponse> LockAccountAsync(string userId, CreateAccountLockRequest request, CancellationToken cancellationToken = default)
    {
        if (request.DurationHours is < ModerationLimits.MinimumRestrictionHours or > ModerationLimits.MaximumRestrictionHours)
            throw new ValidationException($"Account lock duration must be between {ModerationLimits.MinimumRestrictionHours} and {ModerationLimits.MaximumRestrictionHours} hours.");
        var reason = SanitizeOptionalReason(request.Reason);
        if (reason?.Length > ModerationLimits.RestrictionReasonMaximumLength)
            throw new ValidationException($"Lock reason cannot exceed {ModerationLimits.RestrictionReasonMaximumLength} characters.");
        var user = await _users.FindByIdAsync(userId) ?? throw new NotFoundException("User", userId);
        await RequireProfessionalUserAsync(user);
        var now = _clock.GetUtcNow();
        var endsAt = now.AddHours(request.DurationHours);
        var period = FormatArabicPeriod(request.DurationHours);
        var values = new Dictionary<string, string?> { [NotificationTokens.Period] = period };
        var content = await _notificationService.BuildAsync(NotificationKind.AccountLocked, userId, values, cancellationToken: cancellationToken);
        try
        {
            await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                await _restrictions.AcquireUserLockAsync(userId, cancellationToken);
                await _restrictions.LiftExpiredAsync(now, cancellationToken);
                if (await _restrictions.GetActiveAsync(userId, now, cancellationToken) is not null)
                    throw new ConflictException("This account already has an active lock.");
                await _restrictions.AddAsync(new UserPublishingRestriction
                {
                    Id = Guid.NewGuid(), UserId = userId, StartsAt = now, EndsAt = endsAt,
                    Reason = reason, CreatedByAdminId = _currentUser.UserId ?? string.Empty, CreatedAt = now
                }, cancellationToken);
                await AddNotificationAsync(userId, NotificationKind.AccountLocked, content, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }, cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("23505", StringComparison.Ordinal) == true)
        {
            throw new ConflictException("This account already has an active lock.");
        }
        await _dispatcher.DispatchAsync(NotificationKind.AccountLocked, userId, values, cancellationToken: cancellationToken);
        return new AccountLockStatusResponse { IsLocked = true, LockedUntil = endsAt, Reason = reason };
    }

    public async Task<AccountLockStatusResponse> UnlockAccountAsync(string userId, CancellationToken cancellationToken = default)
    {
        var user = await _users.FindByIdAsync(userId) ?? throw new NotFoundException("User", userId);
        await RequireProfessionalUserAsync(user);
        var now = _clock.GetUtcNow();
        var adminId = _currentUser.UserId ?? string.Empty;
        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _restrictions.AcquireUserLockAsync(userId, cancellationToken);
            await _restrictions.LiftExpiredAsync(now, cancellationToken);
            var active = await _restrictions.GetActiveForUpdateAsync(userId, now, cancellationToken);
            if (active is null)
                throw new NotFoundException("Active account lock", userId);
            active.LiftedAt = now;
            active.LiftedByAdminId = adminId;
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);
        return new AccountLockStatusResponse { IsLocked = false };
    }

    public async Task<AccountLockStatusResponse> GetAccountLockAsync(string userId, CancellationToken cancellationToken = default)
    {
        var user = await _users.FindByIdAsync(userId) ?? throw new NotFoundException("User", userId);
        await RequireProfessionalUserAsync(user);
        var current = await _restrictions.GetActiveAsync(userId, _clock.GetUtcNow(), cancellationToken);
        return new AccountLockStatusResponse { IsLocked = current is not null, LockedUntil = current?.EndsAt, Reason = current?.Reason };
    }

    public async Task<PagedResult<AdminLockedAccountDto>> GetLockedAccountsAsync(string role, string? search, int page, int pageSize,
        CancellationToken cancellationToken = default)
    {
        var normalizedRole = role.Trim();
        if (normalizedRole is not (ApplicationRoles.EventCoordinator or ApplicationRoles.Photographer))
            throw new ValidationException("Choose either the Event Coordinator or Photographer role.");
        var window = AdminPageWindow(page, pageSize);
        var now = _clock.GetUtcNow();
        var count = await _moderation.CountLockedAccountsAsync(normalizedRole, search, now, cancellationToken);
        var items = await _moderation.ListLockedAccountsAsync(normalizedRole, search, now, window.Skip, window.Size, cancellationToken);
        return PagedResult<AdminLockedAccountDto>.Create(items, window.Page, window.Size, count);
    }

    public async Task<PagedResult<AdminModeratedContentDto>> ListAdminPostsAsync(string? ownerId, string? ownerRole,
        int page, int pageSize, CancellationToken cancellationToken = default)
    {
        ValidateOwnerRole(ownerRole);
        var window = AdminPageWindow(page, pageSize);
        var count = await _moderation.CountAdminPostsAsync(ownerId, ownerRole, cancellationToken);
        var items = await _moderation.ListAdminPostsAsync(ownerId, ownerRole, _clock.GetUtcNow(), window.Skip, window.Size, cancellationToken);
        return PagedResult<AdminModeratedContentDto>.Create(items, window.Page, window.Size, count);
    }

    public async Task<AdminModeratedContentDto> GetAdminPostAsync(Guid postId, CancellationToken cancellationToken = default)
        => await _moderation.GetAdminPostAsync(postId, _clock.GetUtcNow(), cancellationToken)
            ?? throw new NotFoundException("Post", postId);

    public async Task<StoredDocument> GetAdminPostImageAsync(Guid postId, Guid imageId, CancellationToken cancellationToken = default)
    {
        var post = await _moderation.GetPostForModerationAsync(postId, cancellationToken)
            ?? throw new NotFoundException("Post", postId);
        var image = post.Images.FirstOrDefault(row => row.Id == imageId) ?? throw new NotFoundException("Post image", imageId);
        var file = await _files.ReadAsync(image.StorageKey, cancellationToken) ?? throw new NotFoundException("Post image", imageId);
        return new StoredDocument { RelativeUrl = image.StorageKey, Content = file.Bytes, ContentType = image.ContentType, FileName = Path.GetFileName(image.StorageKey) };
    }

    public async Task<PagedResult<AdminModeratedContentDto>> ListAdminOffersAsync(string? ownerId, string? ownerRole,
        int page, int pageSize, CancellationToken cancellationToken = default)
    {
        ValidateOwnerRole(ownerRole);
        var window = AdminPageWindow(page, pageSize);
        var count = await _moderation.CountAdminOffersAsync(ownerId, ownerRole, cancellationToken);
        var items = await _moderation.ListAdminOffersAsync(ownerId, ownerRole, _clock.GetUtcNow(), window.Skip, window.Size, cancellationToken);
        return PagedResult<AdminModeratedContentDto>.Create(items, window.Page, window.Size, count);
    }

    public async Task<AdminModeratedContentDto> GetAdminOfferAsync(Guid offerId, CancellationToken cancellationToken = default)
        => await _moderation.GetAdminOfferAsync(offerId, _clock.GetUtcNow(), cancellationToken)
            ?? throw new NotFoundException("Professional offer", offerId);

    public async Task<StoredDocument> GetAdminOfferImageAsync(Guid offerId, Guid imageId, CancellationToken cancellationToken = default)
    {
        var offer = await _moderation.GetOfferForModerationAsync(offerId, cancellationToken)
            ?? throw new NotFoundException("Professional offer", offerId);
        var image = offer.Images.FirstOrDefault(row => row.Id == imageId) ?? throw new NotFoundException("Offer image", imageId);
        var file = await _files.ReadAsync(image.StorageKey, cancellationToken) ?? throw new NotFoundException("Offer image", imageId);
        return new StoredDocument { RelativeUrl = image.StorageKey, Content = file.Bytes, ContentType = image.ContentType, FileName = Path.GetFileName(image.StorageKey) };
    }

    private async Task<NotificationKind> ResolvePostDeletionKindAsync(ApplicationUser owner, CancellationToken cancellationToken)
    {
        if (await _users.IsInRoleAsync(owner, ApplicationRoles.Photographer)) return NotificationKind.PostDeletedByAdminForPhotographer;
        if (await _users.IsInRoleAsync(owner, ApplicationRoles.EventCoordinator)) return NotificationKind.PostDeletedByAdminForCoordinator;
        throw new ConflictException("Only coordinator and photographer posts can be removed by this action.");
    }

    private async Task RequireProfessionalUserAsync(ApplicationUser user)
    {
        if (await _users.IsInRoleAsync(user, ApplicationRoles.Admin))
            throw new ValidationException("Administrators cannot be moderated through this action.");
        if (!await _users.IsInRoleAsync(user, ApplicationRoles.EventCoordinator)
            && !await _users.IsInRoleAsync(user, ApplicationRoles.Photographer))
            throw new ValidationException("Only coordinators and photographers are eligible for this action.");
    }

    private async Task AddNotificationAsync(string userId, NotificationKind kind, NotificationContent content, CancellationToken cancellationToken)
        => await _notificationWriter.AddAsync(new UserNotification
        {
            Id = Guid.NewGuid(), RecipientUserId = userId, Kind = kind,
            Language = SupportedLanguages.ToCode(content.Language), Title = content.Title, Body = content.Body,
            ActionLabel = content.ActionLabel, ActionTarget = content.ActionTarget, TargetId = content.TargetId, CreatedAt = _clock.GetUtcNow()
        }, cancellationToken);

    private static string ValidateReason(string? value, int max)
    {
        var reason = SanitizeOptionalReason(value);
        if (string.IsNullOrWhiteSpace(reason)) throw new ValidationException("A deletion reason is required.");
        if (reason.Length > max) throw new ValidationException($"Reason cannot exceed {max} characters.");
        return reason;
    }

    private static string? SanitizeOptionalReason(string? value)
    {
        if (value is null) return null;
        var withoutMarkup = Regex.Replace(value, "<[^>]*>", string.Empty);
        var clean = new string(withoutMarkup.Trim().Where(ch => !char.IsControl(ch)).ToArray());
        return clean.Length == 0 ? null : clean;
    }

    private static string FormatArabicPeriod(int hours)
    {
        var days = hours / 24;
        var remainder = hours % 24;
        if (remainder != 0) return (days > 0 ? FormatArabicQuantity(days, "\u064A\u0648\u0645", "\u064A\u0648\u0645\u064A\u0646", "\u0623\u064A\u0627\u0645", "\u064A\u0648\u0645\u0627") + " \u0648" : string.Empty)
            + FormatArabicQuantity(remainder, "\u0633\u0627\u0639\u0629", "\u0633\u0627\u0639\u062A\u064A\u0646", "\u0633\u0627\u0639\u0627\u062A", "\u0633\u0627\u0639\u0629");
        return FormatArabicQuantity(days, "\u064A\u0648\u0645", "\u064A\u0648\u0645\u064A\u0646", "\u0623\u064A\u0627\u0645", "\u064A\u0648\u0645\u0627");
    }
    private static string FormatArabicQuantity(int count, string singular, string dual, string plural, string many)
        => count switch { 1 => singular, 2 => dual, >= 3 and <= 10 => $"{count} {plural}", _ => $"{count} {many}" };

    private static (int Page, int Size, int Skip) AdminPageWindow(int page, int pageSize)
    {
        var normalizedPage = page <= 0 ? 1 : page;
        var normalizedSize = pageSize <= 0 ? 10 : Math.Min(pageSize, 50);
        if ((long)(normalizedPage - 1) * normalizedSize + normalizedSize > int.MaxValue)
            throw new ValidationException("The requested page is too large.");
        return (normalizedPage, normalizedSize, (normalizedPage - 1) * normalizedSize);
    }

    private static void ValidateOwnerRole(string? role)
    {
        if (!string.IsNullOrWhiteSpace(role)
            && !role.Equals(ApplicationRoles.EventCoordinator, StringComparison.OrdinalIgnoreCase)
            && !role.Equals(ApplicationRoles.Photographer, StringComparison.OrdinalIgnoreCase))
            throw new ValidationException("Owner role must be EventCoordinator or Photographer.");
    }

    private async Task DeleteFilesBestEffortAsync(IEnumerable<string> keys)
    {
        foreach (var key in keys.Distinct(StringComparer.Ordinal))
        {
            try { await _files.DeleteAsync(key, CancellationToken.None); }
            catch (Exception ex) { _logger.LogWarning(ex, "Admin moderation file cleanup failed."); }
        }
    }
}
