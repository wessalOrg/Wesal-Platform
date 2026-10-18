using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Ai;

/// <summary>
/// Learning-loop behavior without PostgreSQL: V3 flows record zero gaps, an
/// unknown records exactly one cluster without changing the user answer, and
/// recorder/Dynamic failures keep Mabrouk alive. Real-PostgreSQL variants live
/// in <see cref="MabroukStudioPgShould"/>.
/// </summary>
public sealed class MabroukLearningLoopShould : IDisposable
{
    private readonly ApplicationDbContext _db;
    private readonly AiKnowledgeStudioRepository _repository;
    private static readonly TimeProvider Clock = TimeProvider.System;

    public MabroukLearningLoopShould()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase("MabroukLearningLoop-" + Guid.NewGuid())
            .Options;
        _db = new ApplicationDbContext(options);
        _repository = new AiKnowledgeStudioRepository(_db);
    }

    public void Dispose() => _db.Dispose();

    private MabroukHarness RecordingHarness(out AiKnowledgeGapRecorder recorder)
    {
        recorder = new AiKnowledgeGapRecorder(_repository, Clock);
        return new MabroukHarness(gapRecorder: recorder, gapDetector: new AiKnowledgeGapDetector());
    }

    [Fact]
    public async Task V3ConversationFlowsRecordZeroGaps()
    {
        var harness = RecordingHarness(out _);
        using var sessions = new ChatSessionService();
        var studio = StudioService();

        async Task<AiAssistantResponse> TurnAsync(Guid sessionId, string message)
        {
            var context = await sessions.GetConversationContextAsync(sessionId);
            var response = await harness.AskAsync(message, conversation: context);
            await sessions.SaveExchangeAsync(sessionId, message, response.Message, response.Intent,
                AiResponseMemory.ShownHalls(response), AiResponseMemory.FocusedHall(response),
                conversationState: AdvanceLikeController(context, message, response));
            return response;
        }

        var sessionA = await sessions.InitializeSessionAsync("ar");
        Assert.Equal(AiAssistantResponseKind.Halls, (await TurnAsync(sessionA.SessionId, "بدي صالة ل300 شخص")).Kind);
        Assert.Equal(AiAssistantResponseKind.Clarification, (await TurnAsync(sessionA.SessionId, "بكم ومتى متوفرة")).Kind);
        var resumed = await TurnAsync(sessionA.SessionId, "بكرة");
        Assert.Equal(AiAssistantResponseKind.Availability, resumed.Kind);
        Assert.Equal(AiAssistantResponseKind.HallDetails, (await TurnAsync(sessionA.SessionId, "غيرها")).Kind);
        var price = await TurnAsync(sessionA.SessionId, "قديش سعرها؟");
        Assert.Contains("7000", price.Message);

        var sessionB = await sessions.InitializeSessionAsync("ar");
        Assert.Equal(2, (await TurnAsync(sessionB.SessionId, "احكيلي عن الصالات الموجودة")).Halls.Count);
        var second = await TurnAsync(sessionB.SessionId, "الثانية");
        Assert.Equal(AiAssistantResponseKind.HallDetails, second.Kind);
        var facts = await TurnAsync(sessionB.SessionId, "وين موجودة وكم بتسع وقديش سعرها");
        Assert.Contains("5000", facts.Message);
        Assert.Equal(AiAssistantResponseKind.Answer, (await TurnAsync(sessionB.SessionId, "غيرها")).Kind);

        Assert.Empty(await studio.ListGapsAsync());
    }

    [Fact]
    public async Task UnknownRecordsExactlyOneGapWithoutChangingTheAnswer()
    {
        const string unknown = "كم يساوي اثنان زائد اثنين؟";
        var plain = new MabroukHarness();
        var recording = RecordingHarness(out _);
        var studio = StudioService();

        var baseline = await plain.AskAsync(unknown);
        var recorded = await recording.AskAsync(unknown);

        Assert.Equal(baseline.Message, recorded.Message);
        Assert.Equal(baseline.Kind, recorded.Kind);
        var cluster = Assert.Single(await studio.ListGapsAsync());
        Assert.Equal(1, cluster.OccurrenceCount);
        Assert.Equal("New", cluster.Status);
    }

    [Fact]
    public async Task PublishedAnswerFromInboxIsUsedImmediatelyAndDoesNotReopenTheGap()
    {
        const string question = "كم يساوي اثنان زائد اثنين؟";
        const string expectedAnswer = "اثنان زائد اثنين يساوي أربعة.";
        var embedded = new WesalKnowledgeService();
        var dynamicKnowledge = new HybridWesalKnowledgeService(
            embedded, _repository, Clock, NullLogger<HybridWesalKnowledgeService>.Instance);
        var recorder = new AiKnowledgeGapRecorder(_repository, Clock);
        var assistant = new MabroukHarness(
            gapRecorder: recorder,
            gapDetector: new AiKnowledgeGapDetector(),
            knowledgeService: dynamicKnowledge);
        var studio = StudioService();

        var first = await assistant.AskAsync(question);
        Assert.Equal(AiAssistantResponseKind.Answer, first.Kind);
        var gap = Assert.Single(await studio.ListGapsAsync());
        Assert.Equal(question, gap.CanonicalQuestion);

        var draft = await studio.CreateArticleFromGapAsync(gap.Id, "admin-1");
        Assert.NotNull(draft);
        var input = new AiKnowledgeArticleInput(
            draft.Key,
            "إجابة مسألة اثنين زائد اثنين",
            "mabrouk",
            expectedAnswer,
            "Two plus two equals four.",
            draft.Source,
            10,
            AiKnowledgeVerificationStatus.Verified,
            null,
            null,
            null,
            null,
            draft.Aliases.Select(alias => new AiKnowledgeAliasInput(alias.Language, alias.Text)).ToList(),
            "Verified answer from the unanswered inbox.");
        await studio.UpdateKnowledgeAsync(draft.Id, input, "admin-1");
        await studio.PublishKnowledgeAsync(draft.Id, "Publish the verified answer.", "admin-1");

        Assert.Empty(await studio.ListGapsAsync());
        var second = await assistant.AskAsync(question);
        Assert.Contains(expectedAnswer, second.Message, StringComparison.Ordinal);
        Assert.Empty(await studio.ListGapsAsync());
    }

    [Fact]
    public async Task ComingSoonCapabilityQuestionIsAnsweredWithoutRecordingAGap()
    {
        const string question = "هل يوجد مستشار زفاف معتمد لدى وصال؟";
        var recording = RecordingHarness(out _);

        var response = await recording.AskAsync(question);

        Assert.Equal(AiAssistantResponseKind.Answer, response.Kind);
        Assert.Contains("قيد التجهيز", response.Message);
        Assert.Empty(await StudioService().ListGapsAsync());
    }

    [Fact]
    public async Task ThrowingRecorderKeepsResponseIdentical()
    {
        const string unknown = "كم يساوي اثنان زائد اثنين؟";
        var plain = new MabroukHarness();
        var throwing = new Mock<IAiKnowledgeGapRecorder>();
        throwing.Setup(recorder => recorder.RecordAsync(It.IsAny<AiKnowledgeGapCandidate>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("inbox is down"));
        var fragile = new MabroukHarness(gapRecorder: throwing.Object, gapDetector: new AiKnowledgeGapDetector());

        var baseline = await plain.AskAsync(unknown);
        var survived = await fragile.AskAsync(unknown);

        Assert.Equal(baseline.Message, survived.Message);
        Assert.Equal(AiAssistantResponseKind.Answer, survived.Kind);
    }

    [Fact]
    public async Task HybridFailureFallsBackToBuiltInKnowledge()
    {
        var failing = new Mock<IAiKnowledgeStudioRepository>();
        failing.Setup(repository => repository.SearchPublishedCandidatesAsync(
                It.IsAny<IReadOnlyList<string>>(), It.IsAny<DateOnly>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("dynamic store is down"));
        var hybrid = new HybridWesalKnowledgeService(
            new WesalKnowledgeService(), failing.Object, Clock, NullLogger<HybridWesalKnowledgeService>.Instance);

        var articles = await hybrid.SearchAsync("شو هي وصال؟", "ar", 3);
        Assert.Contains(articles, article => article.Title == "About Wesal");
    }

    [Fact]
    public async Task KnowledgeValidationRejectsHtmlAndScriptAnswers()
    {
        var studio = StudioService();
        var html = ValidInput("html-reject", "HTML answer", "نص عادي.", "Plain text.");
        html = html with { AnswerAr = "أهلا <script>alert(1)</script>" };
        await Assert.ThrowsAsync<AiKnowledgeStudioException>(() =>
            studio.CreateKnowledgeAsync(html, "admin-1"));

        var script = ValidInput("script-reject", "Script answer", "رابط javascript:open", "See javascript:open");
        await Assert.ThrowsAsync<AiKnowledgeStudioException>(() =>
            studio.CreateKnowledgeAsync(script, "admin-1"));
    }

    [Theory]
    [InlineData("passcode=test-passcode-value", "test-passcode-value")]
    [InlineData("secret=test-secret-value", "test-secret-value")]
    [InlineData("Authorization: Bearer test-auth-value", "test-auth-value")]
    [InlineData("hello\x0001world", "hello\x0001world")]
    public void SanitizerRedactsExtraSensitiveVectors(string input, string secret)
    {
        var safe = AiKnowledgeGapSanitizer.Sanitize(input);
        Assert.DoesNotContain(secret, safe, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SanitizerBoundsLength()
    {
        var safe = AiKnowledgeGapSanitizer.Sanitize(new string('س', 600));
        Assert.True(safe.Length <= 500);
    }

    [Fact]
    public async Task TooShortQuestionIsNeverRecorded()
    {
        var recorder = new AiKnowledgeGapRecorder(_repository, Clock);
        Assert.Null(await recorder.RecordAsync(
            new AiKnowledgeGapCandidate("ab", "ar", AiKnowledgeGapReason.GenericFallback, "test", null)));
        Assert.Empty(await StudioService().ListGapsAsync());
    }

    private MabroukKnowledgeStudioService StudioService()
    {
        var gemini = new Mock<IGeminiService>();
        gemini.SetupGet(service => service.IsAvailable).Returns(false);
        var assistant = new Mock<IAiAssistantService>();
        var embedded = new WesalKnowledgeService();
        var knowledge = new HybridWesalKnowledgeService(
            embedded, _repository, Clock, NullLogger<HybridWesalKnowledgeService>.Instance);
        return new MabroukKnowledgeStudioService(
            _repository, embedded, knowledge, gemini.Object, assistant.Object, Clock);
    }

    private static AiKnowledgeArticleInput ValidInput(string key, string title, string answerAr, string answerEn)
        => new(key, title, "support", answerAr, answerEn, "Local test source", 10,
            AiKnowledgeVerificationStatus.Verified, null, null, null, null, [], "Local test change note.");

    private static AiConversationState AdvanceLikeController(AiConversationContext context, string message, AiAssistantResponse response)
    {
        if (response.Intent?.Intent == AiIntentType.SearchHalls && response.Halls.Count > 0)
            return AiConversationStateResolver.WithCollectionResults(context.State, AiResponseMemory.ShownHalls(response));
        if (AiReferenceResolver.TryGetOrdinal(message) is { } ordinal)
        {
            IReadOnlyList<Guid> ids = context.LastHalls is { Count: > 0 } halls
                ? halls.Select(hall => hall.HallId).ToList()
                : context.State?.ShownHallIds ?? (IReadOnlyList<Guid>)Array.Empty<Guid>();
            if (ids.Count > (ordinal < 0 ? ids.Count - 1 : ordinal)
                && AiResponseMemory.FocusedHall(response) is { } ordinalHall)
                return AiConversationStateResolver.AdvanceSelection(context.State, ordinalHall, ordinal < 0 ? ids.Count - 1 : ordinal);
        }
        if (AiConversationStateResolver.IsNextResult(message) && AiResponseMemory.FocusedHall(response) is { } nextHall)
            return AiConversationStateResolver.AdvanceSelection(context.State, nextHall, (context.State?.SelectedResultIndex ?? -1) + 1);
        var conversationHall = context.LastHall ?? (context.LastHalls is { Count: 1 } single ? single[0] : null);
        return AiConversationStateResolver.Advance(context.State, message, response, conversationHall);
    }
}
