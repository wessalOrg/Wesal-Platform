using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Ratings;

public sealed class RatingService : IRatingService
{
    private readonly IRatingRepository _ratingRepository;
    private readonly IHallRepository _hallRepository;
    private readonly ICurrentUserService _currentUser;

    public RatingService(
        IRatingRepository ratingRepository,
        IHallRepository hallRepository,
        ICurrentUserService currentUser)
    {
        _ratingRepository = ratingRepository;
        _hallRepository = hallRepository;
        _currentUser = currentUser;
    }

    public async Task<RatingResponse> CreateRatingAsync(
        CreateRatingRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticated();
        EnsureNotHallOwner();
        EnsureRegisteredUser();

        var hall = await _hallRepository.GetHallByIdAsync(request.HallId, cancellationToken);

        if (hall is null || hall.IsDeleted || hall.Status != HallStatus.Approved)
        {
            throw new NotFoundException(nameof(Hall), request.HallId);
        }

        var userId = _currentUser.UserId!;
        var existingRating = await _ratingRepository.GetByHallAndUserAsync(request.HallId, userId, cancellationToken);

        if (existingRating is not null)
        {
            throw new ConflictException("You have already rated this hall. Use the update endpoint to change your rating.");
        }

        var rating = new Rating
        {
            HallId = request.HallId,
            UserId = userId,
            Value = request.Value
        };

        await _ratingRepository.AddAsync(rating, cancellationToken);

        var (average, total, _) = await _ratingRepository.GetSummaryAsync(request.HallId, userId, cancellationToken);

        return new RatingResponse
        {
            RatingId = rating.Id,
            HallId = rating.HallId,
            Value = rating.Value,
            AverageRating = average,
            TotalRatings = total
        };
    }

    public async Task<RatingResponse> UpdateRatingAsync(
        UpdateRatingRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticated();
        EnsureNotHallOwner();
        EnsureRegisteredUser();

        var hall = await _hallRepository.GetHallByIdAsync(request.HallId, cancellationToken);

        if (hall is null || hall.IsDeleted || hall.Status != HallStatus.Approved)
        {
            throw new NotFoundException(nameof(Hall), request.HallId);
        }

        var userId = _currentUser.UserId!;
        var existingRating = await _ratingRepository.GetByHallAndUserAsync(request.HallId, userId, cancellationToken);

        if (existingRating is null)
        {
            throw new NotFoundException("Rating", new { request.HallId, UserId = userId });
        }

        existingRating.Value = request.Value;
        await _ratingRepository.UpdateAsync(existingRating, cancellationToken);

        var (average, total, _) = await _ratingRepository.GetSummaryAsync(request.HallId, userId, cancellationToken);

        return new RatingResponse
        {
            RatingId = existingRating.Id,
            HallId = existingRating.HallId,
            Value = existingRating.Value,
            AverageRating = average,
            TotalRatings = total
        };
    }

    public async Task<HallRatingSummary> GetHallRatingSummaryAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken);

        if (hall is null || hall.IsDeleted || hall.Status != HallStatus.Approved)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        var (average, total, userRating) = await _ratingRepository.GetSummaryAsync(
            hallId,
            _currentUser.IsAuthenticated && !string.IsNullOrWhiteSpace(_currentUser.UserId) ? _currentUser.UserId : null,
            cancellationToken);

        return new HallRatingSummary
        {
            HallId = hallId,
            AverageRating = average,
            TotalRatings = total,
            UserRating = userRating
        };
    }

    private void EnsureAuthenticated()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to rate a hall.");
        }
    }

    private void EnsureNotHallOwner()
    {
        if (_currentUser.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Hall owners cannot rate halls.");
        }
    }

    private void EnsureRegisteredUser()
    {
        if (!_currentUser.Roles.Contains(ApplicationRoles.RegisteredUser, StringComparer.OrdinalIgnoreCase)
            && !_currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only registered users can rate halls.");
        }
    }
}
