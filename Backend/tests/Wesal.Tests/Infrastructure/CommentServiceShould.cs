using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Comments;

namespace Wesal.Tests.Infrastructure;

public class CommentServiceShould
{
    [Fact]
    public async Task CreateComment_RegisteredUser_ReturnsCommentResponse()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeCommentRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "Great hall!" });

        Assert.Equal("Great hall!", result.Content);
        Assert.Equal(hall.Id, result.HallId);
        Assert.NotEqual(Guid.Empty, result.CommentId);
    }

    [Fact]
    public async Task CreateComment_StoresCommentInRepository()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeCommentRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        await service.CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "Nice venue" });

        Assert.Single(repository.Comments);
        Assert.Equal("Nice venue", repository.Comments[0].Content);
        Assert.Equal(hall.Id, repository.Comments[0].HallId);
    }

    [Fact]
    public async Task CreateComment_Guest_ThrowsUnauthorized()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeCommentRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "Hello" }));
    }

    [Fact]
    public async Task CreateComment_HallOwner_ThrowsForbidden()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeCommentRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "My hall" }));
    }

    [Fact]
    public async Task CreateComment_EmptyContent_ThrowsValidation()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeCommentRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "" }));
    }

    [Fact]
    public async Task CreateComment_WhitespaceContent_ThrowsValidation()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeCommentRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "   " }));
    }

    [Fact]
    public async Task CreateComment_ExcessivelyLongContent_ThrowsValidation()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeCommentRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        var longContent = new string('a', 1001);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = longContent }));
    }

    [Fact]
    public async Task CreateComment_SanitizesHtmlInput()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeCommentRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateCommentAsync(
            new CreateCommentRequest { HallId = hall.Id, Content = "<script>alert('xss')</script>" });

        Assert.DoesNotContain("<script>", result.Content);
        Assert.Contains("&lt;script&gt;", result.Content);
    }

    [Fact]
    public async Task CreateComment_NonexistentHall_ThrowsNotFound()
    {
        var repository = new FakeCommentRepository();
        var hallRepository = new FakeHallRepository();
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.CreateCommentAsync(new CreateCommentRequest { HallId = Guid.NewGuid(), Content = "Hello" }));
    }

    [Fact]
    public async Task CreateComment_LinkedToCorrectUser()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeCommentRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-42", roles: [ApplicationRoles.RegisteredUser]);

        await service.CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "Test" });

        Assert.Equal("user-42", repository.Comments[0].UserId);
    }

    [Fact]
    public async Task CreateComment_LinkedToCorrectHall()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeCommentRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.RegisteredUser]);

        await service.CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "Test" });

        Assert.Equal(hall.Id, repository.Comments[0].HallId);
    }

    [Fact]
    public async Task GetHallComments_ReturnsComments()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeCommentRepository();
        repository.Comments.Add(new Comment { HallId = hall.Id, UserId = "user-1", Content = "First" });
        repository.Comments.Add(new Comment { HallId = hall.Id, UserId = "user-2", Content = "Second" });
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: false);

        var result = await service.GetHallCommentsAsync(hall.Id);

        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task GetHallComments_DoesNotReturnOtherHallComments()
    {
        var hall1 = CreateApprovedHall("Hall 1");
        var hall2 = CreateApprovedHall("Hall 2");
        var repository = new FakeCommentRepository();
        repository.Comments.Add(new Comment { HallId = hall1.Id, UserId = "user-1", Content = "For hall 1" });
        repository.Comments.Add(new Comment { HallId = hall2.Id, UserId = "user-2", Content = "For hall 2" });
        var hallRepository = new FakeHallRepository(hall1, hall2);
        var service = CreateService(repository, hallRepository, authenticated: false);

        var result = await service.GetHallCommentsAsync(hall1.Id);

        Assert.Single(result);
        Assert.Equal("For hall 1", result[0].Content);
    }

    [Fact]
    public async Task GetHallComments_NonexistentHall_ThrowsNotFound()
    {
        var repository = new FakeCommentRepository();
        var hallRepository = new FakeHallRepository();
        var service = CreateService(repository, hallRepository, authenticated: false);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.GetHallCommentsAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetHallComments_PubliclyAccessible()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeCommentRepository();
        repository.Comments.Add(new Comment { HallId = hall.Id, UserId = "user-1", Content = "Public comment" });
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: false);

        var result = await service.GetHallCommentsAsync(hall.Id);

        Assert.Single(result);
        Assert.Equal("Public comment", result[0].Content);
    }

    [Fact]
    public async Task CreateComment_DoesNotExposeSensitiveUserData()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeCommentRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "Test" });

        Assert.NotNull(result.UserName);
        Assert.DoesNotContain("password", result.UserName, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("user-1", result.UserName);
    }

    [Fact]
    public async Task CreateComment_Admin_CanComment()
    {
        var hall = CreateApprovedHall("Test Hall");
        var repository = new FakeCommentRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, roles: [ApplicationRoles.Admin]);

        var result = await service.CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "Admin note" });

        Assert.Equal("Admin note", result.Content);
    }

    private static Hall CreateApprovedHall(string name)
        => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Status = HallStatus.Approved,
            OwnerId = "owner-1"
        };

    private static CommentService CreateService(
        FakeCommentRepository commentRepository,
        FakeHallRepository hallRepository,
        bool authenticated,
        string? userId = null,
        IReadOnlyList<string>? roles = null,
        string? userName = null)
    {
        var effectiveUserId = authenticated && userId is null ? "test-user-1" : userId;
        var currentUser = new FakeCurrentUserService(effectiveUserId, authenticated, roles ?? [], userName);
        return new CommentService(commentRepository, hallRepository, currentUser);
    }

    private sealed class FakeCommentRepository : ICommentRepository
    {
        public List<Comment> Comments { get; } = [];

        public Task AddAsync(Comment comment, CancellationToken cancellationToken = default)
        {
            Comments.Add(comment);
            return Task.CompletedTask;
        }

        public Task<IReadOnlyList<Comment>> GetByHallIdAsync(Guid hallId, CancellationToken cancellationToken = default)
        {
            var filtered = Comments
                .Where(c => c.HallId == hallId)
                .OrderByDescending(c => c.CreatedAt)
                .ToList();
            return Task.FromResult<IReadOnlyList<Comment>>(filtered);
        }
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
        public FakeCurrentUserService(string? userId, bool authenticated, IReadOnlyList<string> roles, string? userName = null)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
            Roles = roles;
            UserName = userName ?? (authenticated ? "TestUser" : null);
        }

        public string? UserId { get; }
        public string? UserName { get; }
        public string? Email => null;
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }
}
