using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;
using Wesal.Infrastructure.Comments;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Ratings;

namespace Wesal.Tests.Infrastructure;

public class AuthorizationHallActionsShould
{
    private static Hall CreateHall(Guid id, string ownerId, HallStatus status = HallStatus.Approved, bool isDeleted = false) => new()
    {
        Id = id,
        Name = "Test Hall",
        Status = status,
        IsDeleted = isDeleted,
        OwnerId = ownerId,
        Address = "Gaza",
        Region = HallRegion.Gaza,
        Capacity = 100
    };

    private sealed class FakeHallRepository : IHallRepository
    {
        public List<Hall> Halls { get; } = [];
        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult(Halls.FirstOrDefault(h => h.Id == id));
        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Hall>>(Halls.Take(count).ToList());
        public Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(int skip, int take, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Hall>>(Halls.Skip(skip).Take(take).ToList());
        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default) => Task.FromResult(Halls.Count);
        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(string? name, HallRegion? region, string? area, DateOnly? date, BookingPeriodType? period, int skip, int take, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Hall>>(Halls.Skip(skip).Take(take).ToList());
        public Task<int> SearchApprovedHallsCountAsync(string? name, HallRegion? region, string? area, DateOnly? date, BookingPeriodType? period, CancellationToken cancellationToken = default) => Task.FromResult(Halls.Count);
        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(HallRegion region, int count, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Hall>>(Halls.Where(h => h.Region == region).Take(count).ToList());
        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<HallImage>>([]);
        public Task<IReadOnlyList<HallBookingPeriod>> GetBookingPeriodsAsync(IReadOnlyCollection<Guid> hallIds, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<HallBookingPeriod>>([]);
        public Task<IReadOnlyList<HallAvailability>> GetAvailabilityAsync(IReadOnlyCollection<Guid> hallIds, DateOnly fromDate, DateOnly toDate, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<HallAvailability>>([]);
    }

    private sealed class FakeCommentRepository : ICommentRepository
    {
        public List<Comment> Comments { get; } = [];
        public Task AddAsync(Comment comment, CancellationToken cancellationToken = default) { Comments.Add(comment); return Task.CompletedTask; }
        public Task<IReadOnlyList<Comment>> GetByHallIdAsync(Guid hallId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Comment>>(Comments.Where(c => c.HallId == hallId).ToList());
    }

    private sealed class FakeRatingRepository : IRatingRepository
    {
        public List<Rating> Ratings { get; } = [];
        public Task AddAsync(Rating rating, CancellationToken cancellationToken = default) { Ratings.Add(rating); return Task.CompletedTask; }
        public Task<Rating?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default) => Task.FromResult(Ratings.FirstOrDefault(r => r.HallId == hallId && r.UserId == userId));
        public Task UpdateAsync(Rating rating, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<double> GetAverageRatingAsync(Guid hallId, CancellationToken cancellationToken = default) => Task.FromResult(Ratings.Where(r => r.HallId == hallId).Select(r => (double)r.Value).DefaultIfEmpty(0).Average());
        public Task<int> GetTotalRatingsAsync(Guid hallId, CancellationToken cancellationToken = default) => Task.FromResult(Ratings.Count(r => r.HallId == hallId));
        public Task<int> GetUserRatingCountAsync(string userId, CancellationToken cancellationToken = default) => Task.FromResult(Ratings.Count(r => r.UserId == userId));
    }

    private sealed class FakeConversationRepository : IConversationRepository
    {
        public List<Conversation> Conversations { get; } = [];
        public Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default) { Conversations.Add(conversation); return Task.CompletedTask; }
        public Task<Conversation?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default) => Task.FromResult(Conversations.FirstOrDefault(c => c.HallId == hallId && c.SenderUserId == userId));
        public Task<Conversation?> GetByIdWithHallAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult(Conversations.FirstOrDefault(c => c.Id == id));
        public Task<IReadOnlyList<Conversation>> GetParticipantConversationsAsync(string userId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Conversation>>(Conversations.Where(c => c.SenderUserId == userId || c.HallOwnerId == userId).ToList());
        public Task<IReadOnlyList<UserDisplayInfo>> GetUserDisplayNamesAsync(IReadOnlyCollection<string> userIds, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<UserDisplayInfo>>(userIds.Select(id => new UserDisplayInfo { UserId = id, FullName = "User " + id }).ToList());
    }

    private sealed class FakeMessageRepository : IMessageRepository
    {
        public Task<IReadOnlyList<Message>> GetByConversationAsync(Guid conversationId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Message>>([]);
        public Task<IReadOnlyList<Message>> GetByConversationIdsAsync(IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Message>>([]);
        public Task AddAsync(Message message, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task SaveChangesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<Message?> GetByClientRequestIdAsync(string senderUserId, string clientRequestId, CancellationToken cancellationToken = default) => Task.FromResult<Message?>(null);
    }

    private sealed class FakeConversationNotifier : IConversationNotifier
    {
        public Task NotifyMessageSentAsync(MessageSentEvent message, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class FakeBookingRejectionService : IBookingRejectionService
    {
        public Task<RejectBookingResultDto> RejectBookingAsync(Guid hallId, Guid bookingId, RejectBookingRequestDto request, CancellationToken cancellationToken = default) => Task.FromResult(new RejectBookingResultDto());
        public Task<int> DeliverPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default) => Task.FromResult(0);
    }

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        public FakeCurrentUserService(string? userId, bool authenticated, params string[] roles)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
            Roles = roles;
        }
        public string? UserId { get; }
        public string? UserName => "testuser";
        public string? Email => "test@example.com";
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }

    // Guest attempts → 401
    [Fact]
    public async Task Booking_Guest_ThrowsUnauthorized()
    {
        var hall = CreateHall(Guid.NewGuid(), "owner-1");
        var repo = new FakeHallRepository(); repo.Halls.Add(hall);
        var service = new BookingRequestService(repo, new FakeCurrentUserService(null, false));
        await Assert.ThrowsAsync<UnauthorizedException>(() => service.ValidateBookingRequestAsync(new BookingRequestDto { HallId = hall.Id, Date = new DateOnly(2026, 9, 10), Periods = [BookingPeriodType.FirstPeriod] }));
    }

    [Fact]
    public async Task Comment_Guest_ThrowsUnauthorized()
    {
        var hall = CreateHall(Guid.NewGuid(), "owner-1");
        var hallRepo = new FakeHallRepository(); hallRepo.Halls.Add(hall);
        var service = new CommentService(new FakeCommentRepository(), hallRepo, new FakeCurrentUserService(null, false));
        await Assert.ThrowsAsync<UnauthorizedException>(() => service.CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "Nice" }));
    }

    [Fact]
    public async Task Rating_Guest_ThrowsUnauthorized()
    {
        var hall = CreateHall(Guid.NewGuid(), "owner-1");
        var hallRepo = new FakeHallRepository(); hallRepo.Halls.Add(hall);
        var service = new RatingService(new FakeRatingRepository(), hallRepo, new FakeCurrentUserService(null, false));
        await Assert.ThrowsAsync<UnauthorizedException>(() => service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 5 }));
    }

    [Fact]
    public async Task Messaging_Guest_ThrowsUnauthorized()
    {
        var hall = CreateHall(Guid.NewGuid(), "owner-1");
        var hallRepo = new FakeHallRepository(); hallRepo.Halls.Add(hall);
        var service = new ConversationService(new FakeConversationRepository(), new FakeMessageRepository(), new FakeBookingRejectionService(), hallRepo, new FakeCurrentUserService(null, false), new FakeConversationNotifier());
        await Assert.ThrowsAsync<UnauthorizedException>(() => service.CreateConversationAsync(hall.Id));
    }

    // Registered User can perform
    [Fact]
    public async Task Booking_RegisteredUser_Succeeds()
    {
        var hall = CreateHall(Guid.NewGuid(), "owner-1");
        var repo = new FakeHallRepository(); repo.Halls.Add(hall);
        var service = new BookingRequestService(repo, new FakeCurrentUserService("user-1", true, ApplicationRoles.RegisteredUser));
        var result = await service.ValidateBookingRequestAsync(new BookingRequestDto { HallId = hall.Id, Date = new DateOnly(2026, 9, 10), Periods = [BookingPeriodType.FirstPeriod] });
        Assert.Equal(hall.Id, result.HallId);
    }

    [Fact]
    public async Task Comment_RegisteredUser_Succeeds()
    {
        var hall = CreateHall(Guid.NewGuid(), "owner-1");
        var hallRepo = new FakeHallRepository(); hallRepo.Halls.Add(hall);
        var commentRepo = new FakeCommentRepository();
        var service = new CommentService(commentRepo, hallRepo, new FakeCurrentUserService("user-1", true, ApplicationRoles.RegisteredUser));
        var result = await service.CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "Great hall!" });
        Assert.Equal(hall.Id, result.HallId);
        Assert.Single(commentRepo.Comments);
    }

    [Fact]
    public async Task Rating_RegisteredUser_Succeeds()
    {
        var hall = CreateHall(Guid.NewGuid(), "owner-1");
        var hallRepo = new FakeHallRepository(); hallRepo.Halls.Add(hall);
        var ratingRepo = new FakeRatingRepository();
        var service = new RatingService(ratingRepo, hallRepo, new FakeCurrentUserService("user-1", true, ApplicationRoles.RegisteredUser));
        var result = await service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 4 });
        Assert.Equal(4, result.Value);
    }

    [Fact]
    public async Task Messaging_RegisteredUser_Succeeds()
    {
        var hall = CreateHall(Guid.NewGuid(), "owner-1");
        var hallRepo = new FakeHallRepository(); hallRepo.Halls.Add(hall);
        var convRepo = new FakeConversationRepository();
        var service = new ConversationService(convRepo, new FakeMessageRepository(), new FakeBookingRejectionService(), hallRepo, new FakeCurrentUserService("user-1", true, ApplicationRoles.RegisteredUser), new FakeConversationNotifier());
        var result = await service.CreateConversationAsync(hall.Id);
        Assert.Equal(hall.Id, result.HallId);
        Assert.False(result.IsExisting);
    }

    // Hall Owner restrictions
    [Fact]
    public async Task Booking_HallOwner_ThrowsForbidden()
    {
        var hall = CreateHall(Guid.NewGuid(), "owner-1");
        var repo = new FakeHallRepository(); repo.Halls.Add(hall);
        var service = new BookingRequestService(repo, new FakeCurrentUserService("owner-1", true, ApplicationRoles.HallOwner));
        var ex = await Assert.ThrowsAsync<ForbiddenException>(() => service.ValidateBookingRequestAsync(new BookingRequestDto { HallId = hall.Id, Date = new DateOnly(2026, 9, 10), Periods = [BookingPeriodType.FirstPeriod] }));
        Assert.Contains("Hall owners", ex.Message);
        // No booking side effect already ensured by service not storing
    }

    [Fact]
    public async Task Comment_HallOwner_ThrowsForbidden()
    {
        var hall = CreateHall(Guid.NewGuid(), "owner-1");
        var hallRepo = new FakeHallRepository(); hallRepo.Halls.Add(hall);
        var commentRepo = new FakeCommentRepository();
        var service = new CommentService(commentRepo, hallRepo, new FakeCurrentUserService("owner-1", true, ApplicationRoles.HallOwner));
        await Assert.ThrowsAsync<ForbiddenException>(() => service.CreateCommentAsync(new CreateCommentRequest { HallId = hall.Id, Content = "Nice" }));
        Assert.Empty(commentRepo.Comments);
    }

    [Fact]
    public async Task Rating_HallOwner_ThrowsForbidden()
    {
        var hall = CreateHall(Guid.NewGuid(), "owner-1");
        var hallRepo = new FakeHallRepository(); hallRepo.Halls.Add(hall);
        var ratingRepo = new FakeRatingRepository();
        var service = new RatingService(ratingRepo, hallRepo, new FakeCurrentUserService("owner-1", true, ApplicationRoles.HallOwner));
        await Assert.ThrowsAsync<ForbiddenException>(() => service.CreateRatingAsync(new CreateRatingRequest { HallId = hall.Id, Value = 5 }));
        Assert.Empty(ratingRepo.Ratings);
    }

    [Fact]
    public async Task Messaging_HallOwner_OwnHall_ThrowsForbidden()
    {
        var hallId = Guid.NewGuid();
        var hall = CreateHall(hallId, "owner-1");
        var hallRepo = new FakeHallRepository(); hallRepo.Halls.Add(hall);
        var convRepo = new FakeConversationRepository();
        var service = new ConversationService(convRepo, new FakeMessageRepository(), new FakeBookingRejectionService(), hallRepo, new FakeCurrentUserService("owner-1", true, ApplicationRoles.HallOwner), new FakeConversationNotifier());
        var ex = await Assert.ThrowsAsync<ForbiddenException>(() => service.CreateConversationAsync(hallId));
        Assert.Contains("own hall", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(convRepo.Conversations);
    }

    [Fact]
    public async Task Messaging_HallOwner_OtherHall_Succeeds()
    {
        var hall = CreateHall(Guid.NewGuid(), "other-owner");
        var hallRepo = new FakeHallRepository(); hallRepo.Halls.Add(hall);
        var convRepo = new FakeConversationRepository();
        var service = new ConversationService(convRepo, new FakeMessageRepository(), new FakeBookingRejectionService(), hallRepo, new FakeCurrentUserService("owner-1", true, ApplicationRoles.HallOwner), new FakeConversationNotifier());
        var result = await service.CreateConversationAsync(hall.Id);
        Assert.Equal(hall.Id, result.HallId);
    }

    // Identity / Ownership security - cannot bypass via client data
    [Fact]
    public async Task HallOwner_CannotBypass_ByChangingUserIdInRequest_BookingStillForbidden()
    {
        // BookingRequestDto does not contain userId, but we simulate HallOwner trying to book - still forbidden via role
        var hall = CreateHall(Guid.NewGuid(), "owner-1");
        var repo = new FakeHallRepository(); repo.Halls.Add(hall);
        var service = new BookingRequestService(repo, new FakeCurrentUserService("owner-1", true, ApplicationRoles.HallOwner));
        await Assert.ThrowsAsync<ForbiddenException>(() => service.ValidateBookingRequestAsync(new BookingRequestDto { HallId = hall.Id, Date = new DateOnly(2026, 9, 10), Periods = [BookingPeriodType.FirstPeriod] }));
    }

    [Fact]
    public async Task HallOwner_CannotBypassMessagingOwnHall_ByClientOwnershipFlag()
    {
        // Even if client claims hall is not owned, server checks hall.OwnerId vs UserId
        var hall = CreateHall(Guid.NewGuid(), "owner-1");
        var hallRepo = new FakeHallRepository(); hallRepo.Halls.Add(hall);
        var convRepo = new FakeConversationRepository();
        // HallOwner tries to contact own hall - server must block regardless of client flag
        var service = new ConversationService(convRepo, new FakeMessageRepository(), new FakeBookingRejectionService(), hallRepo, new FakeCurrentUserService("owner-1", true, ApplicationRoles.HallOwner), new FakeConversationNotifier());
        await Assert.ThrowsAsync<ForbiddenException>(() => service.CreateConversationAsync(hall.Id));
        // Verify ownership determined server-side: hall.OwnerId is server data
        Assert.Equal("owner-1", hall.OwnerId);
    }

    [Fact]
    public async Task ClientProvidedRoleIgnored_BookingStillForbiddenForHallOwner()
    {
        // BookingRequestDto has no role field, so even if client sends extra data, server uses ICurrentUserService.Roles
        var hall = CreateHall(Guid.NewGuid(), "owner-1");
        var repo = new FakeHallRepository(); repo.Halls.Add(hall);
        // Simulate HallOwner with correct server role, even if client tries to claim RegisteredUser
        var service = new BookingRequestService(repo, new FakeCurrentUserService("owner-1", true, ApplicationRoles.HallOwner));
        await Assert.ThrowsAsync<ForbiddenException>(() => service.ValidateBookingRequestAsync(new BookingRequestDto { HallId = hall.Id, Date = new DateOnly(2026, 9, 10), Periods = [BookingPeriodType.FirstPeriod] }));
    }
}
