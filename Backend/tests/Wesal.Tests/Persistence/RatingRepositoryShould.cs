using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public class RatingRepositoryShould
{
    [Fact]
    public async Task GetByHallAndUserAsync_ReturnsMatchingRating()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall" };
        var rating = new Rating { HallId = hall.Id, UserId = "user-1", Value = 4 };
        context.Halls.Add(hall);
        context.Ratings.Add(rating);
        await context.SaveChangesAsync();

        var repository = new RatingRepository(context);

        var result = await repository.GetByHallAndUserAsync(hall.Id, "user-1");

        Assert.NotNull(result);
        Assert.Equal(rating.Id, result.Id);
        Assert.Equal(4, result.Value);
    }

    [Fact]
    public async Task GetByHallAndUserAsync_ReturnsNullWhenNoMatchingRating()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall" };
        context.Halls.Add(hall);
        await context.SaveChangesAsync();

        var repository = new RatingRepository(context);

        var result = await repository.GetByHallAndUserAsync(hall.Id, "user-1");

        Assert.Null(result);
    }

    [Fact]
    public async Task GetAverageRatingAsync_ReturnsZeroWhenNoRatings()
    {
        await using var context = CreateContext();

        var repository = new RatingRepository(context);

        var result = await repository.GetAverageRatingAsync(Guid.NewGuid());

        Assert.Equal(0, result);
    }

    [Fact]
    public async Task GetAverageRatingAsync_ComputesAverageAcrossRatings()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall" };
        context.Halls.Add(hall);
        context.Ratings.AddRange(
            new Rating { HallId = hall.Id, UserId = "user-1", Value = 4 },
            new Rating { HallId = hall.Id, UserId = "user-2", Value = 2 });
        await context.SaveChangesAsync();

        var repository = new RatingRepository(context);

        var result = await repository.GetAverageRatingAsync(hall.Id);

        Assert.Equal(3.0, result);
    }

    [Fact]
    public async Task GetTotalRatingsAsync_CountsOnlyRatingsForHall()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall" };
        var otherHall = new Hall { Id = Guid.NewGuid(), Name = "Other" };
        context.Halls.AddRange(hall, otherHall);
        context.Ratings.AddRange(
            new Rating { HallId = hall.Id, UserId = "user-1", Value = 3 },
            new Rating { HallId = hall.Id, UserId = "user-2", Value = 5 },
            new Rating { HallId = otherHall.Id, UserId = "user-3", Value = 4 });
        await context.SaveChangesAsync();

        var repository = new RatingRepository(context);

        var result = await repository.GetTotalRatingsAsync(hall.Id);

        Assert.Equal(2, result);
    }

    [Fact]
    public async Task GetUserRatingCountAsync_CountsOnlyRatingsForUser()
    {
        await using var context = CreateContext();
        var firstHall = new Hall { Id = Guid.NewGuid(), Name = "First" };
        var secondHall = new Hall { Id = Guid.NewGuid(), Name = "Second" };
        context.Halls.AddRange(firstHall, secondHall);
        context.Ratings.AddRange(
            new Rating { HallId = firstHall.Id, UserId = "user-1", Value = 3 },
            new Rating { HallId = secondHall.Id, UserId = "user-1", Value = 5 },
            new Rating { HallId = secondHall.Id, UserId = "user-2", Value = 4 });
        await context.SaveChangesAsync();

        var repository = new RatingRepository(context);

        var result = await repository.GetUserRatingCountAsync("user-1");

        Assert.Equal(2, result);
    }

    [Fact]
    public async Task AddAsync_PersistsRating()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall" };
        context.Halls.Add(hall);
        await context.SaveChangesAsync();

        var repository = new RatingRepository(context);

        await repository.AddAsync(new Rating { HallId = hall.Id, UserId = "user-1", Value = 5 });

        var stored = await context.Ratings.SingleAsync();
        Assert.Equal(5, stored.Value);
        Assert.Equal(hall.Id, stored.HallId);
        Assert.Equal("user-1", stored.UserId);
    }

    [Fact]
    public async Task UpdateAsync_UpdatesRatingValue()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall" };
        var rating = new Rating { HallId = hall.Id, UserId = "user-1", Value = 2 };
        context.Halls.Add(hall);
        context.Ratings.Add(rating);
        await context.SaveChangesAsync();

        var repository = new RatingRepository(context);

        rating.Value = 4;
        await repository.UpdateAsync(rating);

        var stored = await context.Ratings.SingleAsync();
        Assert.Equal(4, stored.Value);
    }

    [Fact]
    public async Task GetSummaryAsync_ComputesAverageAndTotalIncludingUserRating()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall" };
        context.Halls.Add(hall);
        context.Ratings.AddRange(
            new Rating { HallId = hall.Id, UserId = "user-1", Value = 4 },
            new Rating { HallId = hall.Id, UserId = "user-2", Value = 2 });
        await context.SaveChangesAsync();

        var repository = new RatingRepository(context);

        var (average, total, userRating) = await repository.GetSummaryAsync(hall.Id, "user-1");

        Assert.Equal(3.0, average);
        Assert.Equal(2, total);
        Assert.Equal(4, userRating);
    }

    [Fact]
    public async Task GetSummaryAsync_OmitsUserRatingForAnonymousCaller()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall" };
        context.Halls.Add(hall);
        context.Ratings.Add(new Rating { HallId = hall.Id, UserId = "user-1", Value = 5 });
        await context.SaveChangesAsync();

        var repository = new RatingRepository(context);

        var (average, total, userRating) = await repository.GetSummaryAsync(hall.Id, null);

        Assert.Equal(5.0, average);
        Assert.Equal(1, total);
        Assert.Null(userRating);
    }

    [Fact]
    public void Model_ConfiguresUniqueIndexAndRelationshipsForRating()
    {
        using var context = CreateContext();
        var entityType = context.Model.FindEntityType(typeof(Rating))!;

        Assert.Contains(
            entityType.GetIndexes(),
            index => index.IsUnique && index.Properties.Select(property => property.Name).SequenceEqual(["HallId", "UserId"]));

        var foreignKeys = entityType.GetForeignKeys().ToList();
        Assert.Contains(foreignKeys, foreignKey => foreignKey.PrincipalEntityType.ClrType == typeof(Hall));
        Assert.Contains(foreignKeys, foreignKey => foreignKey.PrincipalEntityType.ClrType == typeof(ApplicationUser));
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }
}
