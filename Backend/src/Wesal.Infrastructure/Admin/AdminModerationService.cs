using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Conversations;

namespace Wesal.Infrastructure.Admin;

public sealed class AdminModerationService : IAdminModerationService
{
    private readonly IAdminModerationRepository _moderation;
    private readonly IUserPublishingRestrictionRepository _restrictions;
    private readonly IUserNotificationWriter _notificationWriter;
    private readonly INotificationService _notificationService;
    private readonly INotificationDispatcher _dispatcher;
    private readonly IUnitOfWork _unitOfWork;
    private readonly UserManager<ApplicationUser> _users;
    private readonly ICurrentUserService _currentUser;
    private readonly IIdentityDocumentStore _files;
    private readonly TimeProvider _clock;
    private readonly ILogger<AdminModerationService> _logger;
    private readonly IConversationPresenceTracker _presence;
    private readonly IMessageAttachmentStore? _messageAttachments;

    public AdminModerationService(IAdminModerationRepository moderation, IUserPublishingRestrictionRepository restrictions,
        IUserNotificationWriter notificationWriter, INotificationService notificationService, INotificationDispatcher dispatcher,
        IUnitOfWork unitOfWork, UserManager<ApplicationUser> users, ICurrentUserService currentUser,
        IIdentityDocumentStore files, TimeProvider clock, ILogger<AdminModerationService> logger,
        IConversationPresenceTracker presence, IMessageAttachmentStore? messageAttachments = null)
    {
        _moderation = moderation; _restrictions = restrictions; _notificationWriter = notificationWriter;
        _notificationService = notificationService; _dispatcher = dispatcher; _unitOfWork = unitOfWork;
        _users = users; _currentUser = currentUser; _files = files; _clock = clock; _logger = logger;
        _presence = presence;
        _messageAttachments = messageAttachments;
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

    public async Task<PublishingRestrictionStatusResponse> RestrictPublishingAsync(string userId, CreatePublishingRestrictionRequest request, CancellationToken cancellationToken = default)
    {
        if (request.DurationHours is < ModerationLimits.MinimumRestrictionHours or > ModerationLimits.MaximumRestrictionHours)
            throw new ValidationException($"Restriction duration must be between {ModerationLimits.MinimumRestrictionHours} and {ModerationLimits.MaximumRestrictionHours} hours.");
        var reason = SanitizeOptionalReason(request.Reason);
        var user = await _users.FindByIdAsync(userId) ?? throw new NotFoundException("User", userId);
        await RequireProfessionalUserAsync(user);
        var now = _clock.GetUtcNow();
        var endsAt = now.AddHours(request.DurationHours);
        var period = FormatArabicPeriod(request.DurationHours);
        var values = new Dictionary<string, string?> { [NotificationTokens.Period] = period };
        var content = await _notificationService.BuildAsync(NotificationKind.PublishingRestricted, userId, values, cancellationToken: cancellationToken);
        try
        {
            await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                await _restrictions.AcquireUserLockAsync(userId, cancellationToken);
                await _restrictions.LiftExpiredAsync(now, cancellationToken);
                if (await _restrictions.GetActiveAsync(userId, now, cancellationToken) is not null)
                    throw new ConflictException("This user already has an active publishing restriction.");
                await _restrictions.AddAsync(new UserPublishingRestriction
                {
                    Id = Guid.NewGuid(), UserId = userId, StartsAt = now, EndsAt = endsAt,
                    Reason = reason, CreatedByAdminId = _currentUser.UserId ?? string.Empty, CreatedAt = now
                }, cancellationToken);
                user.ContentPublishingRestrictedUntil = endsAt;
                await AddNotificationAsync(userId, NotificationKind.PublishingRestricted, content, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }, cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("23505", StringComparison.Ordinal) == true)
        {
            throw new ConflictException("This user already has an active publishing restriction.");
        }
        await _dispatcher.DispatchAsync(NotificationKind.PublishingRestricted, userId, values, cancellationToken: cancellationToken);
        return new PublishingRestrictionStatusResponse { IsRestricted = true, RestrictedUntil = endsAt };
    }

    public async Task<PublishingRestrictionStatusResponse> GetRestrictionAsync(string userId, CancellationToken cancellationToken = default)
    {
        var user = await _users.FindByIdAsync(userId) ?? throw new NotFoundException("User", userId);
        var now = _clock.GetUtcNow();
        var until = await _restrictions.GetActiveEndsAtAsync(userId, now, cancellationToken);
        if (until is null && user.ContentPublishingRestrictedUntil is { } legacyUntil && legacyUntil > now)
            until = legacyUntil;
        return new PublishingRestrictionStatusResponse { IsRestricted = until.HasValue, RestrictedUntil = until };
    }

    public async Task<AdminActionResult> DeleteAccountAsync(string userId, DeleteAccountRequest request, CancellationToken cancellationToken = default)
    {
        if (!request.Confirm) throw new ValidationException("Set confirm to true to permanently delete this account.");
        if (string.Equals(_currentUser.UserId, userId, StringComparison.OrdinalIgnoreCase))
            throw new ValidationException("An administrator cannot delete their own account.");
        var user = await _users.FindByIdAsync(userId) ?? throw new NotFoundException("User", userId);
        await RequireProfessionalUserAsync(user);
        AccountCleanupSnapshot snapshot;
        try
        {
            snapshot = await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                var cleanup = await _moderation.DeleteProfessionalAccountDataAsync(userId, cancellationToken);
                var result = await _users.DeleteAsync(user);
                if (!result.Succeeded)
                    throw new ConflictException("The account has linked records and cannot be deleted safely.");
                return cleanup;
            }, cancellationToken);
        }
        catch (DbUpdateException)
        {
            throw new ConflictException("The account has linked records and cannot be deleted safely.");
        }
        await DeleteFilesBestEffortAsync(snapshot.FileKeys);
        if (_messageAttachments is not null)
        {
            foreach (var attachment in snapshot.MessageAttachmentUrls)
            {
                try { await _messageAttachments.DeleteAsync(attachment, CancellationToken.None); }
                catch (Exception ex) { _logger.LogWarning(ex, "Admin moderation message attachment cleanup failed."); }
            }
        }
        _presence.DisconnectUser(userId);
        var total = snapshot.Counts.Values.Sum();
        return new AdminActionResult { Success = true, RemovedCount = total, RemovedItems = snapshot.Counts };
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
        var clean = new string(value.Trim().Where(ch => !char.IsControl(ch)).ToArray());
        return clean.Length == 0 ? null : clean;
    }

    private static string FormatArabicPeriod(int hours)
    {
        var days = hours / 24;
        var remainder = hours % 24;
        if (remainder != 0) return FormatArabicQuantity(remainder, "\u0633\u0627\u0639\u0629", "\u0633\u0627\u0639\u062A\u064A\u0646", "\u0633\u0627\u0639\u0627\u062A", "\u0633\u0627\u0639\u0629") + (days > 0 ? " \u0648" + FormatArabicQuantity(days, "\u064A\u0648\u0645", "\u064A\u0648\u0645\u064A\u0646", "\u0623\u064A\u0627\u0645", "\u064A\u0648\u0645\u0627") : string.Empty);
        return FormatArabicQuantity(days, "\u064A\u0648\u0645", "\u064A\u0648\u0645\u064A\u0646", "\u0623\u064A\u0627\u0645", "\u064A\u0648\u0645\u0627");
    }
    private static string FormatArabicQuantity(int count, string singular, string dual, string plural, string many)
        => count switch { 1 => singular, 2 => dual, >= 3 and <= 10 => $"{count} {plural}", _ => $"{count} {many}" };

    private async Task DeleteFilesBestEffortAsync(IEnumerable<string> keys)
    {
        foreach (var key in keys.Distinct(StringComparer.Ordinal))
        {
            try { await _files.DeleteAsync(key, CancellationToken.None); }
            catch (Exception ex) { _logger.LogWarning(ex, "Admin moderation file cleanup failed."); }
        }
    }
}
