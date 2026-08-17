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
    public async Task CreateRating_RegisteredUser_ReturnsRatingResponse()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 4 });

        Assert.Equal(4, result.Value);
        Assert.Equal(hall.Id, result.HallId);
        Assert.NotEqual(Guid.Empty, result.RatingId);
    }

    [Fact]
    public async Task CreateRating_StoresRatingInRepository()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        await service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 5 });

        Assert.Single(repository.Ratings);
        Assert.Equal(5, repository.Ratings[0].Value);
        Assert.Equal(hall.Id, repository.Ratings[0].HallId);
    }

    [Fact]
    public async Task CreateRating_Value1_IsAccepted()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 1 });

        Assert.Equal(1, result.Value);
    }

    [Fact]
    public async Task CreateRating_Value5_IsAccepted()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 5 });

        Assert.Equal(5, result.Value);
    }

    [Fact]
    public async Task CreateRating_Guest_ThrowsUnauthorized()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 3 }));
    }

    [Fact]
    public async Task CreateRating_HallOwner_ThrowsForbidden()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 3 }));
    }

    [Fact]
    public async Task CreateRating_DuplicateRating_ThrowsConflict()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        await service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 4 });

        await Assert.ThrowsAsync<ConflictException>(() =>
            service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 3 }));
    }

    [Fact]
    public async Task CreateRating_NonexistentHall_ThrowsNotFound()
    {
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository();
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.CreateRatingAsync(new CreateRatingRequest { HallId = Guid.NewGuid(), Value = 3 }));
    }

    [Fact]
    public async Task UpdateRating_OwnRating_ReturnsUpdatedResponse()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        await service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 3 });
        var result = await service.UpdateRatingAsync(new UpdateRatingRequest { HallId = hall.Id, Value = 5 });

        Assert.Equal(5, result.Value);
        Assert.Equal(hall.Id, result.HallId);
    }

    [Fact]
    public async Task UpdateRating_UpdatesExistingRecord()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        await service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 2 });
        await service.UpdateRatingAsync(new UpdateRatingRequest { HallId = hall.Id, Value = 4 });

        Assert.Single(repository.Ratings);
        Assert.Equal(4, repository.Ratings[0].Value);
    }

    [Fact]
    public async Task UpdateRating_Guest_ThrowsUnauthorized()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.UpdateRatingAsync(new UpdateRatingRequest { HallId = hall.Id, Value = 3 }));
    }

    [Fact]
    public async Task UpdateRating_HallOwner_ThrowsForbidden()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.UpdateRatingAsync(new UpdateRatingRequest { HallId = hall.Id, Value = 3 }));
    }

    [Fact]
    public async Task UpdateRating_NoExistingRating_ThrowsNotFound()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.UpdateRatingAsync(new UpdateRatingRequest { HallId = hall.Id, Value = 3 }));
    }

    [Fact]
    public async Task UpdateRating_NonexistentHall_ThrowsNotFound()
    {
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository();
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.UpdateRatingAsync(new UpdateRatingRequest { HallId = Guid.NewGuid(), Value = 3 }));
    }

    [Fact]
    public async Task CreateRating_AverageRatingCorrect_AfterMultipleRatings()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);

        var service1 = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);
        var service2 = CreateService(repository, hallRepository, authenticated: true, userId: "user-2", roles: [ApplicationRoles.RegisteredUser]);

        await service1.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 4 });
        var result = await service2.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 2 });

        Assert.Equal(3.0, result.AverageRating);
        Assert.Equal(2, result.TotalRatings);
    }

    [Fact]
    public async Task CreateRating_AverageRatingCorrect_AfterUpdate()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);

        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        await service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 2 });
        var result = await service.UpdateRatingAsync(new UpdateRatingRequest { HallId = hall.Id, Value = 4 });

        Assert.Equal(4.0, result.AverageRating);
        Assert.Equal(1, result.TotalRatings);
    }

    [Fact]
    public async Task CreateRating_FirstRating_ProducesCorrectAverage()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 3 });

        Assert.Equal(3.0, result.AverageRating);
        Assert.Equal(1, result.TotalRatings);
    }

    [Fact]
    public async Task GetHallRatingSummary_ReturnsCorrectSummary()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);

        var service1 = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);
        var service2 = CreateService(repository, hallRepository, authenticated: true, userId: "user-2", roles: [ApplicationRoles.RegisteredUser]);

        await service1.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 5 });
        await service2.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 3 });

        var summary = await service1.GetHallRatingSummaryAsync(hall.Id);

        Assert.Equal(4.0, summary.AverageRating);
        Assert.Equal(2, summary.TotalRatings);
        Assert.Equal(5, summary.UserRating);
    }

    [Fact]
    public async Task GetHallRatingSummary_GuestUser_NullUserRating()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);

        var authedService = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);
        await authedService.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 4 });

        var guestService = CreateService(repository, hallRepository, authenticated: false);
        var summary = await guestService.GetHallRatingSummaryAsync(hall.Id);

        Assert.Null(summary.UserRating);
        Assert.Equal(1, summary.TotalRatings);
    }

    [Fact]
    public async Task GetHallRatingSummary_NonexistentHall_ThrowsNotFound()
    {
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository();
        var service = CreateService(repository, hallRepository, authenticated: false);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.GetHallRatingSummaryAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task CreateRating_Admin_CanRate()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeRatingRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.Admin]);

        var result = await service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 5 });

        Assert.Equal(5, result.Value);
    }

    private static Hall CreateApprovedHall(string name)
        => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Status = HallStatus.Approved,
            OwnerId = "owner-1"
        };

    private static RatingService CreateService(
        FakeRatingRepository ratingRepository,
        FakeHallRepository hallRepository,
        bool authenticated,
        string? userId = null,
        IReadOnlyList<string>? roles = null)
    {
        var effectiveUserId = authenticated && userId is null ? "test-user-1" : userId;
        var currentUser = new FakeCurrentUserService(effectiveUserId, authenticated, roles ?? []);
        return new RatingService(ratingRepository, hallRepository, currentUser);
    }

    private sealed class FakeRatingRepository : IRatingRepository
    {
        public List<Rating> Ratings { get; } = [];

        public Task<Rating?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default)
            => Task.FromResult(Ratings.FirstOrDefault(r => r.HallId == hallId && r.UserId == userId));

        public Task AddAsync(Rating rating, CancellationToken cancellationToken = default)
        {
            Ratings.Add(rating);
            return Task.CompletedTask;
        }

        public Task UpdateAsync(Rating rating, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<double> GetAverageRatingAsync(Guid hallId, CancellationToken cancellationToken = default)
        {
            var hallRatings = Ratings.Where(r => r.HallId == hallId).ToList();
            return Task.FromResult(hallRatings.Count == 0 ? 0 : hallRatings.Average(r => r.Value));
        }

        public Task<int> GetTotalRatingsAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult(Ratings.Count(r => r.HallId == hallId));

        public Task<int> GetUserRatingCountAsync(string userId, CancellationToken cancellationToken = default)
            => Task.FromResult(Ratings.Count(r => r.UserId == userId));
    }

    private sealed class FakeHallRepository : IHallRepository
    {
        private readonly List<Hall> _halls;

        public FakeHallRepository(params Hall[] halls)
        {
            _halls = [.. halls];
        }

        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(_halls.FirstOrDefault(h => h.Id == id));

        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_halls.Take(count).ToList());

        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(HallRegion region, int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_halls.Where(h => h.Region == region).Take(count).ToList());

        public Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_halls.Skip(skip).Take(take).ToList());

        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(_halls.Count);

        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(string? name, HallRegion? region, string? area, DateOnly? date, BookingPeriodType? period, int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_halls.Skip(skip).Take(take).ToList());

        public Task<int> SearchApprovedHallsCountAsync(string? name, HallRegion? region, string? area, DateOnly? date, BookingPeriodType? period, CancellationToken cancellationToken = default)
            => Task.FromResult(_halls.Count);

        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallImage>>([]);

        public Task<IReadOnlyList<HallBookingPeriod>> GetBookingPeriodsAsync(IReadOnlyCollection<Guid> hallIds, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallBookingPeriod>>([]);

        public Task<IReadOnlyList<HallAvailability>> GetAvailabilityAsync(IReadOnlyCollection<Guid> hallIds, DateOnly fromDate, DateOnly toDate, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallAvailability>>([]);
    }

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        public FakeCurrentUserService(string? userId, bool authenticated, IReadOnlyList<string> roles)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
            Roles = roles;
        }

        public string? UserId { get; }
        public string? UserName => null;
        public string? Email => null;
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }
}
