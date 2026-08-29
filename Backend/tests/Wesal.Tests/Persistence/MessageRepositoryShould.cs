using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public class MessageRepositoryShould
{
    [Fact]
    public async Task GetByConversationAsync_ReturnsMessagesInChronologicalOrder()
    {
        await using var context = CreateContext();
        var seed = SeedConversationWithMessages(context);
        var repository = new MessageRepository(context);

        var result = await repository.GetByConversationAsync(seed.ConversationId);

        Assert.Equal(3, result.Count);
        Assert.Equal(seed.FirstId, result[0].Id);
        Assert.Equal(seed.SecondId, result[1].Id);
        Assert.Equal(seed.ThirdId, result[2].Id);
    }

    [Fact]
    public async Task GetByConversationAsync_ReturnsOnlyMessagesForConversation()
    {
        await using var context = CreateContext();
        var first = SeedConversationWithMessages(context);
        var second = SeedConversationWithMessages(context);
        var repository = new MessageRepository(context);

        var result = await repository.GetByConversationAsync(first.ConversationId);

        Assert.DoesNotContain(result, message => message.ConversationId == second.ConversationId);
        Assert.All(result, message => Assert.Equal(first.ConversationId, message.ConversationId));
    }

    [Fact]
    public async Task GetByConversationIdsAsync_ReturnsMessagesForAllConversations()
    {
        await using var context = CreateContext();
        var first = SeedConversationWithMessages(context);
        var second = SeedConversationWithMessages(context);
        var repository = new MessageRepository(context);

        var result = await repository.GetByConversationIdsAsync([first.ConversationId, second.ConversationId]);

        Assert.Equal(6, result.Count);
        Assert.Contains(result, message => first.ConversationId == message.ConversationId);
        Assert.Contains(result, message => second.ConversationId == message.ConversationId);
    }

    [Fact]
    public async Task GetByConversationIdsAsync_EmptyIds_ReturnsEmpty()
    {
        await using var context = CreateContext();
        SeedConversationWithMessages(context);
        var repository = new MessageRepository(context);

        var result = await repository.GetByConversationIdsAsync([]);

        Assert.Empty(result);
    }

    [Fact]
    public async Task AddAsync_AddsMessageForCallerCommit()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall" };
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            SenderUserId = "user-1",
            HallOwnerId = "owner-1"
        };
        context.Halls.Add(hall);
        context.Conversations.Add(conversation);
        context.SaveChanges();
        var message = CreateMessage(conversation.Id, "Rejection notice", DateTimeOffset.UtcNow);
        var repository = new MessageRepository(context);

        await repository.AddAsync(message);
        await context.SaveChangesAsync();

        var result = await repository.GetByConversationAsync(conversation.Id);
        var stored = Assert.Single(result);
        Assert.Equal(message.Id, stored.Id);
        Assert.Equal("Rejection notice", stored.Content);
    }

    [Fact]
    public void Model_ConfiguresIndexAndCascadeForMessage()
    {
        using var context = CreateContext();
        var entityType = context.Model.FindEntityType(typeof(Message))!;

        Assert.Contains(
            entityType.GetIndexes(),
            index => index.Properties.Select(property => property.Name).SequenceEqual(["ConversationId", "CreatedAt"]));

        var foreignKeys = entityType.GetForeignKeys().ToList();
        Assert.Contains(
            foreignKeys,
            foreignKey => foreignKey.PrincipalEntityType.ClrType == typeof(Conversation)
                && foreignKey.DeleteBehavior == DeleteBehavior.Cascade);
    }

    private static (Guid ConversationId, Guid FirstId, Guid SecondId, Guid ThirdId) SeedConversationWithMessages(ApplicationDbContext context)
    {
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall" };
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            SenderUserId = "user-1",
            HallOwnerId = "owner-1",
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        };
        var first = CreateMessage(conversation.Id, "first", DateTimeOffset.UtcNow.AddMinutes(-10));
        var second = CreateMessage(conversation.Id, "second", DateTimeOffset.UtcNow.AddMinutes(-5));
        var third = CreateMessage(conversation.Id, "third", DateTimeOffset.UtcNow);
        context.Halls.Add(hall);
        context.Conversations.Add(conversation);
        context.Messages.AddRange(first, second, third);
        context.SaveChanges();

        return (conversation.Id, first.Id, second.Id, third.Id);
    }

    private static Message CreateMessage(Guid conversationId, string content, DateTimeOffset createdAt)
        => new()
        {
            Id = Guid.NewGuid(),
            ConversationId = conversationId,
            SenderUserId = "user-1",
            Content = content,
            CreatedAt = createdAt
        };

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }
}