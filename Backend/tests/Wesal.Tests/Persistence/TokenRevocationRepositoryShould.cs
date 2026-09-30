using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public class TokenRevocationRepositoryShould
{
    [Fact]
    public async Task IsRevokedAsync_UnknownJti_ReturnsFalse()
    {
        await using var context = CreateContext();

        var repository = new TokenRevocationRepository(context);

        var result = await repository.IsRevokedAsync("unknown-jti");

        Assert.False(result);
    }

    [Fact]
    public async Task IsRevokedAsync_AfterRevoke_ReturnsTrue()
    {
        await using var context = CreateContext();
        var repository = new TokenRevocationRepository(context);

        await repository.RevokeAsync("revoked-jti", "user-1");

        var result = await repository.IsRevokedAsync("revoked-jti");

        Assert.True(result);
    }

    [Fact]
    public async Task RevokeAsync_PersistsRevocationRecordWithAuthenticatedUserId()
    {
        await using var context = CreateContext();
        var repository = new TokenRevocationRepository(context);

        var newlyRevoked = await repository.RevokeAsync("revoked-jti", "user-1");

        Assert.True(newlyRevoked);

        var record = await context.RevokedTokens.SingleAsync(token => token.Jti == "revoked-jti");
        Assert.Equal("user-1", record.UserId);
        Assert.True(record.RevokedAt <= DateTimeOffset.UtcNow);
    }

    [Fact]
    public async Task RevokeAsync_SameJtiTwice_IsIdempotent()
    {
        await using var context = CreateContext();
        var repository = new TokenRevocationRepository(context);

        var first = await repository.RevokeAsync("same-jti", "user-1");
        var second = await repository.RevokeAsync("same-jti", "user-1");

        Assert.True(first);
        Assert.False(second);
        Assert.Single(await context.RevokedTokens.Where(token => token.Jti == "same-jti").ToListAsync());
    }

    [Fact]
    public async Task RevokeAsync_DifferentJti_AreIndependent()
    {
        await using var context = CreateContext();
        var repository = new TokenRevocationRepository(context);

        await repository.RevokeAsync("jti-one", "user-1");

        Assert.True(await repository.RevokeAsync("jti-two", "user-2"));
        Assert.True(await repository.IsRevokedAsync("jti-one"));
        Assert.True(await repository.IsRevokedAsync("jti-two"));
    }

    [Fact]
    public async Task Purge_KeepsRevocationWithinMaxTokenLifetime()
    {
        // A token revoked near the maximum JWT lifetime (24h) plus clock skew
        // must stay revoked: purging it early would resurrect a live token.
        await using var context = CreateContext();
        context.RevokedTokens.Add(new RevokedToken
        {
            Jti = "old-but-live-jti",
            UserId = "user-1",
            RevokedAt = DateTimeOffset.UtcNow - TimeSpan.FromHours(24.5)
        });
        await context.SaveChangesAsync();

        var repository = new TokenRevocationRepository(context);
        await repository.RevokeAsync("fresh-jti", "user-1");

        Assert.True(await context.RevokedTokens.AnyAsync(token => token.Jti == "old-but-live-jti"));
        Assert.True(await repository.IsRevokedAsync("old-but-live-jti"));
    }

    [Fact]
    public async Task Purge_RemovesLongExpiredRevocations()
    {
        await using var context = CreateContext();
        context.RevokedTokens.Add(new RevokedToken
        {
            Jti = "ancient-jti",
            UserId = "user-1",
            RevokedAt = DateTimeOffset.UtcNow - TimeSpan.FromHours(26)
        });
        await context.SaveChangesAsync();

        var repository = new TokenRevocationRepository(context);
        await repository.RevokeAsync("fresh-jti", "user-1");

        Assert.False(await context.RevokedTokens.AnyAsync(token => token.Jti == "ancient-jti"));
    }

    [Fact]
    public void Model_ConfiguresUniqueIndexOnJti()
    {
        using var context = CreateContext();

        var entityType = context.Model.FindEntityType(typeof(RevokedToken));
        Assert.NotNull(entityType);

        var index = Assert.Single(entityType!.GetIndexes());
        Assert.Single(index.Properties);
        Assert.Equal(nameof(RevokedToken.Jti), index.Properties[0].Name);
        Assert.True(index.IsUnique);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }
}