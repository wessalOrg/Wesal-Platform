using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Publishing;

public sealed class HallOfferService : IHallOfferService
{
    private readonly ICurrentUserService _currentUser;
    private readonly IHallRepository _halls;
    private readonly IHallOfferRepository _offers;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IValidator<CreateHallOfferRequest> _createValidator;
    private readonly IValidator<UpdateHallOfferRequest> _updateValidator;
    private readonly TimeProvider _clock;

    public HallOfferService(ICurrentUserService currentUser, IHallRepository halls, IHallOfferRepository offers,
        IUnitOfWork unitOfWork, IValidator<CreateHallOfferRequest> createValidator,
        IValidator<UpdateHallOfferRequest> updateValidator, TimeProvider clock)
    {
        _currentUser = currentUser; _halls = halls; _offers = offers; _unitOfWork = unitOfWork;
        _createValidator = createValidator; _updateValidator = updateValidator; _clock = clock;
    }

    public async Task<Guid> CreateAsync(Guid hallId, CreateHallOfferRequest request, CancellationToken cancellationToken = default)
    {
        await PublishingContentHelper.ValidateAsync(_createValidator, request, cancellationToken);
        var hall = await GetOwnedHallAsync(hallId, cancellationToken);
        var now = _clock.GetUtcNow();
        var startsAt = request.StartsAt.ToUniversalTime();
        var endsAt = request.EndsAt.ToUniversalTime();
        var offer = new HallOffer
        {
            HallId = hall.Id, OldBookingPrice = request.OldBookingPrice, OfferPrice = request.OfferPrice,
            StartsAt = startsAt, EndsAt = endsAt, CreatedAt = now
        };
        try
        {
            await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                await _offers.LockHallForOfferAsync(hallId, cancellationToken);
                // Release the hall's single-active/scheduled slot when a prior offer has ended.
                await _offers.MarkExpiredForHallAsync(hallId, now, cancellationToken);
                if (await _offers.HasOverlappingAsync(hallId, startsAt, endsAt, now, cancellationToken: cancellationToken))
                    throw new ConflictException("This hall already has an overlapping active or scheduled offer.");
                await _offers.AddAsync(offer, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }, cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            throw new ConflictException("This hall already has an active or scheduled offer.");
        }
        return offer.Id;
    }

    public async Task UpdateAsync(Guid hallId, Guid offerId, UpdateHallOfferRequest request, CancellationToken cancellationToken = default)
    {
        await PublishingContentHelper.ValidateAsync(_updateValidator, request, cancellationToken);
        await GetOwnedHallAsync(hallId, cancellationToken);
        var offer = await _offers.GetForUpdateAsync(hallId, offerId, cancellationToken) ?? throw new NotFoundException("Hall offer", offerId);
        var now = _clock.GetUtcNow();
        if (offer.StoppedAt is not null || offer.EndsAt <= now) throw new ConflictException("An ended or stopped hall offer cannot be edited.");
        var startsAt = request.StartsAt.ToUniversalTime();
        var endsAt = request.EndsAt.ToUniversalTime();
        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _offers.LockHallForOfferAsync(hallId, cancellationToken);
            if (await _offers.HasOverlappingAsync(hallId, startsAt, endsAt, now, offerId, cancellationToken))
                throw new ConflictException("This hall already has an overlapping active or scheduled offer.");
            offer.OldBookingPrice = request.OldBookingPrice; offer.OfferPrice = request.OfferPrice;
            offer.StartsAt = startsAt; offer.EndsAt = endsAt; offer.UpdatedAt = now;
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);
    }

    public async Task StopAsync(Guid hallId, Guid offerId, CancellationToken cancellationToken = default)
    {
        await GetOwnedHallAsync(hallId, cancellationToken);
        var offer = await _offers.GetForUpdateAsync(hallId, offerId, cancellationToken) ?? throw new NotFoundException("Hall offer", offerId);
        var now = _clock.GetUtcNow();
        if (offer.StoppedAt is not null || offer.EndsAt <= now) throw new ConflictException("An ended or stopped hall offer cannot be stopped again.");
        offer.StoppedAt = now; offer.UpdatedAt = now;
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<PagedResult<HallOfferDto>> ListOwnAsync(Guid hallId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        await GetOwnedHallAsync(hallId, cancellationToken);
        var window = PublishingContentHelper.PageWindow(page, pageSize);
        var rows = await _offers.ListOwnAsync(hallId, window.Skip, window.Size, cancellationToken);
        var total = await _offers.CountOwnAsync(hallId, cancellationToken);
        return PagedResult<HallOfferDto>.Create(rows.Select(ToDto).ToArray(), window.Page, window.Size, total);
    }

    public async Task<HallOfferDto?> GetActiveForHallAsync(Guid hallId, CancellationToken cancellationToken = default)
    {
        var offer = await _offers.GetActiveForHallAsync(hallId, _clock.GetUtcNow(), cancellationToken);
        return offer is null ? null : ToDto(offer);
    }

    private async Task<Hall> GetOwnedHallAsync(Guid hallId, CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId)) throw new UnauthorizedException("You must be logged in.");
        if (!_currentUser.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase))
            throw new ForbiddenException("Only hall owners can manage hall offers.");
        var hall = await _halls.GetHallByIdAsync(hallId, cancellationToken);
        if (hall is null || !string.Equals(hall.OwnerId, _currentUser.UserId, StringComparison.Ordinal))
            throw new NotFoundException("Hall", hallId);
        return hall;
    }

    private static HallOfferDto ToDto(HallOffer offer) => new()
    {
        Id = offer.Id, HallId = offer.HallId, HallName = offer.Hall.Name,
        MainImageUrl = offer.Hall.MainImageUrl, OldBookingPrice = offer.OldBookingPrice,
        OfferPrice = offer.OfferPrice, StartsAt = offer.StartsAt, EndsAt = offer.EndsAt,
        StoppedAt = offer.StoppedAt
    };

    private static bool IsUniqueViolation(DbUpdateException exception)
        => exception.InnerException?.GetType().GetProperty("SqlState")?.GetValue(exception.InnerException) as string == "23505";
}
