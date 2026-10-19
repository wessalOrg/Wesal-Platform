using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Help;

/// <summary>
/// The Help Center ("مركز المساعدة"). Owners file and read only their own tickets, the Admin
/// sees the whole queue, and a reply flips the ticket to "replied" and raises the owner's
/// unread flag so the answer is waiting for them on any device.
/// </summary>
public sealed class HelpTicketsService : IHelpTicketsService
{
    public const int MaxQuestionLength = 1000;
    public const int MaxReplyLength = 2000;
    public const int MaxUserNameLength = 200;

    private const string FallbackUserName = "مستخدم";

    private readonly IHelpTicketRepository _tickets;
    private readonly ICurrentUserService _currentUser;
    private readonly TimeProvider _clock;

    public HelpTicketsService(
        IHelpTicketRepository tickets,
        ICurrentUserService currentUser,
        TimeProvider clock)
    {
        _tickets = tickets;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<HelpTicketDto> CreateAsync(
        CreateHelpTicketRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var userId = RequireUserId();
        var question = (request.Question ?? string.Empty).Trim();
        if (question.Length == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["question"] = ["Question is required."]
            });
        }

        if (question.Length > MaxQuestionLength)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["question"] = [$"Question must be at most {MaxQuestionLength} characters."]
            });
        }

        var userName = (request.UserName ?? string.Empty).Trim();
        if (userName.Length == 0)
        {
            userName = FallbackUserName;
        }
        else if (userName.Length > MaxUserNameLength)
        {
            userName = userName[..MaxUserNameLength];
        }

        var ticket = new HelpTicket
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            UserName = userName,
            Question = question,
            CreatedAt = _clock.GetUtcNow(),
            Status = HelpTicketStatus.Open
        };

        await _tickets.AddAsync(ticket, cancellationToken);
        return Map(ticket);
    }

    public async Task<IReadOnlyList<HelpTicketDto>> ListMineAsync(CancellationToken cancellationToken = default)
    {
        var tickets = await _tickets.ListForUserAsync(RequireUserId(), cancellationToken);
        return tickets.Select(Map).ToList();
    }

    public async Task MarkReadAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var userId = RequireUserId();
        var ticket = await _tickets.GetByIdAsync(id, cancellationToken);
        if (ticket is null || !string.Equals(ticket.UserId, userId, StringComparison.Ordinal))
        {
            // Do not reveal that somebody else's ticket exists.
            throw new NotFoundException("Help ticket not found.");
        }

        if (!ticket.UserUnread)
        {
            return;
        }

        ticket.UserUnread = false;
        await _tickets.SaveChangesAsync(cancellationToken);
    }

    public async Task<PagedResult<HelpTicketDto>> ListAllAsync(
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var result = await _tickets.ListAllAsync(page, pageSize, cancellationToken);
        return PagedResult<HelpTicketDto>.Create(
            result.Items.Select(Map).ToList(),
            result.PageNumber,
            result.PageSize,
            result.TotalCount);
    }

    public async Task<HelpTicketDto> ReplyAsync(
        Guid id,
        ReplyHelpTicketRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var reply = (request.Reply ?? string.Empty).Trim();
        if (reply.Length == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["reply"] = ["Reply is required."]
            });
        }

        if (reply.Length > MaxReplyLength)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["reply"] = [$"Reply must be at most {MaxReplyLength} characters."]
            });
        }

        var ticket = await _tickets.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException("Help ticket not found.");

        var now = _clock.GetUtcNow();
        ticket.Reply = reply;
        ticket.Status = HelpTicketStatus.Replied;
        ticket.RepliedAt = now;
        ticket.RepliedByUserId = _currentUser.UserId;
        ticket.UserUnread = true;
        // Answering is proof the Admin has seen the conversation, so it counts as read too.
        ticket.ReadByAdminAt ??= now;

        await _tickets.SaveChangesAsync(cancellationToken);
        return Map(ticket);
    }

    public async Task MarkConversationReadAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        var ownerId = (userId ?? string.Empty).Trim();
        if (ownerId.Length == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["userId"] = ["User id is required."]
            });
        }

        await _tickets.MarkConversationReadAsync(ownerId, _clock.GetUtcNow(), cancellationToken);
    }

    private static HelpTicketDto Map(HelpTicket ticket) => new()
    {
        Id = ticket.Id,
        UserId = ticket.UserId,
        UserName = ticket.UserName,
        Question = ticket.Question,
        CreatedAt = ticket.CreatedAt,
        Status = ticket.Status == HelpTicketStatus.Replied ? "replied" : "open",
        Reply = ticket.Reply,
        RepliedAt = ticket.RepliedAt,
        UserUnread = ticket.UserUnread,
        AdminUnread = ticket.ReadByAdminAt is null
    };

    private string RequireUserId()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to use the Help Center.");
        }

        return _currentUser.UserId;
    }
}
