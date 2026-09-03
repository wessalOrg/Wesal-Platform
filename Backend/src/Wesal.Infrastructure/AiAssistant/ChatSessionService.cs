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

    public Task<AiSessionResponse> InitializeSessionAsync(string? language, CancellationToken cancellationToken = default)
    {
        var effectiveLanguage = string.IsNullOrWhiteSpace(language) ? DefaultLanguage : language;
        var now = DateTime.UtcNow;
        var sessionId = Guid.NewGuid();

        var session = new AiSession
        {
            SessionId = sessionId,
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

    public Task<AiSessionResponse?> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken = default)
    {
        if (!_sessions.TryGetValue(sessionId, out var session))
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

    public Task<AiSessionResponse?> PeekSessionAsync(Guid sessionId, CancellationToken cancellationToken = default)
    {
        if (!_sessions.TryGetValue(sessionId, out var session))
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

    public Task<AiConversationContext> GetConversationContextAsync(Guid sessionId, CancellationToken cancellationToken = default)
    {
        if (!_sessions.TryGetValue(sessionId, out var session)
            || DateTime.UtcNow > session.ExpiresAt)
        {
            return Task.FromResult(new AiConversationContext([], null));
        }

        var turns = session.RecordedMessages
            .Select(m => new AiConversationTurn("user", m))
            .ToList();

        return Task.FromResult(new AiConversationContext(turns, session.LastIntent));
    }

    public Task SaveTurnAsync(Guid sessionId, string userMessage, AiAssistantIntentDto? intent, CancellationToken cancellationToken = default)
    {
        var message = (userMessage ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(message) || !_sessions.TryGetValue(sessionId, out var session))
        {
            return Task.CompletedTask;
        }

        lock (session)
        {
            session.RecordedMessages.Add(message);
            if (session.RecordedMessages.Count > MaxRecordedTurns)
            {
                session.RecordedMessages.RemoveRange(0, session.RecordedMessages.Count - MaxRecordedTurns);
            }

            if (intent is not null)
            {
                session.LastIntent = intent;
            }
        }

        return Task.CompletedTask;
    }

    public void Dispose()
    {
        _sweepTimer.Dispose();
    }

    internal sealed class AiSession
    {
        public Guid SessionId { get; set; }
        public string Language { get; set; } = DefaultLanguage;
        public DateTime CreatedAt { get; set; }
        public DateTime LastActivityAt { get; set; }
        public DateTime ExpiresAt { get; set; }

        public List<string> RecordedMessages { get; } = [];
        public AiAssistantIntentDto? LastIntent { get; set; }
    }

    private const int MaxRecordedTurns = 6;
}
