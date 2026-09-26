using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// An image posted to a conversation (WESAL-TASK-4, Edit 4). Mirrors
/// <see cref="OwnerDocumentUpload"/> so the existing upload validator and protected
/// document storage can be reused unchanged.
/// </summary>
public sealed class MessageAttachmentUpload
{
    public string FileName { get; init; } = string.Empty;

    public string ContentType { get; init; } = string.Empty;

    public byte[] Content { get; init; } = [];
}

public interface IConversationService
{
    Task<ConversationResponse> CreateConversationAsync(Guid hallId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Opens (or resolves) the Hall Owner's own owner/Admin thread for one of their halls
    /// (WESAL-TASK-11, Edit 11).
    ///
    /// This is a general-purpose entry point, deliberately independent of the
    /// payment-notice trigger: before it, the thread only came into existence as a side
    /// effect of an Admin action, so an owner who had not yet received any notice had
    /// nothing to open. It reuses Edit 4's deterministic (HallId, HallOwnerId) resolution
    /// so the thread is always the SAME one the payment notice and every other Admin
    /// message use, never a second parallel conversation.
    ///
    /// Only the owner of the hall may call this. Edit 4's unpaid carve-out still applies:
    /// an Approved-but-unpaid owner can reach the Admin, because that thread is exactly
    /// where the subscription is settled. A locked hall is still refused.
    /// </summary>
    Task<ConversationResponse> ContactAdminAsync(Guid hallId, CancellationToken cancellationToken = default);

    Task<ConversationResponse> GetConversationAsync(Guid conversationId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ConversationSummaryResponse>> GetMyConversationsAsync(CancellationToken cancellationToken = default);

    Task<MessageThreadResponse> GetConversationThreadAsync(Guid conversationId, CancellationToken cancellationToken = default);

    Task<SendMessageResponse> SendMessageAsync(
        Guid conversationId,
        SendMessageRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Posts a message that carries an image attachment (WESAL-TASK-4, Edit 4). Used by
    /// the owner to send subscription-payment proof to the Admins in the same owner/Admin
    /// thread used for every other owner/Admin message. The caption is optional: the
    /// message may be attachment-only.
    /// </summary>
    Task<SendMessageResponse> SendAttachmentMessageAsync(
        Guid conversationId,
        MessageAttachmentUpload attachment,
        string? content,
        string? clientRequestId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Streams a message's image attachment to an authenticated participant of the
    /// conversation. Throws NotFound when the message has no attachment.
    /// </summary>
    Task<StoredDocument> GetMessageAttachmentAsync(
        Guid conversationId,
        Guid messageId,
        CancellationToken cancellationToken = default);

    Task MarkAsReadAsync(Guid conversationId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes one conversation from the caller's own inbox (WESAL-TASK-6, Edit 6).
    ///
    /// Per-user and non-destructive: the conversation, its messages, and every other
    /// participant's view are left exactly as they were. The thread reappears in the
    /// caller's inbox automatically once a new message arrives after the hide.
    /// </summary>
    Task HideConversationAsync(Guid conversationId, CancellationToken cancellationToken = default);

    Task<UnreadCountResponse> GetUnreadCountAsync(CancellationToken cancellationToken = default);
}
