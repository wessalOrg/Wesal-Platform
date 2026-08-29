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