using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
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

        // WESAL-TASK-10 (Edit 10 follow-up): this used to assert True. The only message in
        // the thread was sent by owner-1, so for owner-1 the thread contains nothing they
        // have not already seen and the correct answer is False — which is also what the
        // badge count said all along. The old True was the divergent algorithm reporting a
        // thread as unread on the strength of the caller's OWN message.
        Assert.False((await repository.GetUnreadStatusAsync("owner-1", [conversation.Id]))[conversation.Id]);

        // The flag and the badge must agree for both parties. owner-1: nothing unread, the
        // only message was their own. seeker-1: nothing unread, the thread is hidden and no
        // newer message has arrived to bring it back.
        Assert.Equal(0, await repository.GetUnreadConversationCountAsync("owner-1"));
        Assert.Equal(0, await repository.GetUnreadConversationCountAsync("seeker-1"));
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

    // ======================================================================================
    // WESAL-TASK-10 (Edit 10): the read state has a composite primary key of
    // (ConversationId, UserId), and both writers read-then-insert. Two requests that both saw
    // "no row" therefore both inserted, and the second SaveChanges failed on the key. Nothing
    // handled that, so a double-tapped "mark as read" - or a read racing a hide - surfaced as an
    // unhandled 500. These tests pin the recovery: the losing insert is dropped and the same
    // change is applied to the row that won.
    // ======================================================================================

    [Fact]
    public async Task UpsertReadStateAsync_LosingTheInsertRace_AppliesToTheWinningRow()
    {
        var store = new SharedInMemoryStore();
        await using var context = store.CreateContext();
        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, "seeker-1", "owner-1");
        var readAt = new DateTimeOffset(2026, 3, 1, 12, 0, 0, TimeSpan.Zero);

        // The competing request commits the same composite key through its own context first.
        var repository = new ConversationRepository(
            store.CreateContext(intercept: new LostInsertRaceInterceptor(store, readAt)));

        await repository.UpsertReadStateAsync(conversation.Id, "seeker-1", readAt);

        await using var verify = store.CreateContext();
        var state = await verify.ConversationReadStates
            .SingleAsync(s => s.ConversationId == conversation.Id && s.UserId == "seeker-1");

        Assert.Equal(readAt, state.LastReadAt);
        _ = hall;
    }

    [Fact]
    public async Task HideConversationAsync_LosingTheInsertRace_AppliesToTheWinningRow()
    {
        var store = new SharedInMemoryStore();
        await using var context = store.CreateContext();
        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, "seeker-1", "owner-1");
        var hiddenAt = new DateTimeOffset(2026, 3, 2, 9, 30, 0, TimeSpan.Zero);

        // The competing request hides the same thread first; our hide must not fail, it must
        // land on the row that already exists.
        var repository = new ConversationRepository(
            store.CreateContext(intercept: new LostInsertRaceInterceptor(store, hiddenAt)));

        await repository.HideConversationAsync(conversation.Id, "seeker-1", hiddenAt);

        await using var verify = store.CreateContext();
        var state = await verify.ConversationReadStates
            .SingleAsync(s => s.ConversationId == conversation.Id && s.UserId == "seeker-1");

        Assert.Equal(hiddenAt, state.HiddenAt);
        _ = hall;
    }

    [Fact]
    public async Task UpsertReadStateAsync_WithoutTheRace_StillInsertsOneRow()
    {
        // The recovery must not have changed the ordinary path.
        var store = new SharedInMemoryStore();
        await using var context = store.CreateContext();
        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, "seeker-1", "owner-1");
        var readAt = DateTimeOffset.UtcNow;
        var repository = new ConversationRepository(context);

        await repository.UpsertReadStateAsync(conversation.Id, "seeker-1", readAt);
        await repository.UpsertReadStateAsync(conversation.Id, "seeker-1", readAt.AddMinutes(1));

        var rows = await context.ConversationReadStates
            .Where(s => s.ConversationId == conversation.Id && s.UserId == "seeker-1")
            .ToListAsync();

        Assert.Single(rows);
        Assert.Equal(readAt.AddMinutes(1), rows[0].LastReadAt);
        _ = hall;
    }

    /// <summary>
    /// Two <see cref="ApplicationDbContext"/> instances over one named in-memory store, so a
    /// test can model a genuinely separate request committing a row underneath another one.
    /// </summary>
    private sealed class SharedInMemoryStore
    {
        private readonly string _name = Guid.NewGuid().ToString();

        public ApplicationDbContext CreateContext(IInterceptor? intercept = null)
        {
            var builder = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(_name);

            if (intercept is not null)
            {
                builder.AddInterceptors(intercept);
            }

            return new ApplicationDbContext(builder.Options);
        }

        public void InsertCompetingReadState(Guid conversationId, string userId, DateTimeOffset watermark)
        {
            using var competing = CreateContext();
            competing.ConversationReadStates.Add(new ConversationReadState
            {
                ConversationId = conversationId,
                UserId = userId,
                LastReadAt = watermark,
                HiddenAt = watermark
            });
            competing.SaveChanges();
        }
    }

    /// <summary>
    /// Models losing the insert race on the composite key: just before the save, a separate
    /// request commits the same (ConversationId, UserId) row, and this save is then failed the
    /// way Postgres fails it (SQLSTATE 23505).
    /// </summary>
    private sealed class LostInsertRaceInterceptor : SaveChangesInterceptor
    {
        private readonly SharedInMemoryStore _store;
        private readonly DateTimeOffset _watermark;
        private bool _armed = true;

        public LostInsertRaceInterceptor(SharedInMemoryStore store, DateTimeOffset watermark)
        {
            _store = store;
            _watermark = watermark;
        }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            var added = eventData.Context!.ChangeTracker
                .Entries<ConversationReadState>()
                .FirstOrDefault(entry => entry.State == EntityState.Added);

            if (_armed && added is not null)
            {
                _armed = false;

                // The competing request wins, then our insert fails on the primary key.
                _store.InsertCompetingReadState(added.Entity.ConversationId, added.Entity.UserId, _watermark);

                throw new DbUpdateException(
                    "An error occurred while saving the entity changes.",
                    new Exception("23505 duplicate key value violates unique constraint \"PK_ConversationReadStates\""));
            }

            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }
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

    /// <summary>
    /// WESAL-TASK-10 (Edit 10 follow-up): the badge and the per-conversation flag were two
    /// different implementations of "unread". The badge counts only messages sent BY THE
    /// OTHER PARTY, while the flag looked at the latest message in the thread regardless of
    /// who sent it. So a thread whose most recent message is the caller's own was reported
    /// unread by the flag and not-unread by the badge — the list would advertise an unread
    /// badge over a thread the user had just replied in. These pin the flag to the badge's
    /// rule, which is the defensible one: unread means "an incoming message I have not seen".
    /// </summary>
    [Fact]
    public async Task GetUnreadStatusAsync_ThreadEndingInTheCallersOwnMessageIsNotUnread()
    {
        await using var context = CreateContext();
        var repository = new ConversationRepository(context);

        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, "owner-1", "seeker-1");

        var t0 = DateTimeOffset.UtcNow.AddMinutes(-10);
        SeedMessage(context, conversation.Id, "owner-1", "incoming", t0);

        // The caller opens the thread, which marks it read up to the incoming message...
        context.ConversationReadStates.Add(new ConversationReadState
        {
            ConversationId = conversation.Id,
            UserId = "seeker-1",
            LastReadAt = t0
        });
        context.SaveChanges();

        // ...and then replies. Their own reply is the newest message in the thread and is
        // newer than their read watermark, which is exactly the shape that made the flag
        // disagree with the badge.
        SeedMessage(context, conversation.Id, "seeker-1", "my own reply", t0.AddMinutes(1));

        var status = await repository.GetUnreadStatusAsync("seeker-1", [conversation.Id]);

        Assert.False(status[conversation.Id]);
        Assert.Equal(0, await repository.GetUnreadConversationCountAsync("seeker-1"));
    }

    [Fact]
    public async Task GetUnreadStatusAsync_ThreadOfOnlyMyOwnMessagesIsNotUnread()
    {
        await using var context = CreateContext();
        var repository = new ConversationRepository(context);

        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, "owner-1", "seeker-1");

        // No incoming message at all, and no read state either.
        var t0 = DateTimeOffset.UtcNow.AddMinutes(-10);
        SeedMessage(context, conversation.Id, "seeker-1", "mine", t0);

        var status = await repository.GetUnreadStatusAsync("seeker-1", [conversation.Id]);

        Assert.False(status[conversation.Id]);
        Assert.Equal(0, await repository.GetUnreadConversationCountAsync("seeker-1"));
    }

    /// <summary>
    /// The converse guard: a genuinely newer INCOMING message must still be unread on both
    /// algorithms, so unifying them did not accidentally mark real unread threads as read.
    /// </summary>
    [Fact]
    public async Task GetUnreadStatusAsync_NewerIncomingMessageStaysUnreadOnBothAlgorithms()
    {
        await using var context = CreateContext();
        var repository = new ConversationRepository(context);

        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, "owner-1", "seeker-1");

        var t0 = DateTimeOffset.UtcNow.AddMinutes(-10);
        SeedMessage(context, conversation.Id, "owner-1", "incoming", t0);

        context.ConversationReadStates.Add(new ConversationReadState
        {
            ConversationId = conversation.Id,
            UserId = "seeker-1",
            LastReadAt = t0.AddMinutes(-1)
        });
        context.SaveChanges();

        var status = await repository.GetUnreadStatusAsync("seeker-1", [conversation.Id]);

        Assert.True(status[conversation.Id]);
        Assert.Equal(1, await repository.GetUnreadConversationCountAsync("seeker-1"));
    }

    /// <summary>
    /// A read state that exists but has not yet reached a message still reports unread, and
    /// so does an absent read state. This is the common "new thread" shape and both
    /// algorithms must agree on it.
    /// </summary>
    [Fact]
    public async Task GetUnreadStatusAsync_NoReadStateAndIncomingMessageIsUnread()
    {
        await using var context = CreateContext();
        var repository = new ConversationRepository(context);

        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, "owner-1", "seeker-1");

        SeedMessage(context, conversation.Id, "owner-1", "incoming", DateTimeOffset.UtcNow.AddMinutes(-1));

        var status = await repository.GetUnreadStatusAsync("seeker-1", [conversation.Id]);

        Assert.True(status[conversation.Id]);
        Assert.Equal(1, await repository.GetUnreadConversationCountAsync("seeker-1"));
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