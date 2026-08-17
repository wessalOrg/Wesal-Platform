using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;

namespace Wesal.Tests.Infrastructure;

public class BookingRequestServiceShould
{
    [Fact]
    public async Task ValidateBookingRequestAsync_Guest_ThrowsUnauthorized()
    {
        var hall = CreateHall("Approved Hall", HallStatus.Approved);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository, new FakeCurrentUserService(null, authenticated: false));

        var exception = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.ValidateBookingRequestAsync(CreateRequest(hall.Id)));

        Assert.Contains("logged in", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ValidateBookingRequestAsync_UnknownHall_ThrowsNotFound()
    {
        var fakeRepository = new FakeHallRepository();
        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.ValidateBookingRequestAsync(CreateRequest(Guid.NewGuid())));
    }

    [Fact]
    public async Task ValidateBookingRequestAsync_PendingHall_ThrowsNotFound()
    {
        var hall = CreateHall("Pending Hall", HallStatus.PendingReview);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.ValidateBookingRequestAsync(CreateRequest(hall.Id)));
    }

    [Fact]
    public async Task ValidateBookingRequestAsync_RejectedHall_ThrowsNotFound()
    {
        var hall = CreateHall("Rejected Hall", HallStatus.Rejected);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.ValidateBookingRequestAsync(CreateRequest(hall.Id)));
    }

    [Fact]
    public async Task ValidateBookingRequestAsync_DeletedHall_ThrowsNotFound()
    {
        var hall = CreateHall("Deleted Hall", HallStatus.Approved);
        hall.IsDeleted = true;
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.ValidateBookingRequestAsync(CreateRequest(hall.Id)));
    }

    [Fact]
    public async Task ValidateBookingRequestAsync_AuthenticatedUser_ReturnsHallContext()
    {
        var hall = CreateHall("Approved Hall", HallStatus.Approved);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true));
        var request = CreateRequest(hall.Id);

        var result = await service.ValidateBookingRequestAsync(request);

        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal("Approved Hall", result.HallName);
        Assert.Equal(request.Date, result.Date);
        Assert.Equal(request.Periods, result.Periods);
    }

    [Fact]
    public async Task ValidateBookingRequestAsync_AuthenticatedUser_DoesNotStoreBooking()
    {
        var hall = CreateHall("Approved Hall", HallStatus.Approved);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true));

        await service.ValidateBookingRequestAsync(CreateRequest(hall.Id));

        Assert.Empty(fakeRepository.Bookings);
    }

    private static BookingRequestService CreateService(
        FakeHallRepository repository,
        FakeCurrentUserService currentUser)
        => new(repository, currentUser);

    private static BookingRequestDto CreateRequest(Guid hallId)
        => new()
        {
            HallId = hallId,
            Date = new DateOnly(2026, 9, 10),
            Periods = [BookingPeriodType.FirstPeriod]
        };

    private static Hall CreateHall(string name, HallStatus status)
        => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Status = status,
            OwnerId = "owner-1"
        };

    private sealed class FakeHallRepository : IHallRepository
    {
        public List<Hall> Halls { get; } = [];

        public List<object> Bookings { get; } = [];

        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(Halls.FirstOrDefault(hall => hall.Id == id));

        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(Halls.Take(count).ToList());

        public Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(
            int skip,
            int take,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(Halls.Skip(skip).Take(take).ToList());

        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(Halls.Count);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(
            HallRegion region,
            int count,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(
                Halls.Where(hall => hall.Region == region).Take(count).ToList());

        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallImage>>([]);

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

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        public FakeCurrentUserService(string? userId, bool authenticated)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
        }

        public string? UserId { get; }

        public string? UserName => null;

        public string? Email => null;

        public bool IsAuthenticated { get; }

        public IReadOnlyList<string> Roles => [];
    }
}
