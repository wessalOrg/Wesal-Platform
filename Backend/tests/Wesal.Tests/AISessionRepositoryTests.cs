using System;
using System.Threading;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Persistence.Tests;

public class AISessionRepositoryTests : IDisposable
{
    private readonly ApplicationDbContext _context;
    private readonly IAISessionRepository _repository;

    public AISessionRepositoryTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _context = new ApplicationDbContext(options);
        _repository = new AISessionRepository(_context);
    }

    [Fact]
    public async Task GetBySessionIdAsync_ShouldReturnSession_WhenSessionExists()
    {
        // Arrange
        var session = new AISession
        {
            SessionId = "test-session-123",
            IsGuestSession = false
        };
        _context.AISessions.Add(session);
        await _context.SaveChangesAsync();

        // Act
        var result = await _repository.GetBySessionIdAsync("test-session-123");

        // Assert
        Assert.NotNull(result);
        Assert.Equal("test-session-123", result.SessionId);
    }

    [Fact]
    public async Task GetBySessionIdAsync_ShouldReturnNull_WhenSessionNotFound()
    {
        // Act
        var result = await _repository.GetBySessionIdAsync("non-existent");

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetActiveSessionByUserIdAsync_ShouldReturnSession_WhenUserSessionExists()
    {
        // Arrange
        var session = new AISession
        {
            UserId = "user-123",
            IsGuestSession = false
        };
        _context.AISessions.Add(session);
        await _context.SaveChangesAsync();

        // Act
        var result = await _repository.GetActiveSessionByUserIdAsync("user-123");

        // Assert
        Assert.NotNull(result);
        Assert.False(result.IsGuestSession);
    }

    [Fact]
    public async Task GetActiveGuestSessionAsync_ShouldReturnSession_WhenGuestSessionExists()
    {
        // Arrange
        var session = new AISession
        {
            GuestIdentifier = "guest-456",
            IsGuestSession = true
        };
        _context.AISessions.Add(session);
        await _context.SaveChangesAsync();

        // Act
        var result = await _repository.GetActiveGuestSessionAsync("guest-456");

        // Assert
        Assert.NotNull(result);
        Assert.True(result.IsGuestSession);
    }

    [Fact]
    public async Task GetExpiredSessionsAsync_ShouldReturnExpiredSessions()
    {
        // Arrange
        var expiredSession = new AISession
        {
            CreatedAt = DateTime.UtcNow.AddHours(-48),
            LastAccessedAt = DateTime.UtcNow.AddHours(-25),
            IsGuestSession = false
        };
        var activeSession = new AISession
        {
            CreatedAt = DateTime.UtcNow,
            LastAccessedAt = DateTime.UtcNow,
            IsGuestSession = false
        };
        _context.AISessions.Add(expiredSession);
        _context.AISessions.Add(activeSession);
        await _context.SaveChangesAsync();

        // Act
        var result = await _repository.GetExpiredSessionsAsync();

        // Assert
        Assert.Single(result);
        Assert.True(result.First().IsExpired);
    }

    [Fact]
    public async Task AddAsync_ShouldAddSession_Correctly()
    {
        // Arrange
        var session = new AISession
        {
            SessionId = "new-session-789",
            IsGuestSession = true,
            GuestIdentifier = "guest-test"
        };

        // Act
        var result = await _repository.AddAsync(session);

        // Assert
        Assert.NotEmpty(result.Id.ToString());
        Assert.Equal("new-session-789", result.SessionId);
        Assert.True(result.IsGuestSession);
    }

    public void Dispose()
    {
        _context.Dispose();
    }
}