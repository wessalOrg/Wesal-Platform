using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public class ConversationInboxRepositoryShould
{
    [Fact]
    public async Task GetParticipantConversationsAsync_ReturnsConversationsWhereUserIsSender()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, sender: "user-1", owner: "owner-1");
        SeedConversation(context, hall.Id, sender: "other-user", owner: "owner-1");
        _ = conversation;
        var repository = new ConversationRepository(context);

        var result = await repository.GetParticipantConversationsAsync("user-1");

        var returned = Assert.Single(result);
        Assert.Equal(conversation.Id, returned.Id);
    }

    [Fact]
    public async Task GetParticipantConversationsAsync_ReturnsConversationsWhereUserIsOwner()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, sender: "user-1", owner: "owner-1");
        SeedConversation(context, hall.Id, sender: "user-1", owner: "other-owner");
        var repository = new ConversationRepository(context);

        var result = await repository.GetParticipantConversationsAsync("owner-1");

        var returned = Assert.Single(result);
        Assert.Equal(conversation.Id, returned.Id);
    }

    [Fact]
    public async Task GetParticipantConversationsAsync_IncludesHallNavigation()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context, "Grand Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, sender: "user-1", owner: "owner-1");
        var repository = new ConversationRepository(context);

        var result = await repository.GetParticipantConversationsAsync("user-1");

        var returned = Assert.Single(result);
        Assert.Equal(conversation.Id, returned.Id);
        Assert.NotNull(returned.Hall);
        Assert.Equal("Grand Hall", returned.Hall.Name);
    }

    [Fact]
    public async Task GetParticipantConversationsAsync_ExcludesConversationsWithDeletedHall()
    {
        await using var context = CreateContext();
        var activeHall = SeedHall(context, "Active", isDeleted: false);
        var deletedHall = SeedHall(context, "Deleted", isDeleted: true);
        SeedConversation(context, activeHall.Id, sender: "user-1", owner: "owner-1");
        SeedConversation(context, deletedHall.Id, sender: "user-1", owner: "owner-1");
        var repository = new ConversationRepository(context);

        var result = await repository.GetParticipantConversationsAsync("user-1");

        var returned = Assert.Single(result);
        Assert.Equal(activeHall.Id, returned.HallId);
    }

    [Fact]
    public async Task GetParticipantConversationsAsync_ReturnsEmptyWhenNoConversations()
    {
        await using var context = CreateContext();
        var repository = new ConversationRepository(context);

        var result = await repository.GetParticipantConversationsAsync("user-1");

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetParticipantConversationsAsync_OrdersByMostRecentCreatedAt()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context, "Hall", isDeleted: false);
        var older = SeedConversation(context, hall.Id, sender: "user-1", owner: "owner-1", createdAt: DateTimeOffset.UtcNow.AddDays(-2));
        var newer = SeedConversation(context, hall.Id, sender: "user-1", owner: "owner-1", createdAt: DateTimeOffset.UtcNow.AddDays(-1));
        var repository = new ConversationRepository(context);

        var result = await repository.GetParticipantConversationsAsync("user-1");

        Assert.Equal(newer.Id, result[0].Id);
        Assert.Equal(older.Id, result[1].Id);
    }

    [Fact]
    public async Task GetUserDisplayNamesAsync_ReturnsFullNamesForRequestedUsers()
    {
        await using var context = CreateContext();
        context.Users.AddRange(
            new ApplicationUser { Id = "user-1", UserName = "user1", FullName = "Ahmed Ali" },
            new ApplicationUser { Id = "owner-1", UserName = "owner1", FullName = "Sara Omar" });
        context.SaveChanges();
        var repository = new ConversationRepository(context);

        var result = await repository.GetUserDisplayNamesAsync(["user-1", "unknown-1", "owner-1"]);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, info => info.UserId == "user-1" && info.FullName == "Ahmed Ali");
        Assert.Contains(result, info => info.UserId == "owner-1" && info.FullName == "Sara Omar");
    }

    [Fact]
    public async Task GetUserDisplayNamesAsync_EmptyIds_ReturnsEmpty()
    {
        await using var context = CreateContext();
        var repository = new ConversationRepository(context);

        var result = await repository.GetUserDisplayNamesAsync([]);

        Assert.Empty(result);
    }

    // --- WESAL-TASK-6, Edit 6: per-user soft delete (hide) ---

    [Fact]
    public async Task HideConversationAsync_RemovesItFromTheHidersInboxOnly()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, sender: "seeker-1", owner: "owner-1");
        SeedMessage(context, conversation.Id, "owner-1", "Welcome", conversation.CreatedAt.AddMinutes(1));
        var repository = new ConversationRepository(context);

        // Hidden strictly after the last message, so no newer message can bring it back yet.
        await repository.HideConversationAsync(
            conversation.Id, "seeker-1", conversation.CreatedAt.AddHours(1));

        Assert.Empty(await repository.GetParticipantConversationsAsync("seeker-1"));

        // The other participant is completely unaffected: same thread, still listed.
        var ownerView = await repository.GetParticipantConversationsAsync("owner-1");
        Assert.Equal(conversation.Id, Assert.Single(ownerView).Id);
    }

    [Fact]
    public async Task HideConversationAsync_LeavesTheConversationAndItsMessagesInTheDatabase()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, sender: "seeker-1", owner: "owner-1");
        var message = SeedMessage(context, conversation.Id, "owner-1", "Payment notice", DateTimeOffset.UtcNow);
        var repository = new ConversationRepository(context);

        await repository.HideConversationAsync(conversation.Id, "seeker-1", DateTimeOffset.UtcNow);

        // Nothing is destroyed: the thread row and every message row survive, so the payment
        // workflow's permanent record cannot be damaged by a participant hiding a thread.
        Assert.Equal(1, await context.Conversations.CountAsync(c => c.Id == conversation.Id));
        Assert.Equal(1, await context.Messages.CountAsync(m => m.Id == message.Id));
    }

    [Fact]
    public async Task GetParticipantConversationsAsync_HiddenConversationStaysHiddenWithoutNewMessages()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, sender: "seeker-1", owner: "owner-1");
        var hiddenAt = conversation.CreatedAt.AddHours(1);
        context.ConversationReadStates.Add(new ConversationReadState
        {
            ConversationId = conversation.Id,
            UserId = "seeker-1",
            HiddenAt = hiddenAt
        });
        // Only messages from BEFORE the hide exist.
        SeedMessage(context, conversation.Id, "owner-1", "old", conversation.CreatedAt);
        await context.SaveChangesAsync();
        var repository = new ConversationRepository(context);

        Assert.Empty(await repository.GetParticipantConversationsAsync("seeker-1"));
    }

    [Fact]
    public async Task GetParticipantConversationsAsync_NewMessageAfterHideMakesTheConversationReappear()
    {
        // The re-appear rule, proven at the query level: the hide is a watermark, so a message
        // created after it is enough to bring the thread back with no extra state.
        await using var context = CreateContext();
        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, sender: "seeker-1", owner: "owner-1");
        var hiddenAt = conversation.CreatedAt.AddHours(1);
        context.ConversationReadStates.Add(new ConversationReadState
        {
            ConversationId = conversation.Id,
            UserId = "seeker-1",
            HiddenAt = hiddenAt
        });
        SeedMessage(context, conversation.Id, "owner-1", "before", conversation.CreatedAt);
        SeedMessage(context, conversation.Id, "owner-1", "after", hiddenAt.AddMinutes(5));
        await context.SaveChangesAsync();
        var repository = new ConversationRepository(context);

        var result = await repository.GetParticipantConversationsAsync("seeker-1");

        Assert.Equal(conversation.Id, Assert.Single(result).Id);

        // The stale watermark row is deliberately left in place; the message timestamp is what
        // makes the thread visible again, so there is nothing to reconcile or clear.
        var state = await context.ConversationReadStates.SingleAsync();
        Assert.Equal(hiddenAt, state.HiddenAt);
    }

    [Fact]
    public async Task GetUnreadConversationCountAsync_ExcludesHiddenConversations()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context, "Hall", isDeleted: false);
        var hidden = SeedConversation(context, hall.Id, sender: "seeker-1", owner: "owner-1");
        var visible = SeedConversation(context, hall.Id, sender: "seeker-1", owner: "owner-2");
        var messageAt = DateTimeOffset.UtcNow;
        SeedMessage(context, hidden.Id, "owner-1", "unread", messageAt);
        SeedMessage(context, visible.Id, "owner-2", "unread", messageAt);
        var repository = new ConversationRepository(context);

        // Both start unread for the seeker.
        Assert.Equal(2, await repository.GetUnreadConversationCountAsync("seeker-1"));

        await repository.HideConversationAsync(hidden.Id, "seeker-1", messageAt.AddHours(1));

        // The badge must never advertise a thread the inbox is deliberately not showing.
        Assert.Equal(1, await repository.GetUnreadConversationCountAsync("seeker-1"));

        // The other participant is completely unaffected by the seeker's hide.
        var ownerInbox = await repository.GetParticipantConversationsAsync("owner-1");
        Assert.Equal(hidden.Id, Assert.Single(ownerInbox).Id);
    }

    [Fact]
    public async Task GetUnreadStatusAsync_ReportsHiddenConversationAsNotUnread()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, sender: "seeker-1", owner: "owner-1");
        SeedMessage(context, conversation.Id, "owner-1", "unread", DateTimeOffset.UtcNow);
        var repository = new ConversationRepository(context);

        Assert.True((await repository.GetUnreadStatusAsync("seeker-1", [conversation.Id]))[conversation.Id]);

        await repository.HideConversationAsync(conversation.Id, "seeker-1", DateTimeOffset.UtcNow);

        Assert.False((await repository.GetUnreadStatusAsync("seeker-1", [conversation.Id]))[conversation.Id]);
        Assert.True((await repository.GetUnreadStatusAsync("owner-1", [conversation.Id]))[conversation.Id]);
    }

    [Fact]
    public async Task HideConversationAsync_IsIdempotentAndRefreshesTheWatermark()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, sender: "seeker-1", owner: "owner-1");
        SeedMessage(context, conversation.Id, "owner-1", "unread", DateTimeOffset.UtcNow);
        var repository = new ConversationRepository(context);

        var first = DateTimeOffset.UtcNow;
        var later = first.AddHours(1);
        await repository.HideConversationAsync(conversation.Id, "seeker-1", first);
        await repository.HideConversationAsync(conversation.Id, "seeker-1", later);

        var states = await context.ConversationReadStates.ToListAsync();
        var state = Assert.Single(states);
        Assert.Equal(later, state.HiddenAt);
        Assert.Empty(await repository.GetParticipantConversationsAsync("seeker-1"));
    }

    [Fact]
    public async Task HideConversationAsync_DoesNotMarkTheConversationAsRead()
    {
        // Hiding a thread is not reading it. Leaving LastReadAt at its default keeps a
        // hidden-then-reappeared thread correctly unread.
        await using var context = CreateContext();
        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, sender: "seeker-1", owner: "owner-1");
        var repository = new ConversationRepository(context);

        await repository.HideConversationAsync(conversation.Id, "seeker-1", DateTimeOffset.UtcNow);

        var state = await context.ConversationReadStates.SingleAsync();
        Assert.Equal(default, state.LastReadAt);
        Assert.NotNull(state.HiddenAt);
    }

    [Fact]
    public async Task GetByHallAndUserAsync_ResolvesTheOldestThreadDeterministically()
    {
        // WESAL-TASK-6, Edit 6: the same discipline already applied to the owner/Admin lookup.
        // There is no unique constraint on (HallId, SenderUserId), so if duplicates ever exist
        // the resolution must still be stable rather than flipping between calls.
        await using var context = CreateContext();
        var hall = SeedHall(context, "Hall", isDeleted: false);
        var baseTime = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var older = SeedConversation(context, hall.Id, "seeker-1", "owner-1", baseTime);
        var newer = SeedConversation(context, hall.Id, "seeker-1", "owner-1", baseTime.AddDays(1));
        var repository = new ConversationRepository(context);

        for (var attempt = 0; attempt < 5; attempt++)
        {
            var resolved = await repository.GetByHallAndUserAsync(hall.Id, "seeker-1");
            Assert.Equal(older.Id, resolved!.Id);
        }

        Assert.NotEqual(newer.Id, older.Id);
    }

    [Fact]
    public async Task GetByHallAndUserAsync_ScopesToTheHallSoADifferentHallGetsItsOwnThread()
    {
        await using var context = CreateContext();
        var firstHall = SeedHall(context, "First", isDeleted: false);
        var secondHall = SeedHall(context, "Second", isDeleted: false);
        var first = SeedConversation(context, firstHall.Id, "seeker-1", "owner-1");
        SeedConversation(context, secondHall.Id, "seeker-1", "owner-2");
        var repository = new ConversationRepository(context);

        var resolved = await repository.GetByHallAndUserAsync(firstHall.Id, "seeker-1");

        Assert.Equal(first.Id, resolved!.Id);
    }

    [Fact]
    public void VisibleToUser_HideWatermarkPredicate_TranslatesToPostgresSql()
    {
        // The other hide tests run on the in-memory provider, which evaluates the predicate in
        // memory and therefore proves nothing about production. The nested "has a hide
        // watermark AND no newer message" correlation is exactly the kind of expression a
        // relational provider can refuse to translate, and that failure would only surface as
        // a 500 on the live inbox endpoint. No connection is opened and the credentials below are
        // placeholders: ToQueryString compiles the query and renders SQL without connecting.
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=localhost;Database=translation_only;Username=unused;Password=unused")
            .Options;
        using var context = new ApplicationDbContext(options);

        var sql = context.Conversations
            .Where(conversation => conversation.SenderUserId == "seeker-1")
            .Where(ConversationRepository.VisibleToUser(context, "seeker-1"))
            .ToQueryString();

        Assert.Contains("ConversationReadStates", sql);
        Assert.Contains("Messages", sql);
    }

    private static Message SeedMessage(
        ApplicationDbContext context,
        Guid conversationId,
        string sender,
        string content,
        DateTimeOffset createdAt)
    {
        var message = new Message
        {
            Id = Guid.NewGuid(),
            ConversationId = conversationId,
            SenderUserId = sender,
            Content = content,
            CreatedAt = createdAt
        };
        context.Messages.Add(message);
        context.SaveChanges();
        return message;
    }

    private static Hall SeedHall(ApplicationDbContext context, string name, bool isDeleted)
    {
        var hall = new Hall { Id = Guid.NewGuid(), Name = name, IsDeleted = isDeleted };
        context.Halls.Add(hall);
        context.SaveChanges();
        return hall;
    }

    private static Conversation SeedConversation(
        ApplicationDbContext context,
        Guid hallId,
        string sender,
        string owner,
        DateTimeOffset? createdAt = null)
    {
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hallId,
            SenderUserId = sender,
            HallOwnerId = owner,
            CreatedAt = createdAt ?? DateTimeOffset.UtcNow
        };
        context.Conversations.Add(conversation);
        context.SaveChanges();
        return conversation;
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }
}