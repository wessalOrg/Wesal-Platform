using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.RegularExpressions;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Short-lived conversation memory. Production uses the durable optimistic-concurrency
/// store; the parameterless constructor is retained for isolated unit tests only.
/// </summary>
public sealed class ChatSessionService : IChatSessionService, IDisposable
{
    private static readonly TimeSpan SessionDuration = TimeSpan.FromMinutes(30);
    private static readonly string DefaultLanguage = "ar";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Regex JwtPattern = new(@"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex BearerPattern = new(@"\bBearer\s+[A-Za-z0-9._~+/-]+=*", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex SecretAssignmentPattern = new("""\b(password|passcode|token|api[_ -]?key)\b\s*(?:is|[:=])\s*["']?[^\s"'&,;]+""", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private readonly IAiConversationSessionStore _store;

    /// <summary>Test-only in-memory setup; runtime DI resolves the durable store constructor.</summary>
    public ChatSessionService() : this(new InMemoryAiConversationSessionStore())
    {
    }

    public ChatSessionService(IAiConversationSessionStore store) => _store = store;

    public void Dispose() { }

    public async Task<AiSessionResponse> InitializeSessionAsync(
        string? language,
        CancellationToken cancellationToken = default,
        string? userId = null)
    {
        var now = DateTimeOffset.UtcNow;
        await _store.DeleteExpiredAsync(now, cancellationToken);

        var session = new AiConversationSession
        {
            SessionId = Guid.NewGuid(),
            UserId = string.IsNullOrWhiteSpace(userId) ? null : userId,
            Language = string.IsNullOrWhiteSpace(language) ? DefaultLanguage : language.Trim()[..Math.Min(language.Trim().Length, 8)],
            CreatedAt = now,
            LastActivityAt = now,
            ExpiresAt = now.Add(SessionDuration),
            TurnsJson = "[]",
            LastHallsJson = "[]"
        };

        await _store.AddAsync(session, cancellationToken);
        return ToResponse(session);
    }

    public async Task<AiSessionResponse?> GetSessionAsync(
        Guid sessionId,
        CancellationToken cancellationToken = default,
        string? userId = null)
    {
        for (var attempt = 0; attempt < 4; attempt++)
        {
            var session = await _store.GetAsync(sessionId, cancellationToken);
            if (session is null || !OwnsSession(session, userId)) return null;

            var now = DateTimeOffset.UtcNow;
            if (session.ExpiresAt <= now)
            {
                await _store.DeleteExpiredAsync(now, cancellationToken);
                return null;
            }

            var expectedRevision = session.Revision;
            session.LastActivityAt = now;
            session.ExpiresAt = now.Add(SessionDuration);
            if (await _store.TryUpdateAsync(session, expectedRevision, cancellationToken))
            {
                session.Revision = expectedRevision + 1;
                return ToResponse(session);
            }
        }

        // A competing turn won repeatedly. Do not fail the request just because its
        // passive expiry refresh could not be written.
        var latest = await _store.GetAsync(sessionId, cancellationToken);
        return latest is not null && OwnsSession(latest, userId) && latest.ExpiresAt > DateTimeOffset.UtcNow
            ? ToResponse(latest)
            : null;
    }

    public async Task<AiSessionResponse?> PeekSessionAsync(
        Guid sessionId,
        CancellationToken cancellationToken = default,
        string? userId = null)
    {
        var session = await _store.GetAsync(sessionId, cancellationToken);
        if (session is null || !OwnsSession(session, userId))
            return null;

        var now = DateTimeOffset.UtcNow;
        if (session.ExpiresAt <= now)
        {
            await _store.DeleteExpiredAsync(now, cancellationToken);
            return null;
        }

        return ToResponse(session);
    }

    public async Task<AiConversationContext> GetConversationContextAsync(
        Guid sessionId,
        CancellationToken cancellationToken = default,
        string? userId = null)
    {
        var session = await _store.GetAsync(sessionId, cancellationToken);
        if (session is null || !OwnsSession(session, userId) || session.ExpiresAt <= DateTimeOffset.UtcNow)
            return new AiConversationContext([] , null);

        return new AiConversationContext(
            Deserialize<List<AiConversationTurn>>(session.TurnsJson) ?? [],
            Deserialize<AiAssistantIntentDto>(session.LastIntentJson),
            Deserialize<List<AiHallRef>>(session.LastHallsJson) ?? [],
            Deserialize<AiHallRef>(session.LastHallJson));
    }

    public Task EndSessionsForUserAsync(string userId, CancellationToken cancellationToken = default)
        => string.IsNullOrWhiteSpace(userId)
            ? Task.CompletedTask
            : _store.DeleteForUserAsync(userId, cancellationToken);

    public Task SaveTurnAsync(
        Guid sessionId,
        string userMessage,
        AiAssistantIntentDto? intent,
        CancellationToken cancellationToken = default)
        => SaveExchangeAsync(sessionId, userMessage, null, intent, null, null, cancellationToken);

    public async Task SaveExchangeAsync(
        Guid sessionId,
        string userMessage,
        string? assistantMessage,
        AiAssistantIntentDto? intent,
        IReadOnlyList<AiHallRef>? shownHalls,
        AiHallRef? focusedHall,
        CancellationToken cancellationToken = default)
    {
        var message = SanitizeUserMessage(userMessage);
        if (string.IsNullOrWhiteSpace(message)) return;

        for (var attempt = 0; attempt < 20; attempt++)
        {
            var session = await _store.GetAsync(sessionId, cancellationToken);
            if (session is null || session.ExpiresAt <= DateTimeOffset.UtcNow) return;

            var expectedRevision = session.Revision;
            var turns = Deserialize<List<AiConversationTurn>>(session.TurnsJson) ?? [];
            turns.Add(new AiConversationTurn("user", message));

            var reply = (assistantMessage ?? string.Empty).Trim();
            if (reply.Length > 0)
            {
                if (reply.Length > MaxAssistantTurnCharacters) reply = reply[..MaxAssistantTurnCharacters];
                turns.Add(new AiConversationTurn("assistant", reply));
            }

            TrimTurns(turns);
            session.TurnsJson = Serialize(turns);
            if (intent is not null) session.LastIntentJson = Serialize(intent);
            if (shownHalls is { Count: > 0 }) session.LastHallsJson = Serialize(shownHalls.Take(MaxRememberedHalls).ToArray());
            if (focusedHall is not null) session.LastHallJson = Serialize(focusedHall);
            session.LastActivityAt = DateTimeOffset.UtcNow;
            session.ExpiresAt = session.LastActivityAt.Add(SessionDuration);

            if (await _store.TryUpdateAsync(session, expectedRevision, cancellationToken)) return;
        }
        // A history write is best-effort; a model/tool response must not fail because
        // another simultaneous tab updated the bounded memory first.
    }

    private static string SanitizeUserMessage(string? input)
    {
        var message = (input ?? string.Empty).Trim();
        if (message.Length > MaxStoredUserTurnCharacters)
            return "[long message omitted from assistant memory]";

        message = JwtPattern.Replace(message, "[redacted token]");
        message = BearerPattern.Replace(message, "Bearer [redacted token]");
        return SecretAssignmentPattern.Replace(message, "$1=[redacted]");
    }

    private static void TrimTurns(List<AiConversationTurn> turns)
    {
        while (turns.Count(turn => turn.Role == "user") > MaxRecordedTurns)
        {
            var next = turns.FindIndex(1, turn => turn.Role == "user");
            turns.RemoveRange(0, next < 0 ? turns.Count : next);
        }
    }

    private static bool OwnsSession(AiConversationSession session, string? userId)
        => string.Equals(session.UserId, string.IsNullOrWhiteSpace(userId) ? null : userId, StringComparison.Ordinal);

    private static AiSessionResponse ToResponse(AiConversationSession session)
        => new(session.SessionId, session.Language, session.CreatedAt.UtcDateTime, session.ExpiresAt.UtcDateTime);

    private static string Serialize<T>(T value) => JsonSerializer.Serialize(value, JsonOptions);

    private static T? Deserialize<T>(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return default;
        try { return JsonSerializer.Deserialize<T>(value, JsonOptions); }
        catch (JsonException) { return default; }
    }

    private const int MaxRecordedTurns = 6;
    private const int MaxStoredUserTurnCharacters = 600;
    private const int MaxAssistantTurnCharacters = 600;
    private const int MaxRememberedHalls = 10;
}

/// <summary>Per-instance store used only by unit tests that construct ChatSessionService directly.</summary>
internal sealed class InMemoryAiConversationSessionStore : IAiConversationSessionStore
{
    private readonly ConcurrentDictionary<Guid, AiConversationSession> _sessions = new();

    public Task<AiConversationSession?> GetAsync(Guid sessionId, CancellationToken cancellationToken = default)
    {
        _sessions.TryGetValue(sessionId, out var session);
        return Task.FromResult(session is null ? null : Copy(session));
    }

    public Task AddAsync(AiConversationSession session, CancellationToken cancellationToken = default)
    {
        _sessions[session.SessionId] = Copy(session);
        return Task.CompletedTask;
    }

    public Task<bool> TryUpdateAsync(AiConversationSession session, int expectedRevision, CancellationToken cancellationToken = default)
    {
        while (_sessions.TryGetValue(session.SessionId, out var current))
        {
            if (current.Revision != expectedRevision) return Task.FromResult(false);
            if (_sessions.TryUpdate(session.SessionId, Copy(session, expectedRevision + 1), current))
                return Task.FromResult(true);
        }
        return Task.FromResult(false);
    }

    public Task DeleteForUserAsync(string userId, CancellationToken cancellationToken = default)
    {
        foreach (var pair in _sessions)
            if (string.Equals(pair.Value.UserId, userId, StringComparison.Ordinal)) _sessions.TryRemove(pair.Key, out _);
        return Task.CompletedTask;
    }

    public Task DeleteExpiredAsync(DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        foreach (var pair in _sessions)
            if (pair.Value.ExpiresAt <= now) _sessions.TryRemove(pair.Key, out _);
        return Task.CompletedTask;
    }

    internal void SetExpiryForTesting(Guid sessionId, DateTimeOffset expiresAt)
    {
        if (!_sessions.TryGetValue(sessionId, out var current)) return;
        var updated = Copy(current);
        updated.ExpiresAt = expiresAt;
        _sessions[sessionId] = updated;
    }

    internal bool ContainsForTesting(Guid sessionId) => _sessions.ContainsKey(sessionId);

    private static AiConversationSession Copy(AiConversationSession value, int? revision = null) => new()
    {
        SessionId = value.SessionId,
        UserId = value.UserId,
        Language = value.Language,
        CreatedAt = value.CreatedAt,
        LastActivityAt = value.LastActivityAt,
        ExpiresAt = value.ExpiresAt,
        Revision = revision ?? value.Revision,
        TurnsJson = value.TurnsJson,
        LastIntentJson = value.LastIntentJson,
        LastHallsJson = value.LastHallsJson,
        LastHallJson = value.LastHallJson
    };
}
