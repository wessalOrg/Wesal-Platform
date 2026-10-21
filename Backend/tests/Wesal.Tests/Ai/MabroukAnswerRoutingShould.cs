using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Entities;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Ai;

/// <summary>
/// Admin answers added from Mabrouk Studio must reach the pre-model knowledge
/// route once they are published and verified, even when they are filed under a
/// category the assistant has never seen before. Draft and unverified answers
/// must keep falling through.
/// </summary>
public sealed class MabroukAnswerRoutingShould : IAsyncLifetime
{
    private const string CustomCategory = "hall-services";
    private const string CustomQuestion = "Ù‡Ù„ ØªÙˆÙØ±ÙˆÙ† Ø®Ø¯Ù…Ø© ØªØµÙˆÙŠØ± ÙÙŠØ¯ÙŠÙˆ Ù„Ù„Ø­ÙÙ„ØŸ";
    private const string CustomAnswer = "Ù†Ø¹Ù…ØŒ Ù†ÙˆÙØ± Ø®Ø¯Ù…Ø© ØªØµÙˆÙŠØ± ÙÙŠØ¯ÙŠÙˆ Ø§Ø®ØªÙŠØ§Ø±ÙŠØ© Ø¹Ù†Ø¯ Ø§Ù„Ø­Ø¬Ø².";
    private const string MabroukQuestion = "Ø´Ùˆ Ù…ÙˆØ§Ø¹ÙŠØ¯ Ø§Ù„Ø¯ÙˆØ§Ù… Ø§Ù„Ø±Ø³Ù…ÙŠØŸ";
    private const string MabroukAnswer = "Ø§Ù„Ø¯ÙˆØ§Ù… Ø§Ù„Ø±Ø³Ù…ÙŠ Ù…Ù† Ø§Ù„Ø£Ø­Ø¯ Ø¥Ù„Ù‰ Ø§Ù„Ø®Ù…ÙŠØ³ØŒ Ù…Ù† 9 ØµØ¨Ø§Ø­Ù‹Ø§ Ø­ØªÙ‰ 5 Ù…Ø³Ø§Ø¡Ù‹.";

    private readonly ApplicationDbContext _db;
    private readonly AiKnowledgeStudioRepository _repository;
    private readonly HybridWesalKnowledgeService _knowledge;
    private readonly DateTimeOffset _now = new(2026, 10, 13, 12, 0, 0, TimeSpan.Zero);

    public MabroukAnswerRoutingShould()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase("MabroukAnswerRouting-" + Guid.NewGuid())
            .Options;
        _db = new ApplicationDbContext(options);
        _repository = new AiKnowledgeStudioRepository(_db);
        _knowledge = new HybridWesalKnowledgeService(
            new WesalKnowledgeService(), _repository, new FixedClock(_now),
            NullLogger<HybridWesalKnowledgeService>.Instance);
    }

    [Fact]
    public async Task VerifiedPublishedAnswerWithCustomCategory_IsServedWithoutTheModel()
    {
        _repository.AddArticle(Article("extra-chairs", "Ø®Ø¯Ù…Ø© ØªØµÙˆÙŠØ± Ø§Ù„ÙÙŠØ¯ÙŠÙˆ", CustomCategory,
            AiKnowledgePublicationStatus.Published, AiKnowledgeVerificationStatus.Verified, CustomQuestion));
        await _repository.SaveChangesAsync();

        var answer = await CreateHowToService().TryAnswerKnownQuestionAsync(CustomQuestion, "ar");

        Assert.NotNull(answer);
        Assert.Equal(CustomAnswer, answer!.Answer);
        Assert.Equal(CustomCategory, answer.Category);
    }

    [Fact]
    public async Task DraftAnswer_IsNotServed()
    {
        _repository.AddArticle(Article("extra-chairs", "Ø®Ø¯Ù…Ø© ØªØµÙˆÙŠØ± Ø§Ù„ÙÙŠØ¯ÙŠÙˆ", CustomCategory,
            AiKnowledgePublicationStatus.Draft, AiKnowledgeVerificationStatus.Verified, CustomQuestion));
        await _repository.SaveChangesAsync();

        var answer = await CreateHowToService().TryAnswerKnownQuestionAsync(CustomQuestion, "ar");

        Assert.Null(answer);
    }

    [Fact]
    public async Task UnverifiedAnswer_IsNotServed()
    {
        _repository.AddArticle(Article("extra-chairs", "Ø®Ø¯Ù…Ø© ØªØµÙˆÙŠØ± Ø§Ù„ÙÙŠØ¯ÙŠÙˆ", CustomCategory,
            AiKnowledgePublicationStatus.Published, AiKnowledgeVerificationStatus.NeedsVerification, CustomQuestion));
        await _repository.SaveChangesAsync();

        var answer = await CreateHowToService().TryAnswerKnownQuestionAsync(CustomQuestion, "ar");

        Assert.Null(answer);
    }

    [Fact]
    public async Task VerifiedAnswerFiledUnderMabrouk_IsServedForAPlainQuestion()
    {
        _repository.AddArticle(Article("official-hours", "Ù…ÙˆØ§Ø¹ÙŠØ¯ Ø§Ù„Ø¯ÙˆØ§Ù… Ø§Ù„Ø±Ø³Ù…ÙŠ", "mabrouk",
            AiKnowledgePublicationStatus.Published, AiKnowledgeVerificationStatus.Verified, MabroukQuestion));
        await _repository.SaveChangesAsync();

        var answer = await CreateHowToService().TryAnswerKnownQuestionAsync(MabroukQuestion, "ar");

        Assert.NotNull(answer);
        Assert.Equal(MabroukAnswer, answer!.Answer);
        Assert.Equal("mabrouk", answer.Category);
    }

    private HowToService CreateHowToService()
        => new(
            new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions())),
            knowledgeService: _knowledge);

    private AiKnowledgeArticle Article(
        string key,
        string title,
        string category,
        AiKnowledgePublicationStatus publication,
        AiKnowledgeVerificationStatus verification,
        string alias)
    {
        var article = new AiKnowledgeArticle
        {
            Key = key,
            Title = title,
            Category = category,
            AnswerAr = category == "mabrouk" ? MabroukAnswer : CustomAnswer,
            AnswerEn = null,
            Source = "test",
            Priority = 10,
            PublicationStatus = publication,
            VerificationStatus = verification,
            CreatedAt = _now,
            UpdatedAt = _now,
            PublishedAt = publication == AiKnowledgePublicationStatus.Published ? _now : null,
            CurrentVersion = 1,
            PublishedVersion = publication == AiKnowledgePublicationStatus.Published ? 1 : 0,
            NormalizedSearchText = AiText.Normalize(string.Join(' ', key, title, category, alias))
        };
        article.Aliases.Add(new AiKnowledgeAlias
        {
            Article = article,
            Language = "ar",
            Text = alias,
            NormalizedText = AiText.Normalize(alias),
            CreatedAt = _now
        });
        return article;
    }

    public Task InitializeAsync() => Task.CompletedTask;
    public async Task DisposeAsync() => await _db.DisposeAsync();

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}

