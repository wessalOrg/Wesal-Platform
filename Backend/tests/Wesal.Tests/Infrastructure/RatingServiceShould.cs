using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Ratings;

namespace Wesal.Tests.Infrastructure;

public class RatingServiceShould
{
    [Fact]
    public async Task CreateRatingAsync_Guest_ThrowsUnauthorized()
    {
        var service = CreateService(authenticated: false);
        var hallId = SeedApprovedHall();

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.CreateRatingAsync(new CreateRatingRequest { HallId = hallId, Value = 5 }));
    }

    [Fact]
    public async Task CreateRatingAsync_HallOwner_ThrowsForbidden()
    {
        var service = CreateService(authenticated: true, roles: [ApplicationRoles.HallOwner]);
        var hallId = SeedApprovedHall();

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateRatingAsync(new CreateRatingRequest { HallId = hallId, Value = 4 }));
    }

    [Fact]
    public async Task CreateRatingAsync_RegisteredUser_StoresRating()
    {
        var halls = new FakeHallRepository();
        var ratings = new FakeRatingRepository();
        var hallId = Guid.NewGuid();
        halls.Halls.Add(new Hall { Id = hallId, Status = HallStatus.Approved, Name = "Test" });
        var service = CreateService(
            authenticated: true,
            userId: "user-1",
            roles: [ApplicationRoles.RegisteredUser],
            halls,
            ratings);

        var result = await service.CreateRatingAsync(new CreateRatingRequest { HallId = hallId, Value = 5 });

        Assert.Equal(5, result.Value);
        Assert.Equal(5, result.AverageRating);
        Assert.Equal(1, result.TotalRatings);
        Assert.Equal(hallId, result.HallId);
    }

    [Fact]
    public async Task GetHallRatingSummaryAsync_ReturnsUserRatingWhenAuthenticated()
    {
        var halls = new FakeHallRepository();
        var ratings = new FakeRatingRepository();
        var hallId = Guid.NewGuid();
        halls.Halls.Add(new Hall { Id = hallId, Status = HallStatus.Approved, Name = "Test" });
        ratings.Items.Add(new Rating { HallId = hallId, UserId = "user-1", Value = 4 });
        var service = CreateService(
            authenticated: true,
            userId: "user-1",
            roles: [ApplicationRoles.RegisteredUser],
            halls,
            ratings);

        var summary = await service.GetHallRatingSummaryAsync(hallId);

        Assert.Equal(4, summary.UserRating);
        Assert.Equal(4, summary.AverageRating);
        Assert.Equal(1, summary.TotalRatings);
    }

    private static Guid SeedApprovedHall() => Guid.NewGuid();

    private static RatingService CreateService(
        bool authenticated,
        string userId = "user-1",
        IReadOnlyList<string>? roles = null,
        FakeHallRepository? halls = null,
        FakeRatingRepository? ratings = null)
    {
        halls ??= new FakeHallRepository();
        ratings ??= new FakeRatingRepository();
        var currentUser = new FakeCurrentUser(authenticated, userId, roles ?? []);
        return new RatingService(ratings, halls, currentUser);
    }

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(bool authenticated, string userId, IReadOnlyList<string> roles)
        {
            IsAuthenticated = authenticated;
            UserId = authenticated ? userId : null;
            Roles = roles;
        }

        public string? UserId { get; }
        public string? UserName => IsAuthenticated ? "user" : null;
        public string? Email => null;
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }

    private sealed class FakeHallRepository : IHallRepository
    {
        public List<Hall> Halls { get; } = [];

        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(Halls.FirstOrDefault(hall => hall.Id == id));

        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([]);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(
            HallRegion region,
            int count,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([]);

        public Task<IReadOnlyList<HallBookingPeriod>> GetBookingPeriodsAsync(
            IReadOnlyCollection<Guid> hallIds,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallBookingPeriod>>([]);

        public Task<IReadOnlyList<HallAvailability>> GetAvailabilityAsync(
            IReadOnlyCollection<Guid> hallIds,
            DateOnly fromDate,
            DateOnly toDate,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallAvailability>>([]);
    }

    private sealed class FakeRatingRepository : IRatingRepository
    {
        public List<Rating> Items { get; } = [];

        public Task<Rating?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default)
            => Task.FromResult(Items.FirstOrDefault(item => item.HallId == hallId && item.UserId == userId));

        public Task AddAsync(Rating rating, CancellationToken cancellationToken = default)
        {
            Items.Add(rating);
            return Task.CompletedTask;
        }

        public Task UpdateAsync(Rating rating, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<double> GetAverageRatingAsync(Guid hallId, CancellationToken cancellationToken = default)
        {
            var values = Items.Where(item => item.HallId == hallId).Select(item => item.Value).ToList();
            return Task.FromResult(values.Count == 0 ? 0 : values.Average());
        }

        public Task<int> GetTotalRatingsAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult(Items.Count(item => item.HallId == hallId));
    }
}
