using System.Text.RegularExpressions;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Services;

public sealed class EventRequestService(ApplicationDbContext db,
    ICurrentUserService current, IUnitOfWork unit, IValidator<EventRequestCreateRequest> validator,
    IAccountLockService locks, INotificationDispatcher dispatcher, IOptions<EventRequestOptions> options, ILogger<EventRequestService> logger) : IEventRequestService
{
    private static readonly EventTypeConfiguration[] Configuration =
    [
        new(EventType.GRADUATION, EventTypeLabels.Get(EventType.GRADUATION), "هل تحتاج لقاعة أو مكان تعمل فيه حفل تخرجك؟", "هل تحتاج لمحلات تزيين وهدايا؟", "هل تحتاج لمصورين؟"),
        new(EventType.WEDDING, EventTypeLabels.Get(EventType.WEDDING), "هل تحتاج لقاعة أو مكان تعمل فيه حفل زفافك؟", "هل تحتاج لمحلات تزيين وهدايا؟", "هل تحتاج لمصورين؟"),
        new(EventType.NEWBORN, EventTypeLabels.Get(EventType.NEWBORN), "هل تحتاج لقاعة أو مكان تعمل فيه حفل استقبال المولود؟", "هل تحتاج لمحلات تزيين وهدايا؟", "هل تحتاج لمصورين؟"),
        new(EventType.WORKSHOP, EventTypeLabels.Get(EventType.WORKSHOP), "هل تحتاج لقاعة أو مكان تعمل فيه ورشة العمل؟", "هل تحتاج لمحلات تزيين وهدايا؟", "هل تحتاج لمصورين؟"),
        new(EventType.IMPORTANT_EVENT, EventTypeLabels.Get(EventType.IMPORTANT_EVENT), "هل تحتاج لقاعة أو مكان تعمل فيه الحدث؟", "هل تحتاج لمحلات تزيين وهدايا؟", "هل تحتاج لمصورين؟"),
        new(EventType.YOUTH_PARTY, EventTypeLabels.Get(EventType.YOUTH_PARTY), "هل تحتاج لقاعة أو مكان تعمل فيه الحفلة؟", "هل تحتاج لمحلات تزيين وهدايا؟", "هل تحتاج لمصورين؟")
    ];

    public Task<IReadOnlyList<EventTypeConfiguration>> GetConfigurationAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<EventTypeConfiguration>>(Configuration);

    public async Task<EventRequestResponse> CreateAsync(EventRequestCreateRequest request, CancellationToken ct = default)
    {
        if (!current.IsAuthenticated || string.IsNullOrWhiteSpace(current.UserId)) throw new UnauthorizedException("Authentication is required.");
        if (!current.Roles.Contains(ApplicationRoles.RegisteredUser, StringComparer.OrdinalIgnoreCase)) throw new ForbiddenException("Only registered users can submit event requests.");
        await validator.ValidateAndThrowAsync(request, ct);
        var seekerId = current.UserId;
        var now = DateTimeOffset.UtcNow;
        var sanitized = SanitizeName(request.FullName!);
        if (sanitized.Length == 0) throw new Wesal.Domain.Exceptions.ValidationException("الاسم غير صالح.");
        var entity = new EventRequest { SeekerId = seekerId, SeekerFullName = sanitized, EventDate = request.EventDate!.Value,
            EventType = request.EventType!.Value, NeedsHall = request.NeedsHall!.Value,
            NeedsDecorationAndGifts = request.NeedsDecorationAndGifts!.Value, NeedsPhotographers = request.NeedsPhotographers!.Value, CreatedAt = now };
        await unit.ExecuteInTransactionAsync(async () =>
        {
            if (db.Database.ProviderName?.Contains("Npgsql", StringComparison.Ordinal) == true)
            {
                var lockKey = "event-request:" + seekerId;
                await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({lockKey}))", ct);
            }
            if (await db.EventRequests.CountAsync(x => x.SeekerId == seekerId && x.CreatedAt >= now.AddHours(-1), ct) >= Math.Max(1, options.Value.MaxPerHour))
                throw new TooManyRequestsException("تم تجاوز الحد المسموح لطلبات المناسبات خلال ساعة.");
            var same = await db.EventRequests.AnyAsync(x => x.SeekerId == seekerId && x.CreatedAt >= now.AddMinutes(-Math.Clamp(options.Value.DuplicateWindowMinutes, 1, 1440))
                && x.EventDate == request.EventDate && x.EventType == request.EventType
                && x.NeedsHall == request.NeedsHall && x.NeedsDecorationAndGifts == request.NeedsDecorationAndGifts
                && x.NeedsPhotographers == request.NeedsPhotographers, ct);
            if (same) throw new ConflictException("تم إرسال طلب مطابق مؤخراً.");
            await db.EventRequests.AddAsync(entity, ct);
            await unit.SaveChangesAsync(ct);
        }, ct);
        var services = new List<ServiceType>();
        if (entity.NeedsHall) services.Add(ServiceType.HALL);
        if (entity.NeedsDecorationAndGifts) services.Add(ServiceType.DECORATION_GIFTS);
        if (entity.NeedsPhotographers) services.Add(ServiceType.PHOTOGRAPHY);
        return new(entity.Id, entity.CreatedAt, entity.EventDate, entity.EventType, Configuration.Single(x => x.Value == entity.EventType).Label, services);
    }

    public async Task ProcessPendingAsync(CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var pending = await db.EventRequests.Where(x => !x.FanoutCompleted && (x.FanoutNextAttemptAt == null || x.FanoutNextAttemptAt <= now))
            .OrderBy(x => x.CreatedAt).Take(10).ToListAsync(ct);
        foreach (var request in pending)
        {
            try { await ProcessOneAsync(request, ct); }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception ex)
            {
                request.FanoutAttempts++;
                var seconds = Math.Min(3600, 5 * Math.Pow(2, Math.Min(request.FanoutAttempts, 10)));
                request.FanoutNextAttemptAt = DateTimeOffset.UtcNow.AddSeconds(seconds);
                await db.SaveChangesAsync(ct);
                logger.LogError(ex, "Event request fan-out failed for {EventRequestId}; retry {Attempt} at {RetryAt}", request.Id, request.FanoutAttempts, request.FanoutNextAttemptAt);
            }
        }
    }

    private async Task ProcessOneAsync(EventRequest request, CancellationToken ct)
    {
        var roleMap = new Dictionary<ServiceType, string>();
        if (request.NeedsHall) roleMap[ServiceType.HALL] = ApplicationRoles.HallOwner;
        if (request.NeedsDecorationAndGifts) roleMap[ServiceType.DECORATION_GIFTS] = ApplicationRoles.EventCoordinator;
        if (request.NeedsPhotographers) roleMap[ServiceType.PHOTOGRAPHY] = ApplicationRoles.Photographer;
        var label = Configuration.Single(x => x.Value == request.EventType).Label;
        foreach (var (service, roleName) in roleMap)
        {
            var roleId = await db.Roles.Where(x => x.Name == roleName).Select(x => x.Id).FirstOrDefaultAsync(ct);
            if (roleId is null) continue;
            var offset = 0;
            while (true)
            {
                var batch = await (from ur in db.UserRoles join user in db.Users on ur.UserId equals user.Id
                    where ur.RoleId == roleId && user.Id != request.SeekerId
                    orderby user.Id select user).Skip(offset).Take(Math.Clamp(options.Value.FanoutBatchSize, 10, 500)).ToListAsync(ct);
                // SQL role lookup is paged. Lockout and admin/system account-lock state are
                // checked for every service, including halls, so a locked provider never
                // receives new event-request notifications.
                if (batch.Count == 0) break;
                offset += batch.Count;
                var locked = await locks.GetLockedUserIdsAsync(batch.Select(x => x.Id).ToArray(), ct);
                foreach (var provider in batch)
                {
                    if (provider.LockoutEnd is { } end && end > DateTimeOffset.UtcNow) continue;
                    if (service != ServiceType.HALL && (provider.ApprovalStatus != AccountApprovalStatus.Approved || !provider.IsSetupComplete)) continue;
                    if (locked.Contains(provider.Id)) continue;
                    await DeliverToProviderAsync(request, provider, service, label, ct);
                }
            }
        }
        request.FanoutCompleted = true;
        request.FanoutNextAttemptAt = null;
        await db.SaveChangesAsync(ct);
    }

    private async Task DeliverToProviderAsync(EventRequest request, ApplicationUser provider, ServiceType service, string label, CancellationToken ct)
    {
        if (await db.EventRequestNotificationTargets.AnyAsync(x => x.EventRequestId == request.Id && x.ProviderId == provider.Id && x.ServiceType == service, ct)) return;
        var conversation = await db.Conversations.FirstOrDefaultAsync(x => x.Kind == ConversationKind.CustomerProvider && x.SenderUserId == request.SeekerId && x.HallOwnerId == provider.Id, ct);
        if (conversation is null)
        {
            conversation = new Conversation { SenderUserId = request.SeekerId, HallOwnerId = provider.Id, Kind = ConversationKind.CustomerProvider,
                EventRequestId = request.Id, EventRequestServiceType = service, CreatedAt = DateTimeOffset.UtcNow };
            db.Conversations.Add(conversation);
            await db.SaveChangesAsync(ct);
        }
        else
        {
            conversation.EventRequestId = request.Id;
            conversation.EventRequestServiceType = service;
        }
        var kind = service switch { ServiceType.HALL => NotificationKind.EVENT_REQUEST_HALL, ServiceType.DECORATION_GIFTS => NotificationKind.EVENT_REQUEST_DECORATION_GIFTS, _ => NotificationKind.EVENT_REQUEST_PHOTOGRAPHY };
        var notificationId = Guid.NewGuid();
        var payload = System.Text.Json.JsonSerializer.Serialize(new { eventRequestId = request.Id, seekerId = request.SeekerId,
            fullName = request.SeekerFullName, eventDate = request.EventDate, eventType = request.EventType.ToString(), serviceType = service.ToString() });
        var notification = NotificationCatalog.Render(kind, provider.PreferredLanguage,
            new Dictionary<string, string?> { [NotificationTokens.EventSeekerName] = request.SeekerFullName,
                [NotificationTokens.Date] = request.EventDate.ToString("yyyy-MM-dd"), [NotificationTokens.EventType] = label }, conversation.Id.ToString());
        db.UserNotifications.Add(new UserNotification { Id = notificationId, RecipientUserId = provider.Id, Kind = kind,
            Language = provider.PreferredLanguage == Language.English ? "en" : "ar", Title = notification.Title, Body = notification.Body,
            ActionLabel = notification.ActionLabel, ActionTarget = notification.ActionTarget, TargetId = conversation.Id.ToString(),
            ConversationId = conversation.Id, PayloadJson = payload, CreatedAt = DateTimeOffset.UtcNow });
        var target = new EventRequestNotificationTarget { Id = Guid.NewGuid(), EventRequestId = request.Id,
            ProviderId = provider.Id, ServiceType = service, NotificationId = notificationId, ConversationId = conversation.Id, CreatedAt = DateTimeOffset.UtcNow };
        db.EventRequestNotificationTargets.Add(target);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("23505", StringComparison.Ordinal) == true)
        {
            db.Entry(notification).State = EntityState.Detached;
            db.Entry(target).State = EntityState.Detached;
            return;
        }
        try { await dispatcher.DispatchAsync(kind, provider.Id, new Dictionary<string, string?> { [NotificationTokens.EventSeekerName] = request.SeekerFullName,
            [NotificationTokens.Date] = request.EventDate.ToString("yyyy-MM-dd"), [NotificationTokens.EventType] = label }, conversation.Id.ToString(), ct); }
        catch (Exception ex) { logger.LogWarning(ex, "Realtime event notification failed for {EventRequestId}", request.Id); }
    }

    public async Task<PagedResult<AdminEventRequestResponse>> GetAdminRequestsAsync(int page, int pageSize, DateOnly? from, DateOnly? to, string? eventType, string? seekerId, CancellationToken ct = default)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.EventRequests.AsNoTracking().AsQueryable();
        if (from.HasValue) query = query.Where(x => x.EventDate >= from);
        if (to.HasValue) query = query.Where(x => x.EventDate <= to);
        if (!string.IsNullOrWhiteSpace(seekerId)) query = query.Where(x => x.SeekerId == seekerId);
        if (!string.IsNullOrWhiteSpace(eventType) && Enum.TryParse<EventType>(eventType, true, out var parsed)) query = query.Where(x => x.EventType == parsed);
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new AdminEventRequestResponse(x.Id, x.SeekerId, x.SeekerFullName, x.EventDate, x.EventType, x.NeedsHall, x.NeedsDecorationAndGifts, x.NeedsPhotographers, x.CreatedAt)).ToListAsync(ct);
        return PagedResult<AdminEventRequestResponse>.Create(rows, page, pageSize, total);
    }

    public Task<AdminEventRequestResponse?> GetAdminRequestAsync(Guid id, CancellationToken ct = default)
        => db.EventRequests.AsNoTracking().Where(x => x.Id == id).Select(x => new AdminEventRequestResponse(
            x.Id, x.SeekerId, x.SeekerFullName, x.EventDate, x.EventType, x.NeedsHall, x.NeedsDecorationAndGifts,
            x.NeedsPhotographers, x.CreatedAt)).FirstOrDefaultAsync(ct);

    private static string SanitizeName(string input)
    {
        var noMarkup = Regex.Replace(input, "<[^>]*>", string.Empty);
        var safe = new string(noMarkup.Where(c => !char.IsControl(c)).ToArray()).Trim();
        return safe.Length > 120 ? safe[..120] : safe;
    }
}
