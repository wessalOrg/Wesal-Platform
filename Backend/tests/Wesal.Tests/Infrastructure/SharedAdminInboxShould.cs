using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Admin;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Documents;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Time;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// WESAL-TASK-10, Edit 16: a shared Admin inbox for owner/Admin conversations.
/// <para>
/// A conversation stores its two parties in <c>SenderUserId</c> / <c>HallOwnerId</c> with no
/// type discriminator, so an owner/Admin thread came to "belong" to whichever single Admin
/// created it. Production has five Admin accounts: eleven owner/Admin threads were split 6 / 3
/// / 2 across three of them and two Admins could see nothing at all. Every test here runs
/// against the real repositories and a real in-memory database, with real Identity role rows,
/// because the behaviour is a query filter and a hand-fake would simply re-implement it —
/// which is how the previous "admin-only" inbox could look correct in a test and still be
/// wrong in production.
/// </para>
/// <para>
/// The boundary that must not move is the seeker/owner thread. A whole closing section pins
/// that, because "make the admin side shared" and "make everything shared" are one small
/// mistake apart.
/// </para>
/// </summary>
public class SharedAdminInboxShould : IDisposable
{
    private const string OwnerId = "owner-1";
    private const string AdminOne = "admin-one";
    private const string AdminTwo = "admin-two";
    private const string AdminThree = "admin-three";
    private const string SeekerOne = "seeker-1";
    private const string SeekerTwo = "seeker-2";
    private const string OtherOwner = "owner-2";

    private readonly ApplicationDbContext _context = CreateContext();

    public SharedAdminInboxShould() => SeedAdminRole(AdminOne, AdminTwo, AdminThree);

    public void Dispose() => _context.Dispose();

    // =====================================================================
    // Discoverability
    // =====================================================================

    /// <summary>
    /// The core requirement: an owner writes in the thread that happens to be filed under one
    /// Admin, and every Admin sees it. Before this, only that one Admin did — two of the five
    /// production Admins saw nothing at all.
    /// </summary>
    [Fact]
    public async Task AnOwnersMessage_AppearsInTheInboxOfEveryAdmin()
    {
        var seed = SeedOwnerAdminThread(sender: AdminOne);
        SeedMessage(seed.ConversationId, OwnerId, "here is my payment proof");

        foreach (var admin in new[] { AdminOne, AdminTwo, AdminThree })
        {
            var inbox = await InboxFor(admin);

            Assert.Contains(inbox, c => c.ConversationId == seed.ConversationId);
        }
    }

    /// <summary>
    /// The regression this change was made for, stated as a negative: the Admin who never
    /// touched the thread still gets it. If this test ever needs the "expected" Admin id
    /// changed to make it pass, the feature has quietly reverted to single-Admin ownership.
    /// </summary>
    [Fact]
    public async Task AnAdmin_WhoNeverTouchedTheThread_StillSeesIt()
    {
        var seed = SeedOwnerAdminThread(sender: AdminOne);
        SeedMessage(seed.ConversationId, OwnerId, "did you get my proof?");

        var unrelated = await InboxFor(AdminTwo);

        Assert.Contains(unrelated, c => c.ConversationId == seed.ConversationId);
    }

    /// <summary>
    /// Additivity. An Admin must never see FEWER threads than they did before this change, so
    /// their own threads and a conversation about a hall they own are asserted alongside the
    /// newly shared ones.
    /// </summary>
    [Fact]
    public async Task AnAdmin_StillSeesTheirOwnThreadsAndTheHallsTheyOwn()
    {
        var own = SeedOwnerAdminThread(sender: AdminTwo);
        var owned = SeedThread(HallFor(AdminTwo), sender: SeekerOne, hallOwnerId: AdminTwo);

        var inbox = await InboxFor(AdminTwo);

        Assert.Contains(inbox, c => c.ConversationId == own.ConversationId);
        Assert.Contains(inbox, c => c.ConversationId == owned.ConversationId);
    }

    /// <summary>
    /// A thread opened by the owner themselves names a single Admin (or the platform sentinel)
    /// as its counterparty, because no Admin is logged in on the owner's side. That thread is
    /// still shared, which is the "Contact Admin" flow the spec calls out by name.
    /// </summary>
    [Fact]
    public async Task AThreadTheOwnerOpenedThemselves_IsSharedWithEveryAdmin()
    {
        var seed = SeedOwnerAdminThread(sender: AdminOne);

        var ownerOpened = SeedThread(HallFor(), sender: PlatformSenders.AdminFallback, hallOwnerId: OwnerId);

        foreach (var admin in new[] { AdminOne, AdminTwo, AdminThree })
        {
            var inbox = await InboxFor(admin);

            Assert.Contains(inbox, c => c.ConversationId == seed.ConversationId);
            Assert.Contains(inbox, c => c.ConversationId == ownerOpened.ConversationId);
        }
    }

    /// <summary>
    /// Automated platform notices (subscription-expiry warning and lock) name the sentinel
    /// <c>system</c>, which holds no role. Without the sentinel branch these owner-facing
    /// threads would be classified as seeker threads and would reach no Admin's inbox at all —
    /// they are owner/Admin traffic that nobody was being shown.
    /// </summary>
    [Fact]
    public async Task AnAutomatedPlatformNotice_IsSharedWithEveryAdmin()
    {
        var notice = SeedThread(HallFor(), sender: PlatformSenders.System, hallOwnerId: OwnerId);

        foreach (var admin in new[] { AdminOne, AdminTwo, AdminThree })
        {
            var inbox = await InboxFor(admin);

            Assert.Contains(inbox, c => c.ConversationId == notice.ConversationId);
        }
    }

    /// <summary>
    /// The §7.3 case, pinned deliberately rather than left to chance: an Admin who uses the
    /// ordinary "contact this hall's owner" seeker feature has a thread whose counterparty is an
    /// Admin, so it classifies as Admin-side and is shared. Confirmed as acceptable product
    /// behaviour — an Admin contacting a hall owner IS an admin-side interaction. This test
    /// exists so that if it ever changes, it changes on purpose.
    /// </summary>
    [Fact]
    public async Task AnAdminsOwnSeekerThread_ToAHallOwner_ClassifiesAsAdminSideAndIsShared()
    {
        var adminAsSeeker = SeedThread(HallFor(), sender: AdminOne, hallOwnerId: OwnerId);

        Assert.True(ConversationAccess.IsAdminThread(
            await _context.Conversations.AsNoTracking().FirstAsync(c => c.Id == adminAsSeeker.ConversationId),
            [AdminOne, AdminTwo]));

        var otherAdminsInbox = await InboxFor(AdminTwo);

        Assert.Contains(otherAdminsInbox, c => c.ConversationId == adminAsSeeker.ConversationId);
    }

    // =====================================================================
    // The OtherParticipantId defect
    // =====================================================================

    /// <summary>
    /// Edit 16 found that a shared inbox would show the wrong counterparty on every row. The
    /// old rule answered "who is the stored sender?" and, for an Admin who is not the stored
    /// sender, that is a COLLEAGUE — the same person as the viewer, and never the owner. The
    /// row has to name the owner the Admin is actually talking to.
    /// </summary>
    [Fact]
    public async Task AnAdminsRowNamesTheOwner_NotTheColleagueItIsFiledUnder()
    {
        var seed = SeedOwnerAdminThread(sender: AdminOne);
        SeedMessage(seed.ConversationId, OwnerId, "my proof is attached");
        SeedUser(OwnerId, "Nadia Owner");

        var inbox = await InboxFor(AdminTwo);

        var row = Assert.Single(inbox, c => c.ConversationId == seed.ConversationId);

        Assert.Equal(OwnerId, row.OtherParticipantId);
        Assert.Equal("Nadia Owner", row.OtherParticipantName);
    }

    /// <summary>
    /// The same row seen by the Admin the thread is actually filed under must agree, or the
    /// two Admins would be shown different counterparties for one conversation.
    /// </summary>
    [Fact]
    public async Task TheFiledAdminAndAnotherAdminSeeTheSameCounterparty()
    {
        var seed = SeedOwnerAdminThread(sender: AdminOne);
        SeedMessage(seed.ConversationId, OwnerId, "my proof is attached");
        SeedUser(OwnerId, "Nadia Owner");

        var filed = Assert.Single(await InboxFor(AdminOne), c => c.ConversationId == seed.ConversationId);
        var other = Assert.Single(await InboxFor(AdminTwo), c => c.ConversationId == seed.ConversationId);

        Assert.Equal(filed.OtherParticipantId, other.OtherParticipantId);
        Assert.Equal(filed.OtherParticipantName, other.OtherParticipantName);
    }

    // =====================================================================
    // Unread semantics: Option B, personal per-Admin read state
    // =====================================================================

    /// <summary>
    /// The confirmed design, pinned: the inbox is shared but read state is PERSONAL, so one
    /// thread is legitimately read for one Admin and unread for another at the same moment.
    /// This is the opposite of a team queue, where the first reader would clear it for
    /// everybody and the owner's outstanding payment proof would stop being visible to
    /// everyone else.
    /// </summary>
    [Fact]
    public async Task ReadStateIsPersonal_EachAdminTracksTheirOwnProgressOnTheSameThread()
    {
        var seed = SeedOwnerAdminThread(sender: AdminOne);
        SeedMessage(seed.ConversationId, OwnerId, "payment proof attached");

        // Only AdminOne has opened the thread.
        await MarkRead(seed.ConversationId, AdminOne);

        // The moment that makes it PERSONAL: the same conversation is read for one Admin and
        // unread for the others. A team watermark would show all three as read here.
        Assert.False(await IsUnread(AdminOne, seed.ConversationId));
        Assert.True(await IsUnread(AdminTwo, seed.ConversationId));
        Assert.True(await IsUnread(AdminThree, seed.ConversationId));
    }

    /// <summary>
    /// Two Admins reading the same shared thread must not interfere. Under a shared watermark
    /// the second reader's action would be a no-op and the first would have silenced the thread
    /// for the rest of the team.
    /// </summary>
    [Fact]
    public async Task OneAdminsReadingTheThread_DoesNotMarkItReadForTheOthers()
    {
        var seed = SeedOwnerAdminThread(sender: AdminOne);
        SeedMessage(seed.ConversationId, OwnerId, "payment proof attached");

        await MarkRead(seed.ConversationId, AdminOne);
        await MarkRead(seed.ConversationId, AdminTwo);

        var first = Assert.Single(await InboxFor(AdminOne), c => c.ConversationId == seed.ConversationId);
        var second = Assert.Single(await InboxFor(AdminTwo), c => c.ConversationId == seed.ConversationId);

        Assert.False(first.IsUnread);
        Assert.False(second.IsUnread);

        // A third Admin, who has read nothing, still has it outstanding.
        var third = Assert.Single(await InboxFor(AdminThree), c => c.ConversationId == seed.ConversationId);

        Assert.True(third.IsUnread);
    }

    /// <summary>
    /// The badge must agree with the rows, for every Admin, or an Admin cannot trust their own
    /// notification count. Edit 14 pinned this for the two-party case; the shared inbox has to
    /// keep the same invariant.
    /// </summary>
    [Fact]
    public async Task TheBadgeEqualsTheUnreadRowCount_ForEveryAdmin()
    {
        var a = SeedOwnerAdminThread(sender: AdminOne);
        var b = SeedOwnerAdminThread(sender: AdminTwo);

        SeedMessage(a.ConversationId, OwnerId, "proof for hall A");
        SeedMessage(b.ConversationId, OwnerId, "proof for hall B");

        await MarkRead(a.ConversationId, AdminTwo);

        // AdminOne has read nothing -> both outstanding.
        Assert.Equal(2, await BadgeFor(AdminOne));

        // AdminTwo read A only -> A cleared, B still outstanding.
        Assert.Equal(1, await BadgeFor(AdminTwo));

        // AdminThree has read neither, and neither has anything to do with them by id.
        Assert.Equal(2, await BadgeFor(AdminThree));
    }

    /// <summary>
    /// "The other party" for an Admin is the OWNER, not "anybody who is not me". Nineteen of
    /// the twenty messages in production are Admin-to-Admin, so if a colleague's reply counted
    /// as incoming then every Admin's badge would be lit permanently by their own colleagues
    /// and would carry no information about the owner waiting for an answer.
    /// </summary>
    [Fact]
    public async Task AColleaguesReplyDoesNotMakeTheThreadUnread_ForAnyAdmin()
    {
        var seed = SeedOwnerAdminThread(sender: AdminOne);

        // The owner asks a question, and every Admin reads it, clearing the badge.
        SeedMessage(seed.ConversationId, OwnerId, "payment proof attached");

        await MarkRead(seed.ConversationId, AdminOne);
        await MarkRead(seed.ConversationId, AdminTwo);
        await MarkRead(seed.ConversationId, AdminThree);

        Assert.Equal(0, await BadgeFor(AdminOne));

        // Colleagues then talk among themselves twice. Nineteen of the twenty messages in
        // production are exactly this, and if a colleague counted as "incoming" every Admin's
        // badge would be permanently lit and would say nothing about the owner waiting.
        SeedMessage(seed.ConversationId, AdminTwo, "checking it now, thanks");
        SeedMessage(seed.ConversationId, AdminThree, "looks fine to me");

        foreach (var admin in new[] { AdminOne, AdminTwo, AdminThree })
        {
            var row = Assert.Single(await InboxFor(admin), c => c.ConversationId == seed.ConversationId);

            Assert.False(row.IsUnread);
        }

        Assert.Equal(0, await BadgeFor(AdminOne));
        Assert.Equal(0, await BadgeFor(AdminTwo));
        Assert.Equal(0, await BadgeFor(AdminThree));
    }

    /// <summary>
    /// The owner's own new message is the event that must light every Admin's badge, which is
    /// the whole reason the sharing exists.
    /// </summary>
    [Fact]
    public async Task ANewOwnerMessageLightsEveryAdminsBadge()
    {
        var seed = SeedOwnerAdminThread(sender: AdminOne);
        SeedMessage(seed.ConversationId, OwnerId, "first question");

        await MarkRead(seed.ConversationId, AdminOne);
        await MarkRead(seed.ConversationId, AdminTwo);
        await MarkRead(seed.ConversationId, AdminThree);

        Assert.Equal(0, await BadgeFor(AdminOne));
        Assert.Equal(0, await BadgeFor(AdminTwo));

        SeedMessage(seed.ConversationId, OwnerId, "second question, are you there?");

        Assert.Equal(1, await BadgeFor(AdminOne));
        Assert.Equal(1, await BadgeFor(AdminTwo));
        Assert.Equal(1, await BadgeFor(AdminThree));
    }

    /// <summary>
    /// Read state is personal, so hiding is too: it is "my view of the queue". One Admin
    /// archiving a thread must not remove it from a colleague's inbox.
    /// </summary>
    [Fact]
    public async Task HidingIsPersonal_OneAdminsArchiveDoesNotTouchAnotherAdminsInbox()
    {
        var seed = SeedOwnerAdminThread(sender: AdminOne);
        SeedMessage(seed.ConversationId, OwnerId, "payment proof attached");

        await Hide(seed.ConversationId, AdminTwo);

        Assert.DoesNotContain(await InboxFor(AdminTwo), c => c.ConversationId == seed.ConversationId);
        Assert.Contains(await InboxFor(AdminOne), c => c.ConversationId == seed.ConversationId);
        Assert.Contains(await InboxFor(AdminThree), c => c.ConversationId == seed.ConversationId);

        // And the badge follows the same caller's own visibility, as Edit 14 established.
        Assert.Equal(0, await BadgeFor(AdminTwo));
        Assert.Equal(1, await BadgeFor(AdminOne));
    }

    // =====================================================================
    // Replying
    // =====================================================================

    /// <summary>
    /// Any Admin can answer, and the answer is part of the one shared thread — so the colleague
    /// who is next in the queue and the owner both see it, and the reply does not fork a second
    /// conversation for that Admin.
    /// </summary>
    [Fact]
    public async Task AnyAdminCanReply_AndTheReplyIsVisibleToTheOtherAdminsAndTheOwner()
    {
        var seed = SeedOwnerAdminThread(sender: AdminOne);

        var reply = await CreateService(AdminTwo, [ApplicationRoles.Admin])
            .SendMessageAsync(seed.ConversationId, new SendMessageRequest { Content = "payment received, thank you" });

        // Same single thread: no duplicate was created for the second Admin.
        Assert.Equal(seed.ConversationId, reply.ConversationId);
        Assert.Single(await _context.Conversations.ToListAsync());

        var colleagueView = await CreateService(AdminThree, [ApplicationRoles.Admin])
            .GetConversationThreadAsync(seed.ConversationId);

        Assert.Contains(colleagueView.Messages, m => m.Content == "payment received, thank you");

        var ownerView = await CreateService(OwnerId, [ApplicationRoles.HallOwner])
            .GetConversationThreadAsync(seed.ConversationId);

        Assert.Contains(ownerView.Messages, m => m.Content == "payment received, thank you");
    }

    /// <summary>
    /// A reply from any Admin is immediately visible in every Admin's inbox row for that
    /// thread, which is what makes the queue a queue.
    /// </summary>
    [Fact]
    public async Task AnAdminsReplyAppearsInEveryAdminsInboxRow()
    {
        var seed = SeedOwnerAdminThread(sender: AdminOne);

        await CreateService(AdminTwo, [ApplicationRoles.Admin])
            .SendMessageAsync(seed.ConversationId, new SendMessageRequest { Content = "handled it" });

        foreach (var admin in new[] { AdminOne, AdminTwo, AdminThree })
        {
            var row = Assert.Single(await InboxFor(admin), c => c.ConversationId == seed.ConversationId);

            Assert.Equal("handled it", row.LastMessagePreview);
        }
    }

    // =====================================================================
    // The seam: seeker/owner conversations must be completely unaffected
    // =====================================================================

    /// <summary>
    /// THE critical boundary. A seeker's conversation with a specific hall owner belongs to
    /// those two people. It must not be pulled into the shared Admin queue by anything in this
    /// change.
    /// </summary>
    [Fact]
    public async Task ASeekerOwnerConversation_DoesNotAppearInAnyAdminsInbox()
    {
        var seed = SeedThread(HallFor(), sender: SeekerOne, hallOwnerId: OwnerId);
        SeedMessage(seed.ConversationId, SeekerOne, "is this hall available?");

        foreach (var admin in new[] { AdminOne, AdminTwo, AdminThree })
        {
            var inbox = await InboxFor(admin);

            Assert.DoesNotContain(inbox, c => c.ConversationId == seed.ConversationId);
        }
    }

    /// <summary>
    /// A seeker must not gain visibility of ANOTHER seeker's conversation with the same owner —
    /// the "shared inbox" is for the admin side only, never for seekers.
    /// </summary>
    [Fact]
    public async Task ASeekerDoesNotSeeAnotherSeekersConversationWithTheSameOwner()
    {
        var first = SeedThread(HallFor(), sender: SeekerOne, hallOwnerId: OwnerId);
        SeedMessage(first.ConversationId, SeekerOne, "mine, about dates");

        var secondSeekersInbox = await InboxFor(SeekerTwo, [ApplicationRoles.RegisteredUser]);

        Assert.DoesNotContain(secondSeekersInbox, c => c.ConversationId == first.ConversationId);
    }

    /// <summary>
    /// Nor does one hall owner see another hall owner's seeker traffic. The owner clause is
    /// keyed on the thread's own HallOwnerId, so this has to be asserted rather than assumed.
    /// </summary>
    [Fact]
    public async Task ASecondHallOwnerDoesNotSeeTheFirstHallsSeekerTraffic()
    {
        var first = SeedThread(HallFor(), sender: SeekerOne, hallOwnerId: OwnerId);
        SeedMessage(first.ConversationId, SeekerOne, "about this hall");

        var otherOwnerInbox = await InboxFor(OtherOwner, [ApplicationRoles.HallOwner]);

        Assert.DoesNotContain(otherOwnerInbox, c => c.ConversationId == first.ConversationId);
    }

    /// <summary>
    /// A seeker's unread rule is untouched: their own words never make the thread unread, and
    /// the owner's reply does.
    /// </summary>
    [Fact]
    public async Task ASeekersUnreadRuleIsUnchanged()
    {
        var thread = SeedThread(HallFor(), sender: SeekerOne, hallOwnerId: OwnerId);

        SeedMessage(thread.ConversationId, SeekerOne, "is this hall available?");

        Assert.Equal(0, await BadgeFor(SeekerOne, [ApplicationRoles.RegisteredUser]));

        SeedMessage(thread.ConversationId, OwnerId, "yes, for 200 guests");

        Assert.Equal(1, await BadgeFor(SeekerOne, [ApplicationRoles.RegisteredUser]));

        await MarkRead(thread.ConversationId, SeekerOne, [ApplicationRoles.RegisteredUser]);

        Assert.Equal(0, await BadgeFor(SeekerOne, [ApplicationRoles.RegisteredUser]));
    }

    /// <summary>
    /// The counterparty rule for a seeker is also unchanged: they see the owner, which is what
    /// the two-party rule always produced.
    /// </summary>
    [Fact]
    public async Task ASeekersRowStillNamesTheHallOwner()
    {
        var thread = SeedThread(HallFor(), sender: SeekerOne, hallOwnerId: OwnerId);
        SeedMessage(thread.ConversationId, OwnerId, "yes, for 200 guests");
        SeedUser(OwnerId, "Nadia Owner");

        var row = Assert.Single(await InboxFor(SeekerOne, [ApplicationRoles.RegisteredUser]));

        Assert.Equal(OwnerId, row.OtherParticipantId);
        Assert.Equal("Nadia Owner", row.OtherParticipantName);
    }

    // =====================================================================
    // Lock consistency (Edit 10) must be untouched by any of this
    // =====================================================================

    /// <summary>
    /// Edit 10's gate restricts the OWNER and never the Admin. Shared discoverability must not
    /// become a back door around it: the Admin still sees and can open the thread, and the
    /// locked owner still cannot.
    /// </summary>
    [Fact]
    public async Task ALockedOwnerIsStillBlockedWhileEveryAdminKeepsTheThread()
    {
        var hall = AddHall(OwnerId, HallStatus.Approved, isAdminLocked: true);
        var thread = SeedThread(hall.Id, sender: AdminOne, hallOwnerId: OwnerId);
        SeedMessage(thread.ConversationId, OwnerId, "why is my hall locked?");

        foreach (var admin in new[] { AdminOne, AdminTwo, AdminThree })
        {
            var inbox = await InboxFor(admin);

            Assert.Contains(inbox, c => c.ConversationId == thread.ConversationId);
        }

        var ownerInbox = await InboxFor(OwnerId, [ApplicationRoles.HallOwner]);

        Assert.DoesNotContain(ownerInbox, c => c.ConversationId == thread.ConversationId);
        Assert.Equal(0, await BadgeFor(OwnerId, [ApplicationRoles.HallOwner]));
    }

    /// <summary>
    /// The paid-but-locked and system-locked variants, because Edit 10's rule names both flags
    /// and a shared inbox must not quietly waive either.
    /// </summary>
    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task EitherLockFlagKeepsTheOwnerOut_AndEveryAdminIn(bool adminLocked, bool systemLocked)
    {
        var hall = AddHall(OwnerId, HallStatus.Approved, isAdminLocked: adminLocked, isSystemLocked: systemLocked);
        var thread = SeedThread(hall.Id, sender: AdminOne, hallOwnerId: OwnerId);
        SeedMessage(thread.ConversationId, OwnerId, "please explain");

        Assert.DoesNotContain(await InboxFor(OwnerId, [ApplicationRoles.HallOwner]), c => c.ConversationId == thread.ConversationId);
        Assert.Contains(await InboxFor(AdminTwo), c => c.ConversationId == thread.ConversationId);
    }

    /// <summary>
    /// Edit 4's unpaid carve-out still holds: an Approved-but-UNPAID, unlocked owner keeps their
    /// own payment thread, which is where the payment proof is sent. Sharing must not have
    /// tightened this.
    /// </summary>
    [Fact]
    public async Task AnUnpaidButUnlockedOwnerStillSeesTheirOwnPaymentThread()
    {
        var hall = AddHall(OwnerId, HallStatus.Approved, payment: HallPaymentStatus.Unpaid);
        var thread = SeedThread(hall.Id, sender: AdminOne, hallOwnerId: OwnerId);
        SeedMessage(thread.ConversationId, OwnerId, "proof attached");

        Assert.Contains(await InboxFor(OwnerId, [ApplicationRoles.HallOwner]), c => c.ConversationId == thread.ConversationId);
        Assert.Contains(await InboxFor(AdminTwo), c => c.ConversationId == thread.ConversationId);
    }

    // =====================================================================
    // The shipped admin flows participate
    // =====================================================================

    /// <summary>
    /// The owner's real "Contact Admin" write path, end to end. It is the one flow that mints
    /// an owner/Admin thread with no Admin in the room, and the one whose sentinel sender used
    /// to make the thread unreachable from an Admin's inbox. It must land in every Admin's queue
    /// at the moment it is created.
    /// </summary>
    [Fact]
    public async Task ContactAdminFromTheOwner_ReachesEveryAdminsInboxImmediately()
    {
        var hall = AddHall(OwnerId, HallStatus.Approved, payment: HallPaymentStatus.Unpaid);

        var created = await CreateService(OwnerId, [ApplicationRoles.HallOwner])
            .ContactAdminAsync(hall.Id);

        foreach (var admin in new[] { AdminOne, AdminTwo, AdminThree })
        {
            var row = Assert.Single(await InboxFor(admin), c => c.ConversationId == created.ConversationId);

            // And the counterparty is the owner who contacted them, not the sentinel.
            Assert.Equal(OwnerId, row.OtherParticipantId);
        }

        // Pressing it a second time must converge on the same thread rather than forking one
        // conversation per Admin — the deterministic key this system already relies on.
        var again = await CreateService(OwnerId, [ApplicationRoles.HallOwner])
            .ContactAdminAsync(hall.Id);

        Assert.Equal(created.ConversationId, again.ConversationId);
        Assert.Single(await _context.Conversations.ToListAsync());
    }

    /// <summary>
    /// "Contact Admin" is the OWNER's button, so a seeker pressing it is refused. This is worth
    /// pinning as a boundary rather than leaving implicit: the thread that button mints is
    /// shared to the whole admin side precisely because only an owner can start it, and a seeker
    /// who could would silently inject themselves into every Admin's queue.
    /// </summary>
    [Fact]
    public async Task ContactAdminIsRefusedToASeeker_AndCreatesNoThreadAtAll()
    {
        var hall = AddHall(OwnerId, HallStatus.Approved, payment: HallPaymentStatus.Unpaid);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            CreateService(SeekerOne, [ApplicationRoles.RegisteredUser]).ContactAdminAsync(hall.Id));

        Assert.Empty(await _context.Conversations.ToListAsync());

        foreach (var admin in new[] { AdminOne, AdminTwo, AdminThree })
        {
            Assert.Empty(await InboxFor(admin));
        }
    }

    /// <summary>
    /// The full payment-notice loop, end to end and from the owner's side: the admin asks for
    /// payment, the owner replies with the proof image, and the proof is readable and visible
    /// to every Admin rather than to whichever one happened to be in the thread.
    /// </summary>
    [Fact]
    public async Task ThePaymentProofFlowIsVisibleToEveryAdmin()
    {
        var hall = AddHall(OwnerId, HallStatus.Approved, payment: HallPaymentStatus.Unpaid);
        var seed = SeedThread(hall.Id, sender: AdminOne, hallOwnerId: OwnerId);

        var sent = await CreateService(OwnerId, [ApplicationRoles.HallOwner])
            .SendAttachmentMessageAsync(
                seed.ConversationId,
                new MessageAttachmentUpload
                {
                    FileName = "proof.jpg",
                    ContentType = "image/jpeg",
                    Content = [0xFF, 0xD8, 0xFF, 0xE0]
                },
                "payment proof",
                null);

        foreach (var admin in new[] { AdminOne, AdminTwo, AdminThree })
        {
            var row = Assert.Single(await InboxFor(admin), c => c.ConversationId == seed.ConversationId);

            Assert.True(row.IsUnread);
            Assert.True(row.LastMessageHasAttachment);

            var document = await CreateService(admin, [ApplicationRoles.Admin])
                .GetMessageAttachmentAsync(seed.ConversationId, sent.MessageId);

            Assert.True(File.Exists(document.FullPath));
        }
    }

    /// <summary>
    /// Any Admin may mark the subscription paid, not only the one the thread happens to be filed
    /// under — the practical payoff of sharing the thread. Asserted on the hall, since that is
    /// where the payment state actually lives.
    /// </summary>
    [Fact]
    public async Task AnyAdminCanMarkTheSubscriptionPaid()
    {
        var hall = AddHall(OwnerId, HallStatus.Approved, payment: HallPaymentStatus.Unpaid);
        SeedThread(hall.Id, sender: AdminOne, hallOwnerId: OwnerId);

        // The Admin who owns the thread is deliberately NOT the one doing it.
        await AdminSubscriptionServiceFor(AdminTwo).MarkSubscriptionPaidAsync(hall.Id);

        await _context.Entry(hall).ReloadAsync();

        Assert.Equal(HallPaymentStatus.Paid, hall.PaymentStatus);
    }

    // =====================================================================
    // The classifier itself
    // =====================================================================

    [Theory]
    [InlineData("admin-one", true)]
    [InlineData("admin-two", true)]
    [InlineData(PlatformSenders.AdminFallback, true)]
    [InlineData(PlatformSenders.System, true)]
    [InlineData("seeker-1", false)]
    [InlineData("some-unrelated-user", false)]
    [InlineData("", false)]
    public void TheClassifierTreatsTheAdminRoleAndBothSentinelsAsAdminSide(
        string sender,
        bool expected)
    {
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = Guid.NewGuid(),
            SenderUserId = sender,
            HallOwnerId = OwnerId
        };

        Assert.Equal(expected, ConversationAccess.IsAdminThread(conversation, [AdminOne, AdminTwo, AdminThree]));
    }

    /// <summary>
    /// With no Admin account in existence at all, the sentinels are the only way an
    /// owner/Admin thread can still be recognised as one.
    /// </summary>
    [Fact]
    public void TheSentinelsStillClassifyWithNoAdminAccountsAtAll()
    {
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = Guid.NewGuid(),
            SenderUserId = PlatformSenders.System,
            HallOwnerId = OwnerId
        };

        Assert.True(ConversationAccess.IsAdminThread(conversation, []));
        Assert.True(ConversationAccess.IsAdminThread(conversation, null));
    }

    /// <summary>
    /// The stored <c>SenderUserId</c> and <c>HallOwnerId</c> literals are load-bearing: existing
    /// threads and new ones are classified by these exact values, so a silent rename would
    /// reclassify historical rows.
    /// </summary>
    [Fact]
    public void ThePlatformSenderValuesAreTheOnesTheServicesAlreadyWrite()
    {
        Assert.Equal("admin", PlatformSenders.AdminFallback);
        Assert.Equal("system", PlatformSenders.System);
        Assert.Equal(PlatformSenders.System, Wesal.Infrastructure.Admin.SubscriptionExpiryLockService.SystemSenderUserId);
    }

    // =====================================================================
    // Harness
    // =====================================================================

    /// <summary>
    /// Every conversation needs a hall that really exists, or the inbox query drops it. A hall
    /// id minted here without a matching row would make these tests pass or fail for the wrong
    /// reason, so a real one is always created.
    /// </summary>
    private Guid HallFor(string ownerId = OwnerId) => AddHall(ownerId).Id;

    private Seed SeedOwnerAdminThread(string sender, HallPaymentStatus payment = HallPaymentStatus.Paid)
    {
        var hall = AddHall(OwnerId, HallStatus.Approved, payment);
        return SeedThread(hall.Id, sender, OwnerId);
    }

    private Hall AddHall(
        string ownerId,
        HallStatus status = HallStatus.Approved,
        HallPaymentStatus payment = HallPaymentStatus.Paid,
        bool isAdminLocked = false,
        bool isSystemLocked = false)
    {
        var hall = new Hall
        {
            Id = Guid.NewGuid(),
            Name = "Test Hall",
            Status = status,
            PaymentStatus = payment,
            OwnerId = ownerId,
            Address = "Gaza",
            Region = HallRegion.Gaza,
            Capacity = 100,
            IsAdminLocked = isAdminLocked,
            SystemLocked = isSystemLocked
        };

        _context.Halls.Add(hall);
        _context.SaveChanges();

        return hall;
    }

    private Seed SeedThread(Guid hallId, string sender, string hallOwnerId)
    {
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hallId,
            SenderUserId = sender,
            HallOwnerId = hallOwnerId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _context.Conversations.Add(conversation);
        _context.SaveChanges();

        return new Seed(hallId, conversation.Id);
    }

    private void SeedMessage(Guid conversationId, string sender, string content)
    {
        _context.Messages.Add(new Message
        {
            Id = Guid.NewGuid(),
            ConversationId = conversationId,
            SenderUserId = sender,
            Content = content,
            CreatedAt = DateTimeOffset.UtcNow
        });
        _context.SaveChanges();
    }

    private void SeedUser(string userId, string fullName)
    {
        _context.Users.Add(new ApplicationUser
        {
            Id = userId,
            // The inbox row's OtherParticipantName is read from FullName, not UserName.
            FullName = fullName,
            UserName = fullName,
            NormalizedUserName = fullName.ToUpperInvariant(),
            Email = $"{userId}@example.com",
            NormalizedEmail = $"{userId}@EXAMPLE.COM"
        });
        _context.SaveChanges();
    }

    /// <summary>Seeds the real Identity role row so the repository's role lookup finds it.</summary>
    private void SeedAdminRole(params string[] adminUserIds)
    {
        _context.Roles.Add(new ApplicationRole
        {
            Id = "admin-role",
            Name = ApplicationRoles.Admin,
            NormalizedName = ApplicationRoles.Admin.ToUpperInvariant()
        });
        _context.SaveChanges();

        foreach (var adminUserId in adminUserIds)
        {
            _context.UserRoles.Add(new IdentityUserRole<string>
            {
                UserId = adminUserId,
                RoleId = "admin-role"
            });
        }

        _context.SaveChanges();
    }

    private async Task<IReadOnlyList<ConversationSummaryResponse>> InboxFor(
        string userId,
        IReadOnlyList<string>? roles = null)
    {
        roles ??= [ApplicationRoles.Admin];

        return await CreateService(userId, roles).GetMyConversationsAsync();
    }

    private async Task<int> BadgeFor(string userId, IReadOnlyList<string>? roles = null)
    {
        roles ??= [ApplicationRoles.Admin];

        return (await CreateService(userId, roles).GetUnreadCountAsync()).UnreadCount;
    }

    private async Task<bool> IsUnread(string adminUserId, Guid conversationId)
        => (await CreateService(adminUserId, [ApplicationRoles.Admin]).GetMyConversationsAsync())
            .Single(c => c.ConversationId == conversationId)
            .IsUnread;

    /// <summary>
    /// Marks read through the service, not the repository, so the shared access check runs too:
    /// an Admin marking somebody else's shared thread read is itself part of the feature.
    /// </summary>
    private Task MarkRead(Guid conversationId, string userId, IReadOnlyList<string>? roles = null)
        => CreateService(userId, roles ?? [ApplicationRoles.Admin]).MarkAsReadAsync(conversationId);

    private Task Hide(Guid conversationId, string userId, IReadOnlyList<string>? roles = null)
        => CreateService(userId, roles ?? [ApplicationRoles.Admin]).HideConversationAsync(conversationId);

    private ConversationService CreateService(string userId, IReadOnlyList<string> roles)
        => new(
            new ConversationRepository(_context),
            new MessageRepository(_context),
            new FakeBookingRejectionService(),
            new NoOpBookingAcceptanceService(),
            new HallRepository(_context),
            new FakeCurrentUserService(userId, roles),
            new RecordingConversationNotifier(),
            new TempDocumentStorage());

    /// <summary>
    /// The one Admin-side service that needs no <c>UserManager</c> faking, so the practical
    /// consequence of sharing — any colleague can clear the payment — is asserted for real.
    /// </summary>
    private AdminSubscriptionService AdminSubscriptionServiceFor(string adminUserId)
        => new(
            new AdminDashboardRepository(_context),
            new HallRepository(_context),
            Microsoft.Extensions.Options.Options.Create(new SubscriptionPaymentOptions()),
            new UnitOfWork(_context),
            new ConversationRepository(_context),
            new MessageRepository(_context),
            new RecordingConversationNotifier(),
            new FakeCurrentUserService(adminUserId, [ApplicationRoles.Admin]),
            new DateTimeService(),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<AdminSubscriptionService>.Instance,
            new FakeNotificationService());

    private sealed class FakeBookingRejectionService : IBookingRejectionService
    {
        public Task<RejectBookingResultDto> RejectBookingAsync(
            Guid hallId, Guid bookingId, RejectBookingRequestDto request, CancellationToken cancellationToken = default)
            => Task.FromResult(new RejectBookingResultDto());

        public Task<int> DeliverPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(0);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ApplicationDbContext(options);
    }

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        private readonly string? _userId;

        public FakeCurrentUserService(string? userId, IReadOnlyList<string> roles)
        {
            _userId = userId;
            Roles = roles;
        }

        public string? UserId => _userId;

        public string? UserName => "test";

        public string? Email => "test@example.com";

        public bool IsAuthenticated => _userId is not null;

        public IReadOnlyList<string> Roles { get; }
    }

    private sealed class TempDocumentStorage : IDocumentStorage
    {
        public string Root { get; } = Path.Combine(Path.GetTempPath(), "wesal-edit16-storage");

        public string OwnerDocumentsDirectory(string ownerId)
            => Path.Combine(Root, "documents", "owners", ownerId);

        public string ConversationAttachmentsDirectory(Guid conversationId)
            => Path.Combine(Root, "documents", "conversations", conversationId.ToString(), "attachments");
    }

    private sealed record Seed(Guid HallId, Guid ConversationId);
}
