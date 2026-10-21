using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// The Help Center ("مركز المساعدة"). Owners can file and read their own tickets; only Admin
/// can see the queue and answer. Ownership always comes from the session, never the request.
/// </summary>
public interface IHelpTicketsService
{
    /// <summary>Files a question for the current user.</summary>
    Task<HelpTicketDto> CreateAsync(
        CreateHelpTicketRequestDto request,
        CancellationToken cancellationToken = default);

    /// <summary>The current user's tickets, newest first.</summary>
    Task<IReadOnlyList<HelpTicketDto>> ListMineAsync(CancellationToken cancellationToken = default);

    /// <summary>Clears the owner's "unread reply" flag. Idempotent.</summary>
    Task MarkReadAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>The Admin queue, newest first.</summary>
    Task<PagedResult<HelpTicketDto>> ListAllAsync(
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    /// <summary>Answers a ticket; the owner is notified through the unread flag.</summary>
    Task<HelpTicketDto> ReplyAsync(
        Guid id,
        ReplyHelpTicketRequestDto request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Marks the ticket owner's whole conversation read for the Admin team. Idempotent; the
    /// read marker is shared across all Admins.
    /// </summary>
    Task MarkConversationReadAsync(string userId, CancellationToken cancellationToken = default);
}
