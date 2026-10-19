using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Favorites;

/// <summary>
/// The authenticated user's saved halls ("المفضلة"). The owner is resolved from the session,
/// so a caller can only read or change their own favorites, and every operation is idempotent.
/// </summary>
public sealed class HallFavoritesService : IHallFavoritesService
{
    private readonly IHallFavoriteRepository _favorites;
    private readonly IHallRepository _halls;
    private readonly ICurrentUserService _currentUser;
    private readonly TimeProvider _clock;

    public HallFavoritesService(
        IHallFavoriteRepository favorites,
        IHallRepository halls,
        ICurrentUserService currentUser,
        TimeProvider clock)
    {
        _favorites = favorites;
        _halls = halls;
        _currentUser = currentUser;
        _clock = clock;
    }

    public Task<IReadOnlyList<Guid>> ListFavoriteHallIdsAsync(CancellationToken cancellationToken = default)
        => _favorites.ListHallIdsAsync(RequireUserId(), cancellationToken);

    public async Task AddAsync(Guid hallId, CancellationToken cancellationToken = default)
    {
        var userId = RequireUserId();
        var hall = await _halls.GetHallByIdAsync(hallId, cancellationToken);
        if (hall is null || hall.IsDeleted)
        {
            throw new NotFoundException("Hall not found.");
        }

        await _favorites.AddAsync(userId, hallId, _clock.GetUtcNow(), cancellationToken);
    }

    public Task RemoveAsync(Guid hallId, CancellationToken cancellationToken = default)
        => _favorites.RemoveAsync(RequireUserId(), hallId, cancellationToken);

    private string RequireUserId()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to manage favorites.");
        }

        return _currentUser.UserId;
    }
}
