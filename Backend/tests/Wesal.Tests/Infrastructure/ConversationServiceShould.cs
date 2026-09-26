using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Conversations;

using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

public class ConversationServiceShould
{
    /// <summary>
    /// WESAL-TASK-10, Edit 14. The inbox list is the one conversation surface that never ran
    /// the hall-messaging gate, so a locked owner was refused the thread, its messages, its
    /// read receipt and both send paths, and was still handed the row: hall name, the other
    /// party, the newest message's CONTENT, its attachment flag, the message count and an
    /// unread badge. The gate was enforced everywhere except the endpoint that previews it.
    ///
    /// This asserts the lock holds on the list. It should fail against the list as written.
    /// </summary>
    [Fact]
    public async Task GetMyConversations_LockedOwnerThread_IsNotAdvertisedInTheInbox()
    {
        var hall = CreateApprovedHall("Locked Hall", "owner-1");
        hall.IsAdminLocked = true;

        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            SenderUserId = "seeker-1",
            HallOwnerId = "owner-1",
            CreatedAt = DateTimeOffset.UtcNow
        };
        conversation.Hall = hall;

        var repository = new FakeConversationRepository();
        repository.Conversations.Add(conversation);
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        var inbox = await service.GetMyConversationsAsync();

        Assert.Empty(inbox);
    }

    /// <summary>
    /// The converse, so the fix cannot be "stop listing owner threads": a seeker is never
    /// blocked by this gate and must keep seeing their thread on the very same locked hall.
    /// </summary>
    [Fact]
    public async Task GetMyConversations_LockedHall_SeekerStillSeesTheirThread()
    {
        var hall = CreateApprovedHall("Locked Hall", "owner-1");
        hall.IsAdminLocked = true;

        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            SenderUserId = "seeker-1",
            HallOwnerId = "owner-1",
            CreatedAt = DateTimeOffset.UtcNow
        };
        conversation.Hall = hall;

        var repository = new FakeConversationRepository();
        repository.Conversations.Add(conversation);
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "seeker-1", roles: [ApplicationRoles.RegisteredUser]);

        var inbox = await service.GetMyConversationsAsync();

        Assert.Single(inbox);
        Assert.Equal(conversation.Id, inbox[0].ConversationId);
    }

    /// <summary>
    /// Edit 4's carve-out reaches the list too: an Approved but UNPAID hall is not locked,
    /// so the owner keeps their payment thread, and therefore the row that shows it.
    /// </summary>
    [Fact]
    public async Task GetMyConversations_UnpaidButUnlockedHall_OwnerStillSeesTheirThread()
    {
        var hall = CreateApprovedHall("Unpaid Hall", "owner-1");
        hall.PaymentStatus = HallPaymentStatus.Unpaid;

        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            SenderUserId = "seeker-1",
            HallOwnerId = "owner-1",
            CreatedAt = DateTimeOffset.UtcNow
        };
        conversation.Hall = hall;

        var repository = new FakeConversationRepository();
        repository.Conversations.Add(conversation);
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        var inbox = await service.GetMyConversationsAsync();

        Assert.Single(inbox);
        Assert.Equal(conversation.Id, inbox[0].ConversationId);
    }

    [Fact]
    public async Task CreateConversation_RegisteredUser_ReturnsConversationResponse()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal("owner-1", result.OwnerUserId);
        Assert.Equal("user-1", result.InitiatorUserId);
        Assert.Equal("Test Hall", result.HallName);
        Assert.False(result.IsExisting);
        Assert.NotEqual(Guid.Empty, result.ConversationId);
    }

    [Fact]
    public async Task CreateConversation_StoresConversationInRepository()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await service.CreateConversationAsync(hall.Id);

        Assert.Single(repository.Conversations);
        Assert.Equal(hall.Id, repository.Conversations[0].HallId);
        Assert.Equal("user-1", repository.Conversations[0].SenderUserId);
        Assert.Equal("owner-1", repository.Conversations[0].HallOwnerId);
    }

    [Fact]
    public async Task CreateConversation_HallOwner_CanContactOtherHall()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-2", roles: [ApplicationRoles.HallOwner]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal("owner-1", result.OwnerUserId);
        Assert.Equal("owner-2", result.InitiatorUserId);
    }

    [Fact]
    public async Task CreateConversation_Guest_ThrowsUnauthorized()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.CreateConversationAsync(hall.Id));
    }

    [Fact]
    public async Task CreateConversation_HallOwner_SelfContact_ThrowsForbidden()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateConversationAsync(hall.Id));
    }

    [Fact]
    public async Task CreateConversation_HallOwner_SelfContact_DoesNotStoreConversation()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        try
        {
            await service.CreateConversationAsync(hall.Id);
        }
        catch (ForbiddenException)
        {
        }

        Assert.Empty(repository.Conversations);
    }

    [Fact]
    public async Task CreateConversation_RegisteredUser_SelfContact_ThrowsForbidden()
    {
        var hall = CreateApprovedHall("Test Hall", "user-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateConversationAsync(hall.Id));
    }

    [Fact]
    public async Task CreateConversation_NonexistentHall_ThrowsNotFound()
    {
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository();
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.CreateConversationAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task CreateConversation_DeletedHall_ThrowsNotFound()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        hall.IsDeleted = true;
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.CreateConversationAsync(hall.Id));
    }

    [Fact]
    public async Task CreateConversation_PendingReviewHall_ThrowsNotFound()
    {
        var hall = new Hall
        {
            Id = Guid.NewGuid(),
            Name = "Test Hall",
            Status = HallStatus.PendingReview,
            OwnerId = "owner-1"
        };
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.CreateConversationAsync(hall.Id));
    }

    [Fact]
    public async Task CreateConversation_RejectedHall_ThrowsNotFound()
    {
        var hall = new Hall
        {
            Id = Guid.NewGuid(),
            Name = "Test Hall",
            Status = HallStatus.Rejected,
            OwnerId = "owner-1"
        };
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.CreateConversationAsync(hall.Id));
    }

    [Fact]
    public async Task CreateConversation_Admin_CanCreateConversation()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "admin-1", roles: [ApplicationRoles.Admin]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal("admin-1", result.InitiatorUserId);
    }

    [Fact]
    public async Task CreateConversation_UsesServerIdentity_NotClientSupplied()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "authenticated-user", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.Equal("authenticated-user", result.InitiatorUserId);
    }

    [Fact]
    public async Task CreateConversation_ResolvesHallOwner_FromHallRecord()
    {
        var hall = CreateApprovedHall("Test Hall", "actual-owner-id");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.Equal("actual-owner-id", result.OwnerUserId);
    }

    [Fact]
    public async Task CreateConversation_InvalidRole_ThrowsForbidden()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: []);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateConversationAsync(hall.Id));
    }

    [Fact]
    public async Task CreateConversation_ExistingConversation_ReturnsExistingWithFlag()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);

        var existing = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            SenderUserId = "user-1",
            HallOwnerId = "owner-1",
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-5)
        };
        repository.Conversations.Add(existing);

        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.True(result.IsExisting);
        Assert.Equal(existing.Id, result.ConversationId);
        Assert.Single(repository.Conversations);
    }

    [Fact]
    public async Task CreateConversation_NoExisting_CreatesNewWithFlagFalse()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.False(result.IsExisting);
        Assert.Single(repository.Conversations);
    }

    [Fact]
    public async Task CreateConversation_DifferentUser_SameHall_CreatesSeparateConversation()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);

        var existing = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            SenderUserId = "user-1",
            HallOwnerId = "owner-1",
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-5)
        };
        repository.Conversations.Add(existing);

        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-2", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.False(result.IsExisting);
        Assert.Equal(2, repository.Conversations.Count);
    }

    [Fact]
    public async Task CreateConversation_ReturnsHallName()
    {
        var hall = CreateApprovedHall("My Wedding Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.Equal("My Wedding Hall", result.HallName);
    }

    [Fact]
    public async Task GetConversation_Participant_ReturnsConversation()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var conversationId = Guid.NewGuid();
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        repository.Conversations.Add(new Conversation
        {
            Id = conversationId,
            HallId = hall.Id,
            SenderUserId = "user-1",
            HallOwnerId = "owner-1",
            Hall = hall,
            CreatedAt = DateTimeOffset.UtcNow
        });

        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.GetConversationAsync(conversationId);

        Assert.Equal(conversationId, result.ConversationId);
        Assert.Equal("Test Hall", result.HallName);
        Assert.True(result.IsExisting);
    }

    [Fact]
    public async Task GetConversation_HallOwner_ReturnsConversation()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var conversationId = Guid.NewGuid();
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        repository.Conversations.Add(new Conversation
        {
            Id = conversationId,
            HallId = hall.Id,
            SenderUserId = "user-1",
            HallOwnerId = "owner-1",
            Hall = hall,
            CreatedAt = DateTimeOffset.UtcNow
        });

        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        var result = await service.GetConversationAsync(conversationId);

        Assert.Equal(conversationId, result.ConversationId);
    }

    [Fact]
    public async Task GetConversation_Admin_ReturnsConversation()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var conversationId = Guid.NewGuid();
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        repository.Conversations.Add(new Conversation
        {
            Id = conversationId,
            HallId = hall.Id,
            SenderUserId = "user-1",
            HallOwnerId = "owner-1",
            Hall = hall,
            CreatedAt = DateTimeOffset.UtcNow
        });

        var service = CreateService(repository, hallRepository, authenticated: true, userId: "admin-1", roles: [ApplicationRoles.Admin]);

        var result = await service.GetConversationAsync(conversationId);

        Assert.Equal(conversationId, result.ConversationId);
    }

    [Fact]
    public async Task GetConversation_NonParticipant_ThrowsForbidden()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var conversationId = Guid.NewGuid();
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        repository.Conversations.Add(new Conversation
        {
            Id = conversationId,
            HallId = hall.Id,
            SenderUserId = "user-1",
            HallOwnerId = "owner-1",
            Hall = hall,
            CreatedAt = DateTimeOffset.UtcNow
        });

        var service = CreateService(repository, hallRepository, authenticated: true, userId: "stranger-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.GetConversationAsync(conversationId));
    }

    [Fact]
    public async Task GetConversation_NonexistentId_ThrowsNotFound()
    {
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository();
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.GetConversationAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetConversation_Unauthenticated_ThrowsUnauthorized()
    {
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository();
        var service = CreateService(repository, hallRepository, authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.GetConversationAsync(Guid.NewGuid()));
    }

    // --- WESAL-TASK-6, Edit 6: single seeker/owner thread + per-user soft delete ---

    [Fact]
    public async Task CreateConversation_SeekerContactingTheSameOwnerTwice_ReusesTheSameThread()
    {
        // A seeker who taps "Contact Owner" repeatedly must land in one thread, not a new one
        // each time. This is the guarantee the owner relies on when replying to a question.
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var first = await service.CreateConversationAsync(hall.Id);
        var second = await service.CreateConversationAsync(hall.Id);

        Assert.False(first.IsExisting);
        Assert.True(second.IsExisting);
        Assert.Equal(first.ConversationId, second.ConversationId);
        Assert.Single(repository.Conversations);
    }

    [Fact]
    public async Task CreateConversation_SeekerContactingTheSameOwnerAboutAnotherHall_OpensASeparateThread()
    {
        // Threading is per seeker + owner + hall. The same owner owns two halls, and the seeker's
        // question about one of them must not be mixed into the other.
        var firstHall = CreateApprovedHall("First Hall", "owner-1");
        var secondHall = CreateApprovedHall("Second Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(firstHall, secondHall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var first = await service.CreateConversationAsync(firstHall.Id);
        var second = await service.CreateConversationAsync(secondHall.Id);

        Assert.NotEqual(first.ConversationId, second.ConversationId);
        Assert.Equal(2, repository.Conversations.Count);
    }

    [Fact]
    public async Task HideConversation_Participant_HidesTheThreadForThemselfOnly()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var seeker = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);
        var created = await seeker.CreateConversationAsync(hall.Id);

        await seeker.HideConversationAsync(created.ConversationId);

        var hidden = Assert.Single(repository.HiddenConversations);
        Assert.Equal(created.ConversationId, hidden.ConversationId);
        Assert.Equal("user-1", hidden.UserId);
    }

    [Fact]
    public async Task HideConversation_HallOwner_CanHideTheThreadToo()
    {
        // Hiding is symmetric: the owner is equally entitled to clear a thread from their inbox.
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var seeker = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);
        var created = await seeker.CreateConversationAsync(hall.Id);
        var owner = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        await owner.HideConversationAsync(created.ConversationId);

        Assert.Equal("owner-1", Assert.Single(repository.HiddenConversations).UserId);
    }

    [Fact]
    public async Task HideConversation_NonParticipant_IsForbidden()
    {
        // A third party must never be able to remove somebody else's thread, not even by id.
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var seeker = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);
        var created = await seeker.CreateConversationAsync(hall.Id);
        var stranger = CreateService(repository, hallRepository, authenticated: true, userId: "user-2", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() => stranger.HideConversationAsync(created.ConversationId));

        Assert.Empty(repository.HiddenConversations);
    }

    [Fact]
    public async Task HideConversation_Unauthenticated_ThrowsUnauthorized()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var anonymous = CreateService(repository, hallRepository, authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(
            () => anonymous.HideConversationAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task HideConversation_UnknownConversation_ThrowsNotFound()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var service = CreateService(repository, new FakeHallRepository(hall), authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() => service.HideConversationAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task HideConversation_ConversationWhoseHallWasDeleted_ThrowsNotFound()
    {
        // A soft-deleted hall must not remain reachable through its threads.
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var seeker = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);
        var created = await seeker.CreateConversationAsync(hall.Id);
        // The real repository loads the hall alongside the thread; the fake only fills the
        // navigation when a test needs the deleted-hall rule exercised.
        repository.Conversations[0].Hall = hall;
        hall.IsDeleted = true;
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() => service.HideConversationAsync(created.ConversationId));
    }

    /// <summary>
    /// WESAL-TASK-11 (Edit 11): a Hall Owner needs a general-purpose "contact Admin"
    /// entry point that is independent of the payment-notice trigger. Before this, the
    /// owner/Admin thread only ever came into existence as a side effect of an Admin
    /// action (approval, rejection, subscription, expiry), so an owner who had not yet
    /// received any notice had no thread to open at all.
    /// </summary>
    [Fact]
    public async Task ContactAdmin_Owner_CreatesTheOwnerAdminThread()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        var result = await service.ContactAdminAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal("owner-1", result.OwnerUserId);
        Assert.False(result.IsExisting);

        var conversation = Assert.Single(repository.Conversations);
        Assert.Equal(hall.Id, conversation.HallId);
        Assert.Equal("owner-1", conversation.HallOwnerId);
        // The counterparty slot must be a real Admin so the thread lands in an Admin's
        // conversation list, rather than the owner being treated as the Admin side.
        Assert.Equal("admin-1", conversation.SenderUserId);
    }

    /// <summary>
    /// WESAL-TASK-11 (Edit 11): the whole point of the action is that it resolves to the
    /// SAME deterministic thread the payment notice uses, so a "Contact Admin" click can
    /// never fork a second conversation away from the one the Admin is replying in.
    /// </summary>
    [Fact]
    public async Task ContactAdmin_ResolvesToTheExistingOwnerAdminThreadInsteadOfCreatingASecondOne()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var existing = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            HallOwnerId = "owner-1",
            SenderUserId = "admin-7"
        };
        repository.Conversations.Add(existing);
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        var result = await service.ContactAdminAsync(hall.Id);

        Assert.Equal(existing.Id, result.ConversationId);
        Assert.True(result.IsExisting);
        Assert.Single(repository.Conversations);
    }

    /// <summary>
    /// WESAL-TASK-11 (Edit 11): only the owner of the hall may open that hall's
    /// owner/Admin thread. Without this, any authenticated user could mint (and then
    /// post into) an owner/Admin thread for a hall they do not own.
    /// </summary>
    [Fact]
    public async Task ContactAdmin_NonOwner_ThrowsForbidden()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "someone-else", roles: [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ForbiddenException>(() => service.ContactAdminAsync(hall.Id));
        Assert.Empty(repository.Conversations);
    }

    /// <summary>
    /// WESAL-TASK-11 (Edit 11): Edit 4's unpaid carve-out must keep working through the
    /// new entry point. An owner whose hall is Approved but unpaid still has to be able
    /// to reach the Admin, since that thread is where payment is discussed.
    /// </summary>
    [Fact]
    public async Task ContactAdmin_ApprovedButUnpaidHall_StillResolves()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        hall.PaymentStatus = HallPaymentStatus.Unpaid;
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        var result = await service.ContactAdminAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
        Assert.Single(repository.Conversations);
    }

    /// <summary>
    /// WESAL-TASK-10 (Edit 10 follow-up): <c>IConversationService.ContactAdminAsync</c> has
    /// always documented "A locked hall is still refused", but the method contained no
    /// <c>IsAdminLocked</c>/<c>SystemLocked</c> check at all, so an owner whose hall was
    /// locked by an Admin could still open the owner/Admin thread. That is the same partial
    /// lock as the attachment download: the read, the sends and the hub refused the owner,
    /// but this entry point let the thread be (re)opened anyway. The contract is what the
    /// code should have done, so the code is fixed to match the contract.
    /// </summary>
    [Fact]
    public async Task ContactAdmin_AdminLockedHall_ThrowsHallLocked()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        hall.IsAdminLocked = true;
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => service.ContactAdminAsync(hall.Id));

        Assert.Equal(HallManagementAccess.HallLockedCode, ex.Code);
        Assert.Empty(repository.Conversations);
    }

    [Fact]
    public async Task ContactAdmin_SystemLockedHall_ReportsTheLock()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        hall.SystemLocked = true;
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => service.ContactAdminAsync(hall.Id));

        Assert.Equal(HallManagementAccess.HallSystemLockedCode, ex.Code);
        Assert.Empty(repository.Conversations);
    }

    /// <summary>
    /// A locked hall must also refuse to RESOLVE an existing thread, not only refuse to
    /// create one. Otherwise the owner simply reaches the locked thread through the "existing
    /// thread" branch, which returns a conversation id and hands the client the same access
    /// the fresh-create path would have refused.
    /// </summary>
    [Fact]
    public async Task ContactAdmin_AdminLockedHall_RefusesToResolveAnExistingThreadToo()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        hall.IsAdminLocked = true;
        var repository = new FakeConversationRepository();
        repository.Conversations.Add(new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            HallOwnerId = "owner-1",
            SenderUserId = "admin-7"
        });
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => service.ContactAdminAsync(hall.Id));

        Assert.Equal(HallManagementAccess.HallLockedCode, ex.Code);
    }

    /// <summary>
    /// The refusal is a LOCK refusal, not a payment refusal: the Edit 4 carve-out already
    /// lets an unpaid owner through, so a paid-but-locked hall must report the lock code and
    /// must not be reported as "payment required" (the reverse pairing would also be wrong).
    /// </summary>
    [Fact]
    public async Task ContactAdmin_PaidButAdminLockedHall_ReportsTheLockNotPayment()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        hall.PaymentStatus = HallPaymentStatus.Paid;
        hall.IsAdminLocked = true;
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => service.ContactAdminAsync(hall.Id));

        Assert.Equal(HallManagementAccess.HallLockedCode, ex.Code);
    }

    /// <summary>
    /// The carve-out must survive item 3: an Approved-but-UNPAID and UNLOCKED hall is the
    /// ordinary pre-payment state and the owner has to keep reaching the Admin.
    /// </summary>
    [Fact]
    public async Task ContactAdmin_UnpaidButUnlockedHall_IsStillAllowed()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        hall.PaymentStatus = HallPaymentStatus.Unpaid;
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        var result = await service.ContactAdminAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
    }

    /// <summary>
    /// WESAL-TASK-10 (Edit 10 follow-up): ownership is settled BEFORE the lock check, so a
    /// stranger calling this action on somebody else's locked hall is refused as a
    /// non-owner and learns nothing about that hall's lock state. Checking the lock first
    /// would have turned this action into a lock-state oracle.
    /// </summary>
    [Fact]
    public async Task ContactAdmin_NonOwnerOnALockedHall_IsRefusedAsNonOwnerNotAsLocked()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        hall.IsAdminLocked = true;
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "someone-else", roles: [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ForbiddenException>(() => service.ContactAdminAsync(hall.Id));
        Assert.Empty(repository.Conversations);
    }

    private static Hall CreateApprovedHall(string name, string ownerId)
        => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            OwnerId = ownerId
        };

    private static ConversationService CreateService(
        FakeConversationRepository conversationRepository,
        FakeHallRepository hallRepository,
        bool authenticated,
        string? userId = null,
        IReadOnlyList<string>? roles = null)
    {
        var effectiveUserId = authenticated && userId is null ? "test-user-1" : userId;
        var currentUser = new FakeCurrentUserService(effectiveUserId, authenticated, roles ?? []);
        return new ConversationService(conversationRepository, new FakeMessageRepository(), new FakeBookingRejectionService(), new NoOpBookingAcceptanceService(), hallRepository, currentUser, new FakeConversationNotifier(), new FakeDocumentStorage());
    }

    private sealed class FakeConversationRepository : IConversationRepository
    {
        public List<Conversation> Conversations { get; } = [];

        public Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default)
        {
            Conversations.Add(conversation);
            return Task.CompletedTask;
        }

        public Task<Conversation?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(Conversations.FirstOrDefault(c => c.HallId == hallId && c.SenderUserId == userId));
        }

        public Task<Conversation?> GetByHallForOwnerAsync(Guid hallId, string ownerId, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(Conversations.FirstOrDefault(c => c.HallId == hallId && c.HallOwnerId == ownerId));
        }

        public string? AdminUserId { get; set; } = "admin-1";

        public Task<string?> GetAdminUserIdAsync(CancellationToken cancellationToken = default)
        {
            return Task.FromResult(AdminUserId);
        }

        public Task<Conversation?> GetByIdWithHallAsync(Guid conversationId, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(Conversations.FirstOrDefault(c => c.Id == conversationId));
        }

        public Task<IReadOnlyList<Conversation>> GetParticipantConversationsAsync(string userId, CancellationToken cancellationToken = default)
        {
            var conversations = Conversations
                .Where(c => (c.SenderUserId == userId || c.HallOwnerId == userId) && c.Hall?.IsDeleted != true)
                .OrderByDescending(c => c.CreatedAt)
                .ThenByDescending(c => c.Id)
                .ToList();
            return Task.FromResult<IReadOnlyList<Conversation>>(conversations);
        }

        public Task<IReadOnlyList<UserDisplayInfo>> GetUserDisplayNamesAsync(IReadOnlyCollection<string> userIds, CancellationToken cancellationToken = default)
        {
            var displayInfos = userIds
                .Select(id => new UserDisplayInfo { UserId = id, FullName = $"Display of {id}" })
                .ToList();
            return Task.FromResult<IReadOnlyList<UserDisplayInfo>>(displayInfos);
        }

        public Task UpsertReadStateAsync(Guid conversationId, string userId, DateTimeOffset lastReadAt, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public List<(Guid ConversationId, string UserId, DateTimeOffset HiddenAt)> HiddenConversations { get; } = [];

        public Task HideConversationAsync(Guid conversationId, string userId, DateTimeOffset hiddenAt, CancellationToken cancellationToken = default)
        {
            HiddenConversations.Add((conversationId, userId, hiddenAt));
            return Task.CompletedTask;
        }

        public Task<int> GetUnreadConversationCountAsync(string userId, bool isAdmin, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<Dictionary<Guid, bool>> GetUnreadStatusAsync(string userId, IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default) => Task.FromResult<Dictionary<Guid, bool>>(new Dictionary<Guid, bool>());
    }

    private sealed class FakeMessageRepository : IMessageRepository
    {
        public Task AddAsync(Message message, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<Message?> GetByIdAsync(Guid messageId, CancellationToken cancellationToken = default)
            => Task.FromResult<Message?>(null);

        public Task<Message?> GetByClientRequestIdAsync(string senderUserId, string clientRequestId, CancellationToken cancellationToken = default)
            => Task.FromResult<Message?>(null);

        public Task<IReadOnlyList<Message>> GetByConversationAsync(Guid conversationId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Message>>([]);

        public Task<IReadOnlyList<Message>> GetByConversationIdsAsync(IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Message>>([]);
    }

    private sealed class FakeBookingRejectionService : IBookingRejectionService
    {
        public Task<RejectBookingResultDto> RejectBookingAsync(
            Guid hallId,
            Guid bookingId,
            RejectBookingRequestDto request,
            CancellationToken cancellationToken = default)
            => Task.FromResult(new RejectBookingResultDto());

        public Task<int> DeliverPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(0);
    }

    private sealed class FakeHallRepository : IHallRepository
    {
        private readonly List<Hall> _halls;

        public FakeHallRepository(params Hall[] halls)
        {
            _halls = [.. halls];
        }

        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(_halls.FirstOrDefault(h => h.Id == id));

        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_halls.Take(count).ToList());

        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(HallRegion region, int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_halls.Where(h => h.Region == region).Take(count).ToList());

        public Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_halls.Skip(skip).Take(take).ToList());

        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(_halls.Count);

        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(string? name, HallRegion? region, string? area, string? detailedAddress, DateOnly? date, TimeOnly? startTime, int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_halls.Skip(skip).Take(take).ToList());

        public Task<int> SearchApprovedHallsCountAsync(string? name, HallRegion? region, string? area, string? detailedAddress, DateOnly? date, TimeOnly? startTime, CancellationToken cancellationToken = default)
            => Task.FromResult(_halls.Count);

        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallImage>>([]);

    }

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        public FakeCurrentUserService(string? userId, bool authenticated, IReadOnlyList<string> roles)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
            Roles = roles;
        }

        public string? UserId { get; }
        public string? UserName => null;
        public string? Email => null;
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }

    private sealed class FakeConversationNotifier : IConversationNotifier
    {
        public Task NotifyMessageSentAsync(MessageSentEvent message, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class FakeDocumentStorage : IDocumentStorage
    {
        public string Root => Path.Combine(Path.GetTempPath(), "wesal-test-documents");

        public string OwnerDocumentsDirectory(string ownerId) => Path.Combine(Root, "documents", "owners", ownerId);

    
        public string ConversationAttachmentsDirectory(Guid conversationId) => Path.Combine(Root, "documents", "conversations", conversationId.ToString(), "attachments");
    }
}
