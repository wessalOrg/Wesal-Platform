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
        EnsureCanRate();

        var hall = await RequireApprovedHallAsync(request.HallId, cancellationToken);
        var userId = _currentUser.UserId!;
        var existing = await _ratingRepository.GetByHallAndUserAsync(hall.Id, userId, cancellationToken);
        if (existing is not null)
        {
            throw new ConflictException("You have already rated this hall. Use the update endpoint to change your rating.");
        }

        var rating = new Rating
        {
            HallId = hall.Id,
            UserId = userId,
            Value = request.Value
        };

        await _ratingRepository.AddAsync(rating, cancellationToken);
        return await BuildResponseAsync(rating, cancellationToken);
    }

    public async Task<RatingResponse> UpdateRatingAsync(
        UpdateRatingRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        EnsureCanRate();

        var hall = await RequireApprovedHallAsync(request.HallId, cancellationToken);
        var userId = _currentUser.UserId!;
        var existing = await _ratingRepository.GetByHallAndUserAsync(hall.Id, userId, cancellationToken);
        if (existing is null)
        {
            throw new NotFoundException("Rating", new { request.HallId, UserId = userId });
        }

        existing.Value = request.Value;
        await _ratingRepository.UpdateAsync(existing, cancellationToken);
        return await BuildResponseAsync(existing, cancellationToken);
    }

    public async Task<HallRatingSummary> GetHallRatingSummaryAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var hall = await RequireApprovedHallAsync(hallId, cancellationToken);

        int? userRating = null;
        if (_currentUser.IsAuthenticated && !string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            var existing = await _ratingRepository.GetByHallAndUserAsync(hall.Id, _currentUser.UserId, cancellationToken);
            userRating = existing?.Value;
        }

        return new HallRatingSummary
        {
            HallId = hall.Id,
            AverageRating = await _ratingRepository.GetAverageRatingAsync(hall.Id, cancellationToken),
            TotalRatings = await _ratingRepository.GetTotalRatingsAsync(hall.Id, cancellationToken),
            UserRating = userRating
        };
    }

    private async Task<Hall> RequireApprovedHallAsync(Guid hallId, CancellationToken cancellationToken)
    {
        var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken);
        if (hall is null || hall.IsDeleted || hall.Status != HallStatus.Approved)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        return hall;
    }

    private async Task<RatingResponse> BuildResponseAsync(Rating rating, CancellationToken cancellationToken)
    {
        return new RatingResponse
        {
            RatingId = rating.Id,
            HallId = rating.HallId,
            Value = rating.Value,
            AverageRating = await _ratingRepository.GetAverageRatingAsync(rating.HallId, cancellationToken),
            TotalRatings = await _ratingRepository.GetTotalRatingsAsync(rating.HallId, cancellationToken)
        };
    }

    private void EnsureCanRate()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to rate a hall.");
        }

        if (_currentUser.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Hall owners cannot rate halls.");
        }

        if (!_currentUser.Roles.Contains(ApplicationRoles.RegisteredUser, StringComparer.OrdinalIgnoreCase)
            && !_currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only registered users can rate halls.");
        }
    }
}
