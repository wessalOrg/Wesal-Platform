using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

/// <summary>One shared SQL visibility predicate for profiles and the future Discover Offers feed.</summary>
public static class ProfessionalOfferVisibility
{
    public static IQueryable<ProfessionalOffer> VisibleAt(this IQueryable<ProfessionalOffer> query, IQueryable<ApplicationUser> users, DateTimeOffset now)
        => query.Where(offer => offer.StoppedAt == null && offer.StartsAt <= now && now < offer.EndsAt
            && offer.ExpiredProcessedAt == null
            && users.Any(user => user.Id == offer.OwnerUserId && user.ApprovalStatus == AccountApprovalStatus.Approved));
}

public sealed class ProfessionalOfferRepository(ApplicationDbContext context) : IProfessionalOfferRepository
{
    public async Task AddAsync(ProfessionalOffer offer, CancellationToken cancellationToken = default)
        => await context.ProfessionalOffers.AddAsync(offer, cancellationToken);

    public void AddImage(ProfessionalOfferImage image) => context.ProfessionalOfferImages.Add(image);

    public Task<ProfessionalOffer?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken = default)
        => context.ProfessionalOffers.Include(offer => offer.Images).FirstOrDefaultAsync(offer => offer.Id == id, cancellationToken);

    public Task<ProfessionalOffer?> GetAccessibleAsync(Guid id, string? ownerId, DateTimeOffset now, CancellationToken cancellationToken = default)
        => AccessibleOffers(ownerId, now).Include(offer => offer.Images)
            .FirstOrDefaultAsync(offer => offer.Id == id, cancellationToken);

    private IQueryable<ProfessionalOffer> AccessibleOffers(string? ownerId, DateTimeOffset now)
    {
        var own = context.ProfessionalOffers.AsNoTracking().Where(offer => ownerId != null && offer.OwnerUserId == ownerId);
        var visible = context.ProfessionalOffers.AsNoTracking().VisibleAt(context.Users, now);
        return own.Concat(visible);
    }

    public async Task<IReadOnlyList<ProfessionalOffer>> ListOwnAsync(string ownerId, int skip, int take, CancellationToken cancellationToken = default)
        => await context.ProfessionalOffers.AsNoTracking().Include(offer => offer.Images)
            .Where(offer => offer.OwnerUserId == ownerId).OrderByDescending(offer => offer.CreatedAt).ThenBy(offer => offer.Id)
            .Skip(skip).Take(take).ToListAsync(cancellationToken);

    public Task<int> CountOwnAsync(string ownerId, CancellationToken cancellationToken = default)
        => context.ProfessionalOffers.CountAsync(offer => offer.OwnerUserId == ownerId, cancellationToken);

    public async Task<IReadOnlyList<ProfessionalOffer>> ListVisibleByOwnerAsync(string ownerId, DateTimeOffset now, int skip, int take, CancellationToken cancellationToken = default)
        => await VisibleForOwner(ownerId, now).Include(offer => offer.Images)
            .OrderByDescending(offer => offer.CreatedAt).ThenBy(offer => offer.Id)
            .Skip(skip).Take(take).ToListAsync(cancellationToken);

    public Task<int> CountVisibleByOwnerAsync(string ownerId, DateTimeOffset now, CancellationToken cancellationToken = default)
        => VisibleForOwner(ownerId, now).CountAsync(cancellationToken);

    private IQueryable<ProfessionalOffer> VisibleForOwner(string ownerId, DateTimeOffset now)
        => context.ProfessionalOffers.AsNoTracking().VisibleAt(context.Users, now)
            .Where(offer => offer.OwnerUserId == ownerId);

    public async Task<IReadOnlyList<ProfessionalOffer>> GetReminderCandidatesAsync(DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        var latestDue = now.Add(OfferReminderSchedule.LeadTime);
        var windowStart = now.Add(OfferReminderSchedule.LeadTime - OfferReminderSchedule.GraceWindow);
        return await context.ProfessionalOffers.AsNoTracking().Where(offer => offer.ReminderEligible && !offer.HasBeenEdited
            && offer.ReminderSentAt == null && offer.StoppedAt == null && offer.ExpiredProcessedAt == null
            && offer.EndsAt > windowStart && offer.EndsAt <= latestDue)
            .OrderBy(offer => offer.EndsAt).Take(500).ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ProfessionalOffer>> GetExpiryCandidatesAsync(DateTimeOffset now, CancellationToken cancellationToken = default)
        => await context.ProfessionalOffers.AsNoTracking().Where(offer => offer.EndsAt <= now
            && offer.ExpiredProcessedAt == null && offer.StoppedAt == null)
            .OrderBy(offer => offer.EndsAt).Take(500).ToListAsync(cancellationToken);

    public async Task<bool> TryClaimReminderAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        var latestDue = now.Add(OfferReminderSchedule.LeadTime);
        var windowStart = now.Add(OfferReminderSchedule.LeadTime - OfferReminderSchedule.GraceWindow);
        return await context.ProfessionalOffers.Where(offer => offer.Id == id && offer.ReminderEligible && !offer.HasBeenEdited
            && offer.ReminderSentAt == null && offer.StoppedAt == null && offer.ExpiredProcessedAt == null
            && offer.EndsAt > windowStart && offer.EndsAt <= latestDue)
            .ExecuteUpdateAsync(setters => setters.SetProperty(offer => offer.ReminderSentAt, now), cancellationToken) == 1;
    }

    public async Task<bool> TryClaimExpiryAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default)
        => await context.ProfessionalOffers.Where(offer => offer.Id == id && offer.EndsAt <= now
            && offer.ExpiredProcessedAt == null && offer.StoppedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(offer => offer.ExpiredProcessedAt, now), cancellationToken) == 1;
}
