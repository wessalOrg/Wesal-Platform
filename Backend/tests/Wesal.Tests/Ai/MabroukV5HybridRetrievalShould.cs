using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Ai;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Ai;

public sealed class MabroukV5HybridRetrievalShould : IAsyncLifetime
{
    private readonly ApplicationDbContext _db;
    private readonly AiKnowledgeStudioRepository _repository;
    private readonly HybridWesalKnowledgeService _service;
    private readonly DateTimeOffset _now = new(2026, 10, 13, 12, 0, 0, TimeSpan.Zero);

    public MabroukV5HybridRetrievalShould()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase("MabroukV5HybridRetrieval-" + Guid.NewGuid())
            .Options;
        _db = new ApplicationDbContext(options);
        _repository = new AiKnowledgeStudioRepository(_db);
        _service = new HybridWesalKnowledgeService(
            new WesalKnowledgeService(), _repository, new FixedClock(_now),
            NullLogger<HybridWesalKnowledgeService>.Instance);
    }

    [Fact]
    public async Task ExactVerifiedAliasBeatsHigherPriorityVagueLexicalCandidate()
    {
        var vague = Article("mabrouk-vague", "Mabrouk team overview", "team mabrouk developers", 100);
        var exact = Article("mabrouk-exact", "Mabrouk development team", "Mabrouk developers", 1,
            "مين طور مبروك؟");
        _repository.AddArticle(vague);
        _repository.AddArticle(exact);
        await _repository.SaveChangesAsync();

        var result = await _service.SearchAsync("مين طور مبروك؟", "ar", 10);

        Assert.True(result[0].StableKey == "mabrouk-exact", string.Join(",", result.Select(article => $"{article.StableKey}:{article.MatchScore}:{article.RetrievalMethod}")));
        Assert.Equal("exact-alias", result[0].RetrievalMethod);
    }

    [Fact]
    public async Task ReturnOnlyTheTrustedExactAliasForAnExactBuiltInQuestion()
    {
        var result = await _service.SearchAsync("Who developed Wesal?", "en", 5);

        var article = Assert.Single(result);
        Assert.Equal("platform.wesal-team", article.StableKey);
        Assert.Equal("exact-alias", article.RetrievalMethod);
    }

    [Fact]
    public async Task RejectSubstringOnlyDynamicCandidateForUnknownQuestion()
    {
        var booking = Article("booking-help", "Booking help", "booking reserve a hall", 10,
            "How do I book a hall?");
        _repository.AddArticle(booking);
        await _repository.SaveChangesAsync();

        var result = await _service.SearchAsync("book a trip to the moon", "en", 3);

        Assert.DoesNotContain(result, article => article.StableKey == "booking-help");
    }

    [Fact]
    public async Task KeepDynamicMabroukSourceSeparateFromWesalTeamSource()
    {
        var result = await _service.SearchAsync("مين طور مبروك؟", "ar", 10);

        Assert.DoesNotContain(result, article => article.StableKey == "platform.wesal-team");
        Assert.Contains(result, article => article.StableKey == "mabrouk-development-team");
    }

    private AiKnowledgeArticle Article(string key, string title, string searchText, int priority, string? alias = null)
    {
        var article = new AiKnowledgeArticle
        {
            Key = key,
            Title = title,
            Category = "mabrouk",
            AnswerAr = "إجابة موثوقة للاختبار.",
            AnswerEn = "Trusted test answer.",
            Source = "test",
            Priority = priority,
            PublicationStatus = AiKnowledgePublicationStatus.Published,
            VerificationStatus = AiKnowledgeVerificationStatus.Verified,
            CreatedAt = _now,
            UpdatedAt = _now,
            PublishedAt = _now,
            CurrentVersion = 1,
            PublishedVersion = 1,
            NormalizedSearchText = AiText.Normalize(string.Join(" ", searchText, alias))
        };
        if (alias is not null)
        {
            article.Aliases.Add(new AiKnowledgeAlias
            {
                Article = article,
                Language = "ar",
                Text = alias,
                NormalizedText = AiText.Normalize(alias),
                CreatedAt = _now
            });
        }
        return article;
    }

    public Task InitializeAsync() => Task.CompletedTask;
    public async Task DisposeAsync() => await _db.DisposeAsync();

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
