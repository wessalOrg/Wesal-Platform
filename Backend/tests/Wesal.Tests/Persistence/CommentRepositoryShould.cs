using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public class CommentRepositoryShould
{
    private static readonly DateTimeOffset FixedNow = new(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task GetByHallIdAsync_ReturnsOnlyCommentsForHall()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall" };
        var otherHall = new Hall { Id = Guid.NewGuid(), Name = "Other" };
        context.Halls.AddRange(hall, otherHall);
        context.Comments.AddRange(
            new Comment { HallId = hall.Id, UserId = "user-1", Content = "For hall" },
            new Comment { HallId = hall.Id, UserId = "user-2", Content = "Also for hall" },
            new Comment { HallId = otherHall.Id, UserId = "user-1", Content = "For other hall" });
        await context.SaveChangesAsync();

        var repository = new CommentRepository(context);

        var result = await repository.GetByHallIdAsync(hall.Id);

        Assert.Equal(2, result.Count);
        Assert.All(result, comment => Assert.Equal(hall.Id, comment.HallId));
    }

    [Fact]
    public async Task GetByHallIdAsync_OrdersByCreatedAtDescending()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall" };
        context.Halls.Add(hall);
        context.Comments.AddRange(
            new Comment { HallId = hall.Id, UserId = "user-1", Content = "Oldest", CreatedAt = FixedNow.AddMinutes(-2) },
            new Comment { HallId = hall.Id, UserId = "user-2", Content = "Newest", CreatedAt = FixedNow },
            new Comment { HallId = hall.Id, UserId = "user-3", Content = "Middle", CreatedAt = FixedNow.AddMinutes(-1) });
        await context.SaveChangesAsync();

        var repository = new CommentRepository(context);

        var result = await repository.GetByHallIdAsync(hall.Id);

        Assert.Collection(
            result,
            comment => Assert.Equal("Newest", comment.Content),
            comment => Assert.Equal("Middle", comment.Content),
            comment => Assert.Equal("Oldest", comment.Content));
    }

    [Fact]
    public async Task GetByHallIdAsync_ReturnsEmptyWhenHallHasNoComments()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall" };
        context.Halls.Add(hall);
        await context.SaveChangesAsync();

        var repository = new CommentRepository(context);

        var result = await repository.GetByHallIdAsync(hall.Id);

        Assert.Empty(result);
    }

    [Fact]
    public async Task AddAsync_PersistsCommentWithRequiredFields()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall" };
        context.Halls.Add(hall);
        await context.SaveChangesAsync();

        var repository = new CommentRepository(context);

        await repository.AddAsync(new Comment
        {
            HallId = hall.Id,
            UserId = "user-1",
            Content = "Great hall",
            CreatedAt = FixedNow
        });

        var stored = await context.Comments.SingleAsync();
        Assert.Equal(hall.Id, stored.HallId);
        Assert.Equal("user-1", stored.UserId);
        Assert.Equal("Great hall", stored.Content);
        Assert.Equal(FixedNow, stored.CreatedAt);
    }

    [Fact]
    public void Model_ConfiguresRelationshipsAndIndexForComment()
    {
        using var context = CreateContext();
        var entityType = context.Model.FindEntityType(typeof(Comment))!;

        Assert.Contains(
            entityType.GetIndexes(),
            index => !index.IsUnique
                && index.Properties.Select(property => property.Name).SequenceEqual(["HallId", "CreatedAt"]));

        var foreignKeys = entityType.GetForeignKeys().ToList();

        var hallForeignKey = foreignKeys.Single(fk => fk.PrincipalEntityType.ClrType == typeof(Hall));
        Assert.Equal(DeleteBehavior.Cascade, hallForeignKey.DeleteBehavior);

        var userForeignKey = foreignKeys.Single(fk => fk.PrincipalEntityType.ClrType == typeof(ApplicationUser));
        Assert.Equal(DeleteBehavior.Cascade, userForeignKey.DeleteBehavior);
        Assert.Equal("UserId", userForeignKey.Properties.Single().Name);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }
}
