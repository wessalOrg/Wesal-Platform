using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Admin;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Search;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class AdminHallServiceShould : IDisposable
{
    private static readonly DateTimeOffset FixedNow = new(2026, 8, 15, 10, 0, 0, TimeSpan.Zero);

    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly AdminHallService _service;
    private readonly HallSearchIndexer _indexer;

    public AdminHallServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddLogging();
        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
        _indexer = new HallSearchIndexer(NullLogger<HallSearchIndexer>.Instance);
        _service = CreateService(_indexer);
    }

    private AdminHallService CreateService(IHallSearchIndexer indexer)
        => new(
            new TestHallRepository(_context),
            new TestUnitOfWork(_context),
            indexer,
            new ConversationRepository(_context),
            new MessageRepository(_context),
            new FakeConversationNotifier(),
            new FakeCurrentUser("admin-1", true, "Admin"),
            new FakeDateTime(),
            NullLogger<AdminHallService>.Instance);

    private sealed class FakeConversationNotifier : IConversationNotifier
    {
        public Task NotifyMessageSentAsync(MessageSentEvent message, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private class TestHallRepository : Wesal.Application.Common.Interfaces.Persistence.IHallRepository
    {
        private readonly ApplicationDbContext _ctx;
        public TestHallRepository(ApplicationDbContext ctx) => _ctx = ctx;
        public Task AddAsync(Hall hall, CancellationToken cancellationToken = default) => _ctx.Halls.AddAsync(hall, cancellationToken).AsTask();
        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default) => _ctx.Halls.AsNoTracking().FirstOrDefaultAsync(h => h.Id == id, cancellationToken);
        public Task<Hall?> GetHallByIdForUpdateAsync(Guid id, CancellationToken cancellationToken = default) => _ctx.Halls.FirstOrDefaultAsync(h => h.Id == id, cancellationToken);
        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Hall>>(_ctx.Halls.Where(h => h.Status == HallStatus.Approved).Take(count).ToList());
        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(HallRegion region, int count, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Hall>>(_ctx.Halls.Where(h => h.Region == region).Take(count).ToList());
        public Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(int skip, int take, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Hall>>(_ctx.Halls.Skip(skip).Take(take).ToList());
        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default) => Task.FromResult(_ctx.Halls.Count());
        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(string? name, HallRegion? region, string? area, DateOnly? date, BookingPeriodType? period, int skip, int take, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Hall>>(_ctx.Halls.Skip(skip).Take(take).ToList());
        public Task<int> SearchApprovedHallsCountAsync(string? name, HallRegion? region, string? area, DateOnly? date, BookingPeriodType? period, CancellationToken cancellationToken = default) => Task.FromResult(_ctx.Halls.Count());
        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<HallImage>>(_ctx.HallImages.Where(i => i.HallId == hallId).ToList());
        public Task<IReadOnlyList<HallBookingPeriod>> GetBookingPeriodsAsync(IReadOnlyCollection<Guid> hallIds, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<HallBookingPeriod>>(_ctx.HallBookingPeriods.Where(p => hallIds.Contains(p.HallId)).ToList());
        public Task<IReadOnlyList<HallAvailability>> GetAvailabilityAsync(IReadOnlyCollection<Guid> hallIds, DateOnly fromDate, DateOnly toDate, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<HallAvailability>>(_ctx.HallAvailabilities.Where(a => hallIds.Contains(a.HallId)).ToList());
    }

    private class TestUnitOfWork : Wesal.Application.Common.Interfaces.Persistence.IUnitOfWork
    {
        private readonly ApplicationDbContext _ctx;
        public TestUnitOfWork(ApplicationDbContext ctx) => _ctx = ctx;
        public Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> operation, CancellationToken cancellationToken = default) => operation();
        public Task ExecuteInTransactionAsync(Func<Task> operation, CancellationToken cancellationToken = default) => operation();
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => _ctx.SaveChangesAsync(cancellationToken);
    }

    private Hall CreateHall(HallStatus status = HallStatus.PendingReview)
    {
        var hall = new Hall { Name = "Test Hall", Region = HallRegion.Gaza, Address = "Gaza", Capacity = 100, OwnerId = "owner-1", Status = status };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        _context.Entry(hall).State = EntityState.Detached;
        return hall;
    }

    [Fact]
    public async Task Approve_Pending_Hall_BecomesApprovedAndEligible()
    {
        var hall = CreateHall(HallStatus.PendingReview);
        var result = await _service.ApproveHallAsync(hall.Id);
        Assert.Equal(HallStatus.Approved, result.Status);
        Assert.True(result.IsApproved);
        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(HallStatus.Approved, reloaded!.Status);
        Assert.True(await _indexer.IsIndexedAsync(hall.Id));
    }

    [Fact]
    public async Task Approve_Pending_Hall_TriggersIndexing()
    {
        var hall = CreateHall(HallStatus.PendingReview);
        await _service.ApproveHallAsync(hall.Id);
        Assert.True(await _indexer.IsIndexedAsync(hall.Id));
    }

    [Fact]
    public async Task Approve_AlreadyApproved_IsIdempotent()
    {
        var hall = CreateHall(HallStatus.Approved);
        await _indexer.IndexHallAsync(new Wesal.Application.Common.Models.HallSearchIndexDto { HallId = hall.Id, HallName = hall.Name, Region = hall.Region, Address = hall.Address, Capacity = hall.Capacity, Status = hall.Status });
        var result = await _service.ApproveHallAsync(hall.Id);
        Assert.Equal(HallStatus.Approved, result.Status);
        Assert.True(await _indexer.IsIndexedAsync(hall.Id));
    }

    [Fact]
    public async Task Approve_IndexingFailure_HallRemainsApproved()
    {
        var hall = CreateHall(HallStatus.PendingReview);
        var failingIndexer = new FailingIndexer();
        var failingService = CreateService(failingIndexer);
        var result = await failingService.ApproveHallAsync(hall.Id);
        Assert.Equal(HallStatus.Approved, result.Status);
        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(HallStatus.Approved, reloaded!.Status);
        Assert.False(await failingIndexer.IsIndexedAsync(hall.Id));
    }

    [Fact]
    public async Task RepeatedIndexing_IsIdempotent()
    {
        var hall = CreateHall(HallStatus.PendingReview);
        var dto = new Wesal.Application.Common.Models.HallSearchIndexDto { HallId = hall.Id, HallName = hall.Name, Region = hall.Region, Address = hall.Address, Capacity = hall.Capacity, Status = HallStatus.Approved };
        await _indexer.IndexHallAsync(dto);
        await _indexer.IndexHallAsync(dto);
        await _indexer.IndexHallAsync(dto);
        Assert.True(await _indexer.IsIndexedAsync(hall.Id));
    }

    [Fact]
    public async Task Approve_NotifiesOwner_OnlyOnce()
    {
        var hall = CreateHall(HallStatus.PendingReview);
        var first = await _service.ApproveHallAsync(hall.Id);
        Assert.Equal(HallStatus.Approved, first.Status);
        var messagesAfterFirst = _context.Messages
            .Join(_context.Conversations, m => m.ConversationId, c => c.Id, (m, c) => new { m, c })
            .Where(x => x.c.HallId == hall.Id && x.m.SenderUserId == "admin-1")
            .Select(x => x.m.Content)
            .ToList();
        Assert.Single(messagesAfterFirst);
        Assert.Contains("تم اعتماد قاعتك", messagesAfterFirst[0], StringComparison.Ordinal);

        var second = await _service.ApproveHallAsync(hall.Id);
        Assert.Equal(HallStatus.Approved, second.Status);
        var messagesAfterSecond = _context.Messages
            .Join(_context.Conversations, m => m.ConversationId, c => c.Id, (m, c) => new { m, c })
            .Where(x => x.c.HallId == hall.Id && x.m.SenderUserId == "admin-1")
            .Select(x => x.m.Content)
            .ToList();
        Assert.Single(messagesAfterSecond);
    }

    [Fact]
    public async Task Approve_VisibleInPublicSearchQueries_AfterApproval()
    {
        var hall = CreateHall(HallStatus.PendingReview);
        var paginatedBefore = await _context.Halls
            .Where(h => h.Status == HallStatus.Approved && !h.IsDeleted)
            .ToListAsync();
        Assert.DoesNotContain(paginatedBefore, h => h.Id == hall.Id);

        await _service.ApproveHallAsync(hall.Id);

        var paginatedAfter = await _context.Halls
            .Where(h => h.Status == HallStatus.Approved && !h.IsDeleted)
            .ToListAsync();
        Assert.Contains(paginatedAfter, h => h.Id == hall.Id);
    }

    private class FailingIndexer : IHallSearchIndexer
    {
        public Task IndexHallAsync(Wesal.Application.Common.Models.HallSearchIndexDto hall, CancellationToken cancellationToken = default) => throw new Exception("Search unavailable");
        public Task<bool> IsIndexedAsync(Guid hallId, CancellationToken cancellationToken = default) => Task.FromResult(false);
        public Task RetryPendingAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(string userId, bool authenticated, string role)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
            Roles = [role];
        }

        public string? UserId { get; }
        public string? UserName => UserId;
        public string? Email => null;
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }

    private sealed class FakeDateTime : IDateTime
    {
        public DateTimeOffset Now => FixedNow;
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }
}
