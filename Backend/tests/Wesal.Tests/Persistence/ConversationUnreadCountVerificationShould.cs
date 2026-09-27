using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

/// <summary>
/// WESAL-TASK-10, Edit 14: verification of the unread count.
///
/// The count endpoint and the inbox list are two separate queries written at two
/// different times against the same question â€” "does this user have anything they
/// have not read?" â€” and they are allowed to disagree only if nothing checks.
/// They did disagree (WESAL-TASK-10 follow-up: the flag compared the watermark
/// against the newest message whoever sent it, the count only the other party's).
/// Unifying their rule is necessary but not sufficient: two implementations of
/// one rule still drift, and a badge is the most-looked-at number in the feature.
///
/// So this pins the property that actually matters, independently of the rule:
/// for any user, the badge count equals the number of inbox rows reported unread.
/// It is asserted over a scenario that mixes every branch of the rule at once, so
/// it catches a disagreement introduced by a LATER change to either query, not
/// just the pair that was fixed.
/// </summary>
public class ConversationUnreadCountVerificationShould
{
    [Fact]
    public async Task UnreadCount_EqualsTheNumberOfInboxRowsReportedUnread()
    {
        await using var context = CreateContext();
        var repository = new ConversationRepository(context);

        var t0 = DateTimeOffset.UtcNow.AddHours(-2);

        // 1. An incoming message the caller has never read.
        var hall1 = SeedHall(context, "Unread", isDeleted: false);
        var unread = SeedConversation(context, hall1.Id, "owner-1", "seeker-1");
        SeedMessage(context, unread.Id, "owner-1", "payment required", t0);

        // 2. An incoming message the caller has read.
        var hall2 = SeedHall(context, "Read", isDeleted: false);
        var read = SeedConversation(context, hall2.Id, "owner-1", "seeker-1");
        SeedMessage(context, read.Id, "owner-1", "seen already", t0);
        context.ConversationReadStates.Add(new ConversationReadState
        {
            ConversationId = read.Id,
            UserId = "seeker-1",
            LastReadAt = t0.AddMinutes(1)
        });
        context.SaveChanges();

        // 3. A thread the caller has replied in and has therefore read.
        var hall3 = SeedHall(context, "Replied", isDeleted: false);
        var replied = SeedConversation(context, hall3.Id, "owner-1", "seeker-1");
        SeedMessage(context, replied.Id, "owner-1", "is this available?", t0);
        SeedMessage(context, replied.Id, "seeker-1", "my reply", t0.AddMinutes(5));
        context.ConversationReadStates.Add(new ConversationReadState
        {
            ConversationId = replied.Id,
            UserId = "seeker-1",
            LastReadAt = t0.AddMinutes(1)
        });
        context.SaveChanges();

        // 4. A thread with nothing in it but the caller's own messages.
        var hall4 = SeedHall(context, "MineOnly", isDeleted: false);
        var mineOnly = SeedConversation(context, hall4.Id, "owner-1", "seeker-1");
        SeedMessage(context, mineOnly.Id, "seeker-1", "my only message", t0);

        // 5. A hidden thread holding an unread incoming message: the user asked not to
        //    see it, so neither the row nor the badge may advertise it.
        var hall5 = SeedHall(context, "Hidden", isDeleted: false);
        var hidden = SeedConversation(context, hall5.Id, "owner-1", "seeker-1");
        SeedMessage(context, hidden.Id, "owner-1", "unread but hidden", t0);
        context.ConversationReadStates.Add(new ConversationReadState
        {
            ConversationId = hidden.Id,
            UserId = "seeker-1",
            HiddenAt = t0.AddMinutes(1)
        });
        context.SaveChanges();

        // 6. A thread on a deleted hall: absent from the list and from the badge.
        var hall6 = SeedHall(context, "Deleted", isDeleted: true);
        var deleted = SeedConversation(context, hall6.Id, "owner-1", "seeker-1");
        SeedMessage(context, deleted.Id, "owner-1", "unread on a deleted hall", t0);

        var inbox = await repository.GetParticipantConversationsAsync("seeker-1");
        var flags = await repository.GetUnreadStatusAsync("seeker-1", inbox.Select(c => c.Id).ToList());
        var count = await repository.GetUnreadConversationCountAsync("seeker-1", isAdmin: false);

        // The expected answer, stated per branch so a failure names the branch.
        Assert.True(flags[unread.Id]);
        Assert.False(flags[read.Id]);
        Assert.False(flags[replied.Id]);
        Assert.False(flags[mineOnly.Id]);
        Assert.DoesNotContain(inbox, c => c.Id == hidden.Id);
        Assert.DoesNotContain(inbox, c => c.Id == deleted.Id);

        var unreadRows = flags.Count(flag => flag.Value);

        Assert.Equal(1, unreadRows);
        Assert.Equal(unreadRows, count);
    }

    /// <summary>
    /// The same property from the other direction, with the caller in the HALL OWNER
    /// role rather than the seeker role, because the two roles are read out of different
    /// columns of the conversation row (SenderUserId vs HallOwnerId) and a participant
    /// filter written for one can silently miss the other.
    /// </summary>
    [Fact]
    public async Task UnreadCount_EqualsTheNumberOfInboxRowsReportedUnread_ForTheHallOwner()
    {
        await using var context = CreateContext();
        var repository = new ConversationRepository(context);

        var t0 = DateTimeOffset.UtcNow.AddHours(-2);

        var hall1 = SeedHall(context, "Unread", isDeleted: false);
        var unread = SeedConversation(context, hall1.Id, "seeker-1", "owner-1");
        SeedMessage(context, unread.Id, "seeker-1", "question about the hall", t0);

        var hall2 = SeedHall(context, "Read", isDeleted: false);
        var read = SeedConversation(context, hall2.Id, "seeker-1", "owner-1");
        SeedMessage(context, read.Id, "seeker-1", "seen already", t0);
        context.ConversationReadStates.Add(new ConversationReadState
        {
            ConversationId = read.Id,
            UserId = "owner-1",
            LastReadAt = t0.AddMinutes(1)
        });
        context.SaveChanges();

        var inbox = await repository.GetParticipantConversationsAsync("owner-1");
        var flags = await repository.GetUnreadStatusAsync("owner-1", inbox.Select(c => c.Id).ToList());
        var count = await repository.GetUnreadConversationCountAsync("owner-1", isAdmin: false);

        Assert.Equal(2, inbox.Count);
        Assert.True(flags[unread.Id]);
        Assert.False(flags[read.Id]);
        Assert.Equal(flags.Count(flag => flag.Value), count);
    }

    /// <summary>
    /// A conversation with no messages at all is not unread. It is reachable: a
    /// ContactAdmin thread is created before the first message is ever posted.
    /// </summary>
    [Fact]
    public async Task AnEmptyThreadIsNeitherListedAsUnreadNorCounted()
    {
        await using var context = CreateContext();
        var repository = new ConversationRepository(context);

        var hall = SeedHall(context, "Empty", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, "seeker-1", "owner-1");

        var flags = await repository.GetUnreadStatusAsync("owner-1", [conversation.Id]);

        Assert.False(flags[conversation.Id]);
        Assert.Equal(0, await repository.GetUnreadConversationCountAsync("owner-1", isAdmin: false));
    }

    /// <summary>
    /// The count is per participant. The other party's unread state must not leak into
    /// it: one shared query over the conversation row would count a thread unread for
    /// both sides, which is how a user ends up with a badge they cannot clear.
    /// </summary>
    [Fact]
    public async Task UnreadCount_IsScopedToTheAskingParticipant()
    {
        await using var context = CreateContext();
        var repository = new ConversationRepository(context);

        var t0 = DateTimeOffset.UtcNow.AddHours(-2);

        var hall = SeedHall(context, "Hall", isDeleted: false);
        var conversation = SeedConversation(context, hall.Id, "seeker-1", "owner-1");
        SeedMessage(context, conversation.Id, "seeker-1", "unread for the owner", t0);

        // The owner has read it; the seeker's own message therefore leaves them nothing
        // unread even though the conversation exists for both of them.
        context.ConversationReadStates.Add(new ConversationReadState
        {
            ConversationId = conversation.Id,
            UserId = "owner-1",
            LastReadAt = t0.AddMinutes(1)
        });
        context.SaveChanges();

        Assert.Equal(0, await repository.GetUnreadConversationCountAsync("owner-1", isAdmin: false));
        Assert.Equal(0, await repository.GetUnreadConversationCountAsync("seeker-1", isAdmin: false));
    }

    /// <summary>
    /// Edit 14, the badge half of the lock. The inbox list drops a conversation its owner is
    /// locked out of; if the count did not, the badge would advertise a thread that is not in
    /// the list and cannot be opened, and could never be cleared by reading anything.
    ///
    /// This is the same rule the list applies, asserted on the query that feeds the badge.
    /// </summary>
    [Fact]
    public async Task UnreadCount_ExcludesAThreadItsOwnerIsLockedOutOf()
    {
        await using var context = CreateContext();
        var repository = new ConversationRepository(context);

        var t0 = DateTimeOffset.UtcNow.AddHours(-2);

        var adminLocked = SeedHall(context, "AdminLocked", isDeleted: false, status: HallStatus.Approved);
        adminLocked.IsAdminLocked = true;
        var lockedThread = SeedConversation(context, adminLocked.Id, "seeker-1", "owner-1");
        SeedMessage(context, lockedThread.Id, "seeker-1", "still waiting for an answer", t0);

        var systemLocked = SeedHall(context, "SystemLocked", isDeleted: false, status: HallStatus.Approved);
        systemLocked.SystemLocked = true;
        var systemThread = SeedConversation(context, systemLocked.Id, "seeker-1", "owner-1");
        SeedMessage(context, systemThread.Id, "seeker-1", "any news?", t0);

        var paid = SeedHall(context, "Paid", isDeleted: false, status: HallStatus.Approved);
        paid.PaymentStatus = HallPaymentStatus.Paid;
        var openThread = SeedConversation(context, paid.Id, "seeker-1", "owner-1");
        SeedMessage(context, openThread.Id, "seeker-1", "unread but not locked", t0);

        context.SaveChanges();

        // Only the open thread counts, despite three unread conversations existing.
        Assert.Equal(1, await repository.GetUnreadConversationCountAsync("owner-1", isAdmin: false));
    }

    /// <summary>
    /// The converse of Edit 4's carve-out, on the badge: an Approved but UNPAID hall is not
    /// locked, so the owner keeps the count for their payment thread. The gate's payment
    /// requirement must never be added back to the count filter, or the owner loses the badge
    /// that tells them the Admin is waiting on them.
    /// </summary>
    [Fact]
    public async Task UnreadCount_KeepsTheUnreadThreadOfAnUnpaidButUnlockedHall()
    {
        await using var context = CreateContext();
        var repository = new ConversationRepository(context);

        var t0 = DateTimeOffset.UtcNow.AddHours(-2);

        var unpaid = SeedHall(context, "Unpaid", isDeleted: false, status: HallStatus.Approved);
        unpaid.PaymentStatus = HallPaymentStatus.Unpaid;
        var thread = SeedConversation(context, unpaid.Id, "seeker-1", "owner-1");
        SeedMessage(context, thread.Id, "seeker-1", "please confirm payment", t0);

        Assert.Equal(1, await repository.GetUnreadConversationCountAsync("owner-1", isAdmin: false));
    }

    /// <summary>
    /// An Admin is never blocked by this gate, so a hall owner who also holds the Admin role
    /// keeps the count for a thread they would otherwise be locked out of. Admins reach
    /// conversations they are not a party to through the by-id endpoints, not the inbox, so
    /// this is the only shape the exemption can take in this query.
    /// </summary>
    [Fact]
    public async Task UnreadCount_KeepsLockedThreadsForAnAdminWhoIsAlsoTheThreadOwner()
    {
        await using var context = CreateContext();
        var repository = new ConversationRepository(context);

        var t0 = DateTimeOffset.UtcNow.AddHours(-2);

        var locked = SeedHall(context, "Locked", isDeleted: false, status: HallStatus.Approved);
        locked.IsAdminLocked = true;
        var thread = SeedConversation(context, locked.Id, "seeker-1", "owner-1");
        SeedMessage(context, thread.Id, "seeker-1", "unread for the admin", t0);

        // The same conversation, counted as a plain owner and as an Admin.
        Assert.Equal(0, await repository.GetUnreadConversationCountAsync("owner-1", isAdmin: false));
        Assert.Equal(1, await repository.GetUnreadConversationCountAsync("owner-1", isAdmin: true));
    }

    /// <summary>
    /// A non-Approved hall thread stays counted for its owner, because the owner must keep
    /// seeing review and rejection messages (US-ADMIN-03) even though the hall is not live.
    /// </summary>
    [Fact]
    public async Task UnreadCount_KeepsPendingReviewThreadsForTheirOwner()
    {
        await using var context = CreateContext();
        var repository = new ConversationRepository(context);

        var t0 = DateTimeOffset.UtcNow.AddHours(-2);

        var pending = SeedHall(context, "Pending", isDeleted: false, status: HallStatus.PendingReview);
        pending.IsAdminLocked = true;
        var thread = SeedConversation(context, pending.Id, "seeker-1", "owner-1");
        SeedMessage(context, thread.Id, "seeker-1", "your hall needs changes", t0);

        Assert.Equal(1, await repository.GetUnreadConversationCountAsync("owner-1", isAdmin: false));
    }

    /// <summary>
    /// Edit 14 added a per-conversation NUMERIC unread count beside the boolean flag, so a
    /// client can render "3" rather than only a dot. Two independent implementations of one
    /// rule drift, exactly as the boolean and the badge did before, so the property worth
    /// pinning is that the two views of the same rule can never disagree: a row is flagged
    /// unread if and only if its count is greater than zero, for every row, in a scenario
    /// that mixes every branch at once.
    /// </summary>
    [Fact]
    public async Task UnreadMessageCount_IsZeroExactlyWhenTheRowIsNotFlaggedUnread()
    {
        await using var context = CreateContext();
        var repository = new ConversationRepository(context);

        var t0 = DateTimeOffset.UtcNow.AddHours(-2);

        // 1. Three unread incoming messages: the count must be 3, not 1 and not 0.
        var hallA = SeedHall(context, "ThreeUnread", isDeleted: false);
        var three = SeedConversation(context, hallA.Id, "owner-1", "seeker-1");
        SeedMessage(context, three.Id, "owner-1", "one", t0);
        SeedMessage(context, three.Id, "owner-1", "two", t0.AddMinutes(1));
        SeedMessage(context, three.Id, "owner-1", "three", t0.AddMinutes(2));

        // 2. Fully read.
        var hallB = SeedHall(context, "AllRead", isDeleted: false);
        var allRead = SeedConversation(context, hallB.Id, "owner-1", "seeker-1");
        SeedMessage(context, allRead.Id, "owner-1", "seen", t0);
        context.ConversationReadStates.Add(new ConversationReadState
        {
            ConversationId = allRead.Id,
            UserId = "seeker-1",
            LastReadAt = t0.AddMinutes(1)
        });
        context.SaveChanges();

        // 3. Partially read: one message before the watermark, one after it. This is the case
        //    a boolean cannot express and the whole reason the number exists.
        var hallC = SeedHall(context, "PartlyRead", isDeleted: false);
        var partly = SeedConversation(context, hallC.Id, "owner-1", "seeker-1");
        SeedMessage(context, partly.Id, "owner-1", "already read", t0);
        SeedMessage(context, partly.Id, "owner-1", "still unread", t0.AddMinutes(5));
        context.ConversationReadStates.Add(new ConversationReadState
        {
            ConversationId = partly.Id,
            UserId = "seeker-1",
            LastReadAt = t0.AddMinutes(1)
        });
        context.SaveChanges();

        // 4. Only the caller's own messages: nothing arrived from the other party.
        var hallD = SeedHall(context, "OwnMessages", isDeleted: false);
        var own = SeedConversation(context, hallD.Id, "owner-1", "seeker-1");
        SeedMessage(context, own.Id, "seeker-1", "my own message", t0);

        // 5. Hidden while an unread message is still inside it: not advertised at all.
        var hallE = SeedHall(context, "HiddenUnread", isDeleted: false);
        var hidden = SeedConversation(context, hallE.Id, "owner-1", "seeker-1");
        SeedMessage(context, hidden.Id, "owner-1", "unread but hidden", t0);
        context.ConversationReadStates.Add(new ConversationReadState
        {
            ConversationId = hidden.Id,
            UserId = "seeker-1",
            HiddenAt = t0.AddMinutes(1)
        });
        context.SaveChanges();

        var inbox = await repository.GetParticipantConversationsAsync("seeker-1");
        var ids = inbox.Select(c => c.Id).ToList();
        var flags = await repository.GetUnreadStatusAsync("seeker-1", ids);
        var counts = await repository.GetUnreadMessageCountsAsync("seeker-1", ids);

        // Every row the list returned is present in both views, so nothing is silently absent.
        Assert.Equal(ids.Count, flags.Count);
        Assert.Equal(ids.Count, counts.Count);

        Assert.Equal(3, counts[three.Id]);
        Assert.Equal(0, counts[allRead.Id]);
        Assert.Equal(1, counts[partly.Id]);
        Assert.Equal(0, counts[own.Id]);

        // The invariant, asserted per row so a failure names the row that drifted.
        foreach (var id in ids)
        {
            Assert.Equal(flags[id], counts[id] > 0);
        }

        // A hidden thread is absent from the list, so it cannot advertise a number either.
        Assert.DoesNotContain(inbox, c => c.Id == hidden.Id);
    }

    /// <summary>
    /// The same invariant from the Admin side of a SHARED inbox: read state is per-user even
    /// though every Admin sees the same thread, so two Admins must legitimately get different
    /// numbers for one thread. A shared count would break that, so it is pinned explicitly.
    /// </summary>
    [Fact]
    public async Task UnreadMessageCount_StaysPerAdmin_EvenThoughTheInboxIsShared()
    {
        await using var context = CreateContext();
        var repository = new ConversationRepository(context);

        var t0 = DateTimeOffset.UtcNow.AddHours(-2);

        var hall = SeedHall(context, "Shared", isDeleted: false);
        var thread = SeedConversation(context, hall.Id, "owner-1", "admin-1");
        SeedMessage(context, thread.Id, "owner-1", "first", t0);
        SeedMessage(context, thread.Id, "owner-1", "second", t0.AddMinutes(1));
        SeedMessage(context, thread.Id, "owner-1", "third", t0.AddMinutes(2));

        // admin-1 has read all three; admin-2 has read none of them.
        context.ConversationReadStates.Add(new ConversationReadState
        {
            ConversationId = thread.Id,
            UserId = "admin-1",
            LastReadAt = t0.AddMinutes(3)
        });
        context.SaveChanges();

        var adminIds = new[] { "admin-1", "admin-2" };
        var ids = new[] { thread.Id };

        var readerCounts = await repository.GetUnreadMessageCountsAsync("admin-1", isAdmin: true, adminIds, ids);
        var otherCounts = await repository.GetUnreadMessageCountsAsync("admin-2", isAdmin: true, adminIds, ids);

        Assert.Equal(0, readerCounts[thread.Id]);
        Assert.Equal(3, otherCounts[thread.Id]);

        var readerFlags = await repository.GetUnreadStatusAsync("admin-1", isAdmin: true, adminIds, ids);
        var otherFlags = await repository.GetUnreadStatusAsync("admin-2", isAdmin: true, adminIds, ids);

        Assert.False(readerFlags[thread.Id]);
        Assert.True(otherFlags[thread.Id]);
    }

    private static Hall SeedHall(
        ApplicationDbContext context,
        string name,
        bool isDeleted,
        HallStatus status = HallStatus.Approved)
    {
        var hall = new Hall { Id = Guid.NewGuid(), Name = name, IsDeleted = isDeleted, Status = status };
        context.Halls.Add(hall);
        context.SaveChanges();
        return hall;
    }

    private static Conversation SeedConversation(
        ApplicationDbContext context,
        Guid hallId,
        string sender,
        string owner)
    {
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hallId,
            SenderUserId = sender,
            HallOwnerId = owner,
            CreatedAt = DateTimeOffset.UtcNow
        };
        context.Conversations.Add(conversation);
        context.SaveChanges();
        return conversation;
    }

    private static void SeedMessage(
        ApplicationDbContext context,
        Guid conversationId,
        string sender,
        string content,
        DateTimeOffset createdAt)
    {
        context.Messages.Add(new Message
        {
            Id = Guid.NewGuid(),
            ConversationId = conversationId,
            SenderUserId = sender,
            Content = content,
            CreatedAt = createdAt
        });
        context.SaveChanges();
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }
}
