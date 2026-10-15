using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Ai;

/// <summary>Checks risky and unknown questions at the offline assistant-response layer.</summary>
public sealed class MabroukV6AnswerSafetyShould : IAsyncLifetime
{
    private readonly ApplicationDbContext _db;

    public MabroukV6AnswerSafetyShould()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase("MabroukV6AnswerSafety-" + Guid.NewGuid())
            .Options;
        _db = new ApplicationDbContext(options);
    }

    [Theory]
    [InlineData("ar", "كم برجعولي إذا ألغيت الحجز؟", "غير مؤكدة", "دعم وصال")]
    [InlineData("en", "How long does a cancelled booking refund take?", "not confirmed", "Wesal support")]
    public async Task KeepRefundAmountsFeesAndTimingUnconfirmed(
        string language, string question, string safePhrase, string supportPhrase)
    {
        var harness = CreateHarness();
        var response = await harness.AskAsync(question, language);

        Assert.Equal(AiAssistantResponseKind.Answer, response.Kind);
        Assert.Contains(safePhrase, response.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(supportPhrase, response.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotMatch(@"[0-9٠-٩]", response.Message);
    }

    [Theory]
    [InlineData("ar", "دفعت العربون وبدي ألغي طلبي، بقدر؟", "لا يسمح النظام بالإلغاء بعد تأكيد العربون")]
    [InlineData("en", "Can I cancel my accepted booking after the deposit was paid?", "blocks cancellation after payment confirmation")]
    public async Task StateThatCancellationIsBlockedAfterConfirmedDeposit(
        string language, string question, string requiredFact)
    {
        var harness = CreateHarness();
        var response = await harness.AskAsync(question, language);

        Assert.Equal(AiAssistantResponseKind.Answer, response.Kind);
        Assert.Contains(requiredFact, response.Message + "\nRoutes: " + string.Join(" | ", harness.RouteLogs), StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotMatch(@"[0-9٠-٩]", response.Message);
    }

    private MabroukHarness CreateHarness()
    {
        var repository = new AiKnowledgeStudioRepository(_db);
        var clock = new FixedClock(new DateTimeOffset(2026, 10, 13, 12, 0, 0, TimeSpan.Zero));
        var retriever = new HybridWesalKnowledgeService(
            new WesalKnowledgeService(), repository, clock,
            NullLogger<HybridWesalKnowledgeService>.Instance);
        return new MabroukHarness(knowledgeService: retriever);
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _db.DisposeAsync();

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
