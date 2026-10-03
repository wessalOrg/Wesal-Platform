using System.Collections.Concurrent;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.AiAssistant;

public sealed class ChatSessionService : IChatSessionService, IDisposable
{
    private static readonly TimeSpan SessionDuration = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan DefaultSweepInterval = TimeSpan.FromMinutes(5);
    private static readonly string DefaultLanguage = "ar";

    private readonly ConcurrentDictionary<Guid, AiSession> _sessions = new();
    private readonly Timer _sweepTimer;

    public ChatSessionService()
        : this(null)
    {
    }

    internal ChatSessionService(TimeSpan? sweepInterval)
    {
        _sweepTimer = new Timer(
            callback: _ => SweepExpiredSessions(),
            state: null,
            dueTime: sweepInterval ?? DefaultSweepInterval,
            period: sweepInterval ?? DefaultSweepInterval);
    }

    public Task<AiSessionResponse> InitializeSessionAsync(string? language, CancellationToken cancellationToken = default, string? userId = null)
    {
        var effectiveLanguage = string.IsNullOrWhiteSpace(language) ? DefaultLanguage : language;
        var now = DateTime.UtcNow;
        var sessionId = Guid.NewGuid();

        var session = new AiSession
        {
            SessionId = sessionId,
            UserId = userId,
            Language = effectiveLanguage,
            CreatedAt = now,
            LastActivityAt = now,
            ExpiresAt = now.Add(SessionDuration)
        };

        _sessions[sessionId] = session;

        return Task.FromResult(new AiSessionResponse(
            session.SessionId,
            session.Language,
            session.CreatedAt,
            session.ExpiresAt));
    }

    public Task<AiSessionResponse?> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken = default, string? userId = null)
    {
        if (!_sessions.TryGetValue(sessionId, out var session) || !OwnsSession(session, userId))
        {
            return Task.FromResult<AiSessionResponse?>(null);
        }

        if (DateTime.UtcNow > session.ExpiresAt)
        {
            _sessions.TryRemove(sessionId, out _);
            return Task.FromResult<AiSessionResponse?>(null);
        }

        session.LastActivityAt = DateTime.UtcNow;
        session.ExpiresAt = session.LastActivityAt.Add(SessionDuration);

        return Task.FromResult<AiSessionResponse?>(new AiSessionResponse(
            session.SessionId,
            session.Language,
            session.CreatedAt,
            session.ExpiresAt));
    }

    public Task<AiSessionResponse?> PeekSessionAsync(Guid sessionId, CancellationToken cancellationToken = default, string? userId = null)
    {
        if (!_sessions.TryGetValue(sessionId, out var session) || !OwnsSession(session, userId))
        {
            return Task.FromResult<AiSessionResponse?>(null);
        }

        if (DateTime.UtcNow > session.ExpiresAt)
        {
            _sessions.TryRemove(sessionId, out _);
            return Task.FromResult<AiSessionResponse?>(null);
        }

        // No mutation: do not update LastActivityAt/ExpiresAt
        return Task.FromResult<AiSessionResponse?>(new AiSessionResponse(
            session.SessionId,
            session.Language,
            session.CreatedAt,
            session.ExpiresAt));
    }

    internal void SweepExpiredSessions()
    {
        var now = DateTime.UtcNow;
        foreach (var kvp in _sessions)
        {
            if (now > kvp.Value.ExpiresAt)
            {
                _sessions.TryRemove(kvp.Key, out _);
            }
        }
    }

    public Task<AiConversationContext> GetConversationContextAsync(Guid sessionId, CancellationToken cancellationToken = default, string? userId = null)
    {
        if (!_sessions.TryGetValue(sessionId, out var session)
            || !OwnsSession(session, userId)
            || DateTime.UtcNow > session.ExpiresAt)
        {
            return Task.FromResult(new AiConversationContext([], null));
        }

        lock (session)
        {
            return Task.FromResult(new AiConversationContext(
                session.Turns.ToList(),
                session.LastIntent,
                session.LastHalls.ToList(),
                session.LastHall));
        }
    }

    public Task EndSessionsForUserAsync(string userId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId)) return Task.CompletedTask;
        foreach (var entry in _sessions)
        {
            if (string.Equals(entry.Value.UserId, userId, StringComparison.Ordinal))
            {
                _sessions.TryRemove(entry.Key, out _);
            }
        }
        return Task.CompletedTask;
    }

    private static bool OwnsSession(AiSession session, string? userId)
        => string.Equals(session.UserId, userId, StringComparison.Ordinal);

    public Task SaveTurnAsync(Guid sessionId, string userMessage, AiAssistantIntentDto? intent, CancellationToken cancellationToken = default)
        => SaveExchangeAsync(sessionId, userMessage, null, intent, null, null, cancellationToken);

    public Task SaveExchangeAsync(
        Guid sessionId,
        string userMessage,
        string? assistantMessage,
        AiAssistantIntentDto? intent,
        IReadOnlyList<AiHallRef>? shownHalls,
        AiHallRef? focusedHall,
        CancellationToken cancellationToken = default)
    {
        var message = (userMessage ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(message) || !_sessions.TryGetValue(sessionId, out var session))
        {
            return Task.CompletedTask;
        }

        lock (session)
        {
            session.Turns.Add(new AiConversationTurn("user", message));

            var reply = (assistantMessage ?? string.Empty).Trim();
            if (reply.Length > 0)
            {
                if (reply.Length > MaxAssistantTurnCharacters)
                {
                    reply = reply[..MaxAssistantTurnCharacters];
                }

                session.Turns.Add(new AiConversationTurn("assistant", reply));
            }

            TrimTurns(session.Turns);

            if (intent is not null)
            {
                session.LastIntent = intent;
            }

            if (shownHalls is { Count: > 0 })
            {
                session.LastHalls.Clear();
                session.LastHalls.AddRange(shownHalls.Take(MaxRememberedHalls));
            }

            if (focusedHall is not null)
            {
                session.LastHall = focusedHall;
            }
        }

        return Task.CompletedTask;
    }

    /// <summary>
    /// Keeps at most <see cref="MaxRecordedTurns"/> user turns (and the assistant
    /// replies interleaved with them). Always drops whole exchanges from the front so a
    /// reply is never left without the question it answered.
    /// </summary>
    private static void TrimTurns(List<AiConversationTurn> turns)
    {
        while (turns.Count(t => t.Role == "user") > MaxRecordedTurns)
        {
            var next = turns.FindIndex(1, t => t.Role == "user");
            turns.RemoveRange(0, next < 0 ? turns.Count : next);
        }
    }

    public void Dispose()
    {
        _sweepTimer.Dispose();
    }

    internal sealed class AiSession
    {
        public Guid SessionId { get; set; }
        public string? UserId { get; set; }
        public string Language { get; set; } = DefaultLanguage;
        public DateTime CreatedAt { get; set; }
        public DateTime LastActivityAt { get; set; }
        public DateTime ExpiresAt { get; set; }

        public List<AiConversationTurn> Turns { get; } = [];
        public AiAssistantIntentDto? LastIntent { get; set; }
        public List<AiHallRef> LastHalls { get; } = [];
        public AiHallRef? LastHall { get; set; }
    }

    private const int MaxRecordedTurns = 6;
    private const int MaxAssistantTurnCharacters = 600;
    private const int MaxRememberedHalls = 10;
}
