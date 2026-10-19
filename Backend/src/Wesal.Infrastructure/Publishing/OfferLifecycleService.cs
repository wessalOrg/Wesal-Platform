using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Publishing;

public sealed class OfferLifecycleService : IOfferLifecycleService
{
    private readonly IProfessionalOfferRepository _offers;
    private readonly IHallOfferRepository _hallOffers;
    private readonly IUnitOfWork _unitOfWork;
    private readonly INotificationService _notifications;
    private readonly IUserNotificationWriter _writer;
    private readonly INotificationDispatcher _dispatcher;
    private readonly UserManager<ApplicationUser> _users;
    private readonly TimeProvider _clock;

    public OfferLifecycleService(IProfessionalOfferRepository offers, IHallOfferRepository hallOffers,
        IUnitOfWork unitOfWork, INotificationService notifications, IUserNotificationWriter writer,
        INotificationDispatcher dispatcher, UserManager<ApplicationUser> users, TimeProvider clock)
    {
        _offers = offers; _hallOffers = hallOffers; _unitOfWork = unitOfWork; _notifications = notifications;
        _writer = writer; _dispatcher = dispatcher; _users = users; _clock = clock;
    }

    public async Task ProcessAsync(CancellationToken cancellationToken = default)
    {
        var now = _clock.GetUtcNow();
        var reminders = await _offers.GetReminderCandidatesAsync(now, cancellationToken);
        foreach (var offer in reminders)
        {
            var claimed = await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                if (!await _offers.TryClaimReminderAsync(offer.Id, now, cancellationToken)) return false;
                await AddNotificationAsync(offer.OwnerUserId, NotificationKind.ProfessionalOfferReminder24Hours, offer.Id, now, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                return true;
            }, cancellationToken);
            if (claimed)
                await _dispatcher.DispatchAsync(NotificationKind.ProfessionalOfferReminder24Hours, offer.OwnerUserId,
                    targetId: offer.Id.ToString(), cancellationToken: cancellationToken);
        }

        var expired = await _offers.GetExpiryCandidatesAsync(now, cancellationToken);
        foreach (var offer in expired)
        {
            var role = await ResolveOfferEndKindAsync(offer.OwnerUserId);
            var claimed = await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                if (!await _offers.TryClaimExpiryAsync(offer.Id, now, cancellationToken)) return false;
                await AddNotificationAsync(offer.OwnerUserId, role, offer.Id, now, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                return true;
            }, cancellationToken);
            if (claimed)
                await _dispatcher.DispatchAsync(role, offer.OwnerUserId, targetId: offer.Id.ToString(), cancellationToken: cancellationToken);
        }

        // Hall offers need no owner notice. Marking them releases the single scheduled-offer slot;
        // visibility itself is still governed by the time-window query.
        var expiredHallOffers = await _hallOffers.GetExpiredUnprocessedAsync(now, cancellationToken);
        foreach (var offer in expiredHallOffers)
        {
            await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                if (await _hallOffers.TryClaimExpiryAsync(offer.Id, now, cancellationToken))
                    await _unitOfWork.SaveChangesAsync(cancellationToken);
            }, cancellationToken);
        }
    }

    private async Task<NotificationKind> ResolveOfferEndKindAsync(string ownerId)
    {
        var owner = await _users.FindByIdAsync(ownerId);
        return owner is not null && await _users.IsInRoleAsync(owner, ApplicationRoles.Photographer)
            ? NotificationKind.ProfessionalOfferEndedForPhotographer
            : NotificationKind.ProfessionalOfferEndedForCoordinator;
    }

    private async Task AddNotificationAsync(string userId, NotificationKind kind, Guid id, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var content = await _notifications.BuildAsync(kind, userId, targetId: id.ToString(), cancellationToken: cancellationToken);
        await _writer.AddAsync(new UserNotification
        {
            Id = Guid.NewGuid(), RecipientUserId = userId, Kind = kind, Language = SupportedLanguages.ToCode(content.Language),
            Title = content.Title, Body = content.Body, ActionLabel = content.ActionLabel,
            ActionTarget = content.ActionTarget, TargetId = content.TargetId, CreatedAt = now
        }, cancellationToken);
    }
}

public sealed class OfferLifecycleBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OfferLifecycleBackgroundService> _logger;

    public OfferLifecycleBackgroundService(IServiceScopeFactory scopeFactory, ILogger<OfferLifecycleBackgroundService> logger)
    {
        _scopeFactory = scopeFactory; _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                await scope.ServiceProvider.GetRequiredService<IOfferLifecycleService>().ProcessAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception exception) { _logger.LogError(exception, "Offer lifecycle processing failed."); }
            try { await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
