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
    public async Task CreateCommentAsync_Guest_ThrowsUnauthorized()
    {
        var service = CreateService(authenticated: false);
        var hallId = Guid.NewGuid();

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.CreateCommentAsync(new CreateCommentRequest { HallId = hallId, Body = "قاعة ممتازة" }));
    }

    [Fact]
    public async Task CreateCommentAsync_HallOwner_ThrowsForbidden()
    {
        var halls = new FakeHallRepository();
        var hallId = Guid.NewGuid();
        halls.Halls.Add(new Hall { Id = hallId, Status = HallStatus.Approved, Name = "Test" });
        var service = CreateService(
            authenticated: true,
            roles: [ApplicationRoles.HallOwner],
            halls: halls);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateCommentAsync(new CreateCommentRequest { HallId = hallId, Body = "قاعة ممتازة" }));
    }

    [Fact]
    public async Task CreateCommentAsync_RegisteredUser_StoresComment()
    {
        var halls = new FakeHallRepository();
        var comments = new FakeCommentRepository();
        var hallId = Guid.NewGuid();
        halls.Halls.Add(new Hall { Id = hallId, Status = HallStatus.Approved, Name = "Test" });
        var service = CreateService(
            authenticated: true,
            userId: "user-1",
            userName: "ليان",
            roles: [ApplicationRoles.RegisteredUser],
            halls,
            comments);

        var result = await service.CreateCommentAsync(new CreateCommentRequest
        {
            HallId = hallId,
            Body = "  المكان مرتب والخدمة ممتازة  "
        });

        Assert.Equal(hallId, result.HallId);
        Assert.Equal("المكان مرتب والخدمة ممتازة", result.Body);
        Assert.Equal("ليان", result.Author);
        Assert.Single(comments.Items);
    }

    [Fact]
    public async Task GetHallCommentsAsync_ReturnsNewestFirst()
    {
        var halls = new FakeHallRepository();
        var comments = new FakeCommentRepository();
        var hallId = Guid.NewGuid();
        halls.Halls.Add(new Hall { Id = hallId, Status = HallStatus.Approved, Name = "Test" });
        comments.Items.Add(new Comment
        {
            HallId = hallId,
            UserId = "user-1",
            Body = "قديم",
            CreatedAt = DateTimeOffset.UtcNow.AddHours(-2)
        });
        comments.Items.Add(new Comment
        {
            HallId = hallId,
            UserId = "user-2",
            Body = "جديد",
            CreatedAt = DateTimeOffset.UtcNow
        });
        var service = CreateService(
            authenticated: false,
            halls: halls,
            comments: comments);

        var list = await service.GetHallCommentsAsync(hallId);

        Assert.Equal(2, list.Count);
        Assert.Equal("جديد", list[0].Body);
        Assert.Equal("قديم", list[1].Body);
    }

    private static CommentService CreateService(
        bool authenticated,
        string userId = "user-1",
        string? userName = "user",
        IReadOnlyList<string>? roles = null,
        FakeHallRepository? halls = null,
        FakeCommentRepository? comments = null)
    {
        halls ??= new FakeHallRepository();
        comments ??= new FakeCommentRepository();
        var currentUser = new FakeCurrentUser(authenticated, userId, userName, roles ?? []);
        return new CommentService(comments, halls, currentUser);
    }

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(bool authenticated, string userId, string? userName, IReadOnlyList<string> roles)
        {
            IsAuthenticated = authenticated;
            UserId = authenticated ? userId : null;
            UserName = authenticated ? userName : null;
            Roles = roles;
        }

        public string? UserId { get; }
        public string? UserName { get; }
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

    private sealed class FakeCommentRepository : ICommentRepository
    {
        public List<Comment> Items { get; } = [];

        public Task AddAsync(Comment comment, CancellationToken cancellationToken = default)
        {
            Items.Add(comment);
            return Task.CompletedTask;
        }

        public Task<IReadOnlyList<CommentResponse>> ListByHallAsync(
            Guid hallId,
            CancellationToken cancellationToken = default)
        {
            var list = Items
                .Where(item => item.HallId == hallId)
                .OrderByDescending(item => item.CreatedAt)
                .Select(item => new CommentResponse
                {
                    CommentId = item.Id,
                    HallId = item.HallId,
                    Author = "مستخدم",
                    Body = item.Body,
                    CreatedAt = item.CreatedAt
                })
                .ToList();

            return Task.FromResult<IReadOnlyList<CommentResponse>>(list);
        }
    }
}
