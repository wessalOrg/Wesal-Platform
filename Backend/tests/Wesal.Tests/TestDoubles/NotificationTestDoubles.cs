using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Conversations;

namespace Wesal.Tests.TestDoubles;

/// <summary>
/// Records every notification the production code under test dispatches, so a test can
/// assert WHICH user was notified, for WHAT, with WHAT target, without standing up SignalR.
/// </summary>
public sealed class RecordingNotificationDispatcher : INotificationDispatcher
{
    public List<DispatchedNotification> Dispatches { get; } = new();

    /// <summary>
    /// When set, the dispatcher throws this instead of succeeding. Used to prove the
    /// best-effort contract: a realtime failure must never roll back a booking or fail an
    /// admin action.
    /// </summary>
    public Exception? ThrowOnDispatch { get; set; }

    public Task DispatchAsync(
        NotificationKind kind,
        string recipientUserId,
        IReadOnlyDictionary<string, string?>? values = null,
        string? targetId = null,
        CancellationToken cancellationToken = default)
    {
        if (ThrowOnDispatch is not null)
        {
            throw ThrowOnDispatch;
        }

        Dispatches.Add(new DispatchedNotification(
            kind,
            recipientUserId,
            values?.ToDictionary(pair => pair.Key, pair => pair.Value) ?? new Dictionary<string, string?>(),
            targetId));

        return Task.CompletedTask;
    }

    public DispatchedNotification Single() =>
        Dispatches.Count == 1
            ? Dispatches[0]
            : throw new InvalidOperationException(
                $"Expected exactly 1 dispatched notification but found {Dispatches.Count}.");

    public bool Has(NotificationKind kind, string recipientUserId) =>
        Dispatches.Any(d => d.Kind == kind && d.RecipientUserId == recipientUserId);
}

public sealed record DispatchedNotification(
    NotificationKind Kind,
    string RecipientUserId,
    IReadOnlyDictionary<string, string?> Values,
    string? TargetId);

/// <summary>
/// Renders notifications through the REAL <see cref="NotificationCatalog"/>, using a
/// per-user language the test controls. This keeps the catalog's exact Arabic/English
/// wording under test instead of stubbing it away, and lets a test prove that a recipient's
/// own preference — not the sender's or the acting admin's — decides the language.
/// </summary>
public sealed class FakeNotificationService : INotificationService
{
    private readonly Dictionary<string, Language> _languagesByUserId = new(StringComparer.Ordinal);
    private readonly Language _defaultLanguage;

    public FakeNotificationService(Language defaultLanguage = Language.Arabic)
    {
        _defaultLanguage = defaultLanguage;
    }

    /// <summary>Per-user rendered content, so a test can assert the exact wording produced.</summary>
    public List<RenderedNotification> Rendered { get; } = new();

    public void SetLanguage(string userId, Language language) => _languagesByUserId[userId] = language;

    public Task<NotificationContent> BuildAsync(
        NotificationKind kind,
        string recipientUserId,
        IReadOnlyDictionary<string, string?>? values = null,
        string? targetId = null,
        CancellationToken cancellationToken = default)
    {
        var language = _languagesByUserId.TryGetValue(recipientUserId, out var stored)
            ? stored
            : _defaultLanguage;

        var content = NotificationCatalog.Render(kind, language, values, targetId);

        Rendered.Add(new RenderedNotification(kind, recipientUserId, language, content));

        return Task.FromResult(content);
    }
}

public sealed record RenderedNotification(
    NotificationKind Kind,
    string RecipientUserId,
    Language Language,
    NotificationContent Content);

/// <summary>
/// Records every message pushed over the chat hub, so a test can assert that a message which
/// was merely persisted also became <i>live</i> for an open thread, without standing up SignalR.
/// </summary>
public sealed class RecordingConversationNotifier : IConversationNotifier
{
    public List<MessageSentEvent> Sent { get; } = new();

    /// <summary>
    /// When set, the notifier throws this instead of succeeding. Used to prove that a realtime
    /// failure cannot roll back work that has already been persisted.
    /// </summary>
    public Exception? ThrowOnNotify { get; set; }

    public Task NotifyMessageSentAsync(MessageSentEvent message, CancellationToken cancellationToken = default)
    {
        if (ThrowOnNotify is not null)
        {
            throw ThrowOnNotify;
        }

        Sent.Add(message);
        return Task.CompletedTask;
    }

    public MessageSentEvent Single() =>
        Sent.Count == 1
            ? Sent[0]
            : throw new InvalidOperationException(
                $"Expected exactly 1 pushed message but found {Sent.Count}.");
}
