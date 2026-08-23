using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public class AISessionPassiveInvitationValidationShould : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly AISessionRepository _repository;

    public AISessionPassiveInvitationValidationShould()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new ApplicationDbContext(options);
        _repository = new AISessionRepository(_context);
    }

    [Fact]
    public async Task GuestSession_WorksWithoutUserRecord()
    {
        var guest = new AISession { GuestIdentifier = "guest-xyz", IsGuestSession = true, UserId = null };
        _context.AISessions.Add(guest);
        await _context.SaveChangesAsync();

        var result = await _repository.GetActiveGuestSessionAsync("guest-xyz");
        Assert.NotNull(result);
        Assert.True(result!.IsGuestSession);
        Assert.Null(result.UserId);
    }

    [Fact]
    public async Task AuthenticatedSession_CorrectlyAssociatesWithUser()
    {
        var auth = new AISession { UserId = "user-123", IsGuestSession = false, GuestIdentifier = null };
        _context.AISessions.Add(auth);
        await _context.SaveChangesAsync();

        var result = await _repository.GetActiveSessionByUserIdAsync("user-123");
        Assert.NotNull(result);
        Assert.Equal("user-123", result!.UserId);
        Assert.False(result.IsGuestSession);
    }

    [Fact]
    public async Task CrossUserSession_AccessPrevented_GuestIdentifierIsolation()
    {
        var guestA = new AISession { GuestIdentifier = "guest-A", IsGuestSession = true };
        var guestB = new AISession { GuestIdentifier = "guest-B", IsGuestSession = true };
        _context.AISessions.AddRange(guestA, guestB);
        await _context.SaveChangesAsync();

        var result = await _repository.GetActiveGuestSessionAsync("guest-A");
        Assert.NotNull(result);
        Assert.Equal("guest-A", result!.GuestIdentifier);
        Assert.NotEqual("guest-B", result.GuestIdentifier);
    }

    [Fact]
    public async Task CrossUserSession_AccessPrevented_UserIdIsolation()
    {
        var user1 = new AISession { UserId = "user-1", IsGuestSession = false };
        var user2 = new AISession { UserId = "user-2", IsGuestSession = false };
        _context.AISessions.AddRange(user1, user2);
        await _context.SaveChangesAsync();

        var result = await _repository.GetActiveSessionByUserIdAsync("user-1");
        Assert.NotNull(result);
        Assert.Equal("user-1", result!.UserId);
    }

    [Fact]
    public async Task InvalidSessionId_DoesNotThrow_ReturnsNullSafely()
    {
        var result = await _repository.GetBySessionIdAsync("invalid-guid-not-exist");
        Assert.Null(result);
    }

    [Fact]
    public async Task ExpiredSession_HandledSafely_DoesNotThrow()
    {
        var expired = new AISession { LastAccessedAt = DateTime.UtcNow.AddHours(-25), IsGuestSession = false };
        _context.AISessions.Add(expired);
        await _context.SaveChangesAsync();

        var ex = await Record.ExceptionAsync(() => _repository.GetExpiredSessionsAsync());
        Assert.Null(ex);

        var expiredList = await _repository.GetExpiredSessionsAsync();
        Assert.Contains(expiredList, s => s.Id == expired.Id);
    }

    [Fact]
    public async Task MultipleTabs_SameGuestIdentifier_DoNotCorrupt()
    {
        var tasks = Enumerable.Range(0, 5).Select(i => {
            var s = new AISession { GuestIdentifier = $"guest-multi", IsGuestSession = true, SessionId = $"sid-{i}" };
            return s;
        }).ToList();

        // Only first should be considered active per repository logic (FirstOrDefault), but adding multiple with same identifier
        // should not corrupt DB; retrieval should still return one consistently
        _context.AISessions.AddRange(tasks);
        await _context.SaveChangesAsync();

        var result1 = await _repository.GetActiveGuestSessionAsync("guest-multi");
        var result2 = await _repository.GetActiveGuestSessionAsync("guest-multi");

        Assert.NotNull(result1);
        Assert.NotNull(result2);
        Assert.Equal(result1!.GuestIdentifier, result2!.GuestIdentifier);
    }

    [Fact]
    public async Task SessionRetrieval_PerformsCorrectly_ForBothGuestAndAuth()
    {
        var guest = new AISession { SessionId = "guest-sid", IsGuestSession = true, GuestIdentifier = "g1" };
        var auth = new AISession { SessionId = "auth-sid", IsGuestSession = false, UserId = "u1" };
        _context.AISessions.AddRange(guest, auth);
        await _context.SaveChangesAsync();

        var guestResult = await _repository.GetBySessionIdAsync("guest-sid");
        var authResult = await _repository.GetBySessionIdAsync("auth-sid");

        Assert.NotNull(guestResult);
        Assert.NotNull(authResult);
        Assert.True(guestResult!.IsGuestSession);
        Assert.False(authResult!.IsGuestSession);
    }

    public void Dispose() => _context.Dispose();
}
