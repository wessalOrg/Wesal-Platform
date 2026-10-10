using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Moq;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Ai;

public sealed class MabroukKnowledgeStudioShould : IDisposable
{
    private readonly ApplicationDbContext _db;
    private readonly AiKnowledgeStudioRepository _repository;
    private readonly WesalKnowledgeService _embedded;
    private readonly HybridWesalKnowledgeService _knowledge;
    private readonly MabroukKnowledgeStudioService _studio;
    private readonly Mock<IGeminiService> _gemini;
    private readonly Mock<IAiAssistantService> _assistant;
    private readonly FixedTimeProvider _clock = new(new DateTimeOffset(2026, 10, 9, 12, 0, 0, TimeSpan.Zero));

    public MabroukKnowledgeStudioShould()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase("MabroukKnowledgeStudio-" + Guid.NewGuid())
            .Options;
        _db = new ApplicationDbContext(options);
        _repository = new AiKnowledgeStudioRepository(_db);
        _embedded = new WesalKnowledgeService();
        _knowledge = new HybridWesalKnowledgeService(_embedded, _repository, _clock);
        _gemini = new Mock<IGeminiService>();
        _gemini.SetupGet(service => service.IsAvailable).Returns(false);
        _assistant = new Mock<IAiAssistantService>();
        _studio = new MabroukKnowledgeStudioService(
            _repository, _embedded, _knowledge, _gemini.Object, _assistant.Object, _clock);
    }

    [Fact]
    public async Task PublishDynamicKnowledgeImmediatelyAndKeepPublishedAnswerUntilRepublish()
    {
        const string question = "Who handles moonbase scheduling?";
        const string key = "moonbase-scheduling";

        Assert.Empty(await _knowledge.SearchAsync(question, "en", 1));

        var draft = await _studio.CreateKnowledgeAsync(Article(
            key, "Moonbase scheduling", question, "المواعيد تُدار من صفحة الخدمة.", "Scheduling is handled from the service page."),
            "admin-1");

        Assert.Empty(await _knowledge.SearchAsync(question, "en", 1));

        var published = await _studio.PublishKnowledgeAsync(draft.Id, "Verified scheduling guidance.", "admin-1");
        Assert.NotNull(published);
        Assert.Equal("Published", published.PublicationStatus);
        Assert.Equal("Scheduling is handled from the service page.",
            Assert.Single(await _knowledge.SearchAsync(question, "en", 1)).Content);

        var pending = Article(key, "Moonbase scheduling", question,
            "راجعوا صفحة الخدمة للمواعيد.", "Check the service page for the schedule.");
        await _studio.UpdateKnowledgeAsync(draft.Id, pending, "admin-1");

        Assert.Equal("Scheduling is handled from the service page.",
            Assert.Single(await _knowledge.SearchAsync(question, "en", 1)).Content);

        await _studio.PublishKnowledgeAsync(draft.Id, "Clarified scheduling guidance.", "admin-1");

        Assert.Equal("Check the service page for the schedule.",
            Assert.Single(await _knowledge.SearchAsync(question, "en", 1)).Content);
    }

    [Fact]
    public async Task KeepMabroukAndWesalTeamFactsDistinct()
    {
        var howTo = new HowToService(Mock.Of<ISubscriptionPaymentService>(), knowledgeService: _knowledge);

        var mabrouk = await howTo.AskHowToAsync("Who developed Mabrouk?", "en", allowModel: false);
        var wesal = await howTo.AskHowToAsync("Who developed Wesal?", "en", allowModel: false);

        Assert.Contains("Abd Alrahman Abu Salem", mabrouk.Answer, StringComparison.Ordinal);
        Assert.Contains("Abdulaziz Al-Khazendar", mabrouk.Answer, StringComparison.Ordinal);
        Assert.DoesNotContain("Mohammed Shama", mabrouk.Answer, StringComparison.Ordinal);
        Assert.Contains("Mohammed Shama", wesal.Answer, StringComparison.Ordinal);
        Assert.DoesNotContain("Abd Alrahman Abu Salem", wesal.Answer, StringComparison.Ordinal);
    }

    [Fact]
    public async Task UseBuiltInTeamAgainAfterDynamicOverrideIsArchived()
    {
        var builtIn = Assert.Single(_embedded.GetArticles(), article => article.Title == "Wesal team");
        var question = "Who developed Wesal?";
        var overrideInput = Article("wesal-team-dynamic-override", "Wesal team", question,
            "فريق وصال هو عبد الرحمن أبو سالم وعبد العزيز الخزندار.",
            "The Wesal team fact in this dynamic override is intentionally temporary.",
            overridesBuiltInKey: builtIn.Key);

        var draft = await _studio.CreateKnowledgeAsync(overrideInput, "admin-1");
        await _studio.PublishKnowledgeAsync(draft.Id, "Approved temporary override.", "admin-1");

        var overridden = Assert.Single(await _knowledge.SearchAsync(question, "en", 1));
        Assert.True(overridden.IsDynamic);
        Assert.Equal("wesal-team-dynamic-override", overridden.StableKey);

        await _studio.ArchiveKnowledgeAsync(draft.Id, "Restore the built-in source.", "admin-1");
        var restored = Assert.Single(await _knowledge.SearchAsync(question, "en", 1));
        Assert.False(restored.IsDynamic);
        Assert.Equal(builtIn.Key, restored.StableKey);
    }

    [Fact]
    public async Task StopAnExpiredDynamicOverrideFromHidingTheBuiltInArticle()
    {
        var builtIn = Assert.Single(_embedded.GetArticles(), article => article.Title == "Wesal team");
        var question = "Who developed Wesal?";
        var expired = Article("expired-wesal-team-override", "Wesal team", question,
            "فريق وصال في مقالة مؤقتة.", "A temporary English team article.",
            overridesBuiltInKey: builtIn.Key,
            effectiveUntil: DateOnly.FromDateTime(_clock.GetUtcNow().UtcDateTime).AddDays(-1));

        var draft = await _studio.CreateKnowledgeAsync(expired, "admin-1");
        await _studio.PublishKnowledgeAsync(draft.Id, "Publish already expired temporary wording.", "admin-1");

        var result = Assert.Single(await _knowledge.SearchAsync(question, "en", 1));
        Assert.False(result.IsDynamic);
        Assert.Equal(builtIn.Key, result.StableKey);
    }

    [Fact]
    public async Task CreateRollbackAsANewImmutableRevision()
    {
        const string question = "Who maintains the silver observatory?";
        var article = await _studio.CreateKnowledgeAsync(
            Article("silver-observatory", "Silver observatory", question,
                "تواصل مع فريق الدعم.", "Contact the support team."),
            "admin-1");
        await _studio.PublishKnowledgeAsync(article.Id, "Publish original answer.", "admin-1");
        var originalPublication = (await _studio.GetRevisionsAsync(article.Id))
            .Where(revision => revision.Action == "Published")
            .OrderBy(revision => revision.Version)
            .First();

        await _studio.UpdateKnowledgeAsync(article.Id, Article(
            "silver-observatory", "Silver observatory", question,
            "راجع مركز المساعدة.", "Visit the help center."), "admin-1");
        await _studio.PublishKnowledgeAsync(article.Id, "Publish changed answer.", "admin-1");

        var rolledBack = await _studio.RollbackAsync(
            article.Id, originalPublication.Id, "Restore the previous approved wording.", "admin-1");

        Assert.NotNull(rolledBack);
        Assert.Equal("Contact the support team.", rolledBack.AnswerEn);
        var revisions = await _studio.GetRevisionsAsync(article.Id);
        Assert.Equal("RolledBack", revisions[0].Action);
        Assert.Contains(revisions, revision => revision.Id == originalPublication.Id);
        Assert.True(revisions.Count >= 5);
    }

    [Fact]
    public async Task KeepUnverifiedLinkedGapsOpenUntilVerifiedKnowledgeIsPublished()
    {
        const string question = "When does the blue observatory open?";
        var recorder = new AiKnowledgeGapRecorder(_repository, _clock);
        var gapId = await recorder.RecordAsync(new AiKnowledgeGapCandidate(
            question, "en", AiKnowledgeGapReason.NoTrustedKnowledge, "test", null));
        Assert.NotNull(gapId);

        var unverified = Article("blue-observatory-hours", "Blue observatory hours", question,
            "مواعيد الافتتاح غير مؤكدة.", "Opening hours are not confirmed.",
            verificationStatus: AiKnowledgeVerificationStatus.NeedsVerification);
        var draft = await _studio.CreateKnowledgeAsync(unverified, "admin-1");
        var linked = await _studio.LinkGapAsync(gapId.Value, draft.Id);
        Assert.Equal("Reviewed", linked!.Status);

        await _studio.PublishKnowledgeAsync(draft.Id, "Publish cautious unverified wording.", "admin-1");
        Assert.Equal("Reviewed", (await _studio.GetGapAsync(gapId.Value))!.Status);

        await _studio.UpdateKnowledgeAsync(draft.Id, unverified with
        {
            VerificationStatus = AiKnowledgeVerificationStatus.Verified,
            AnswerAr = "يفتح المرصد الأزرق الساعة العاشرة صباحًا.",
            AnswerEn = "The Blue Observatory opens at 10 a.m.",
            ChangeNote = "Use verified opening hours."
        }, "admin-1");
        await _studio.PublishKnowledgeAsync(draft.Id, "Publish verified opening hours.", "admin-1");

        var resolved = await _studio.GetGapAsync(gapId.Value);
        Assert.Equal("Resolved", resolved!.Status);
        Assert.NotNull(resolved.ResolvedAt);
    }

    [Fact]
    public async Task RedactSensitiveQuestionDataAndCapSamplesWhileClusteringArabicVariants()
    {
        var jwt = new string('h', 15) + "." + new string('p', 15) + "." + new string('s', 15);
        var sensitive = "What is the policy? Bearer test-bearer-value-123 password=test-password-value api_key=test-api-key-value " +
            jwt + " person@example.com +123 456 789 0123";
        var safe = AiKnowledgeGapSanitizer.Sanitize(sensitive);

        Assert.DoesNotContain("test-bearer-value-123", safe, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("test-password-value", safe, StringComparison.Ordinal);
        Assert.DoesNotContain("test-api-key-value", safe, StringComparison.Ordinal);
        Assert.DoesNotContain(jwt, safe, StringComparison.Ordinal);
        Assert.DoesNotContain("person@example.com", safe, StringComparison.Ordinal);
        Assert.DoesNotContain("456 789 0123", safe, StringComparison.Ordinal);

        var recorder = new AiKnowledgeGapRecorder(_repository, _clock);
        Guid? clusterId = null;
        var variants = new[]
        {
            "مين طوّر مبروك؟",
            "مين طوّر مبروك!",
            "مين طوّر مبروك...",
            "مين طوّر مبروك؟!",
            "مين طوّر مبروك!!",
            "مين طوّر مبروك؟؟"
        };

        foreach (var question in variants)
        {
            clusterId = await recorder.RecordAsync(new AiKnowledgeGapCandidate(
                question, "ar", AiKnowledgeGapReason.NoTrustedKnowledge, "test", null));
        }

        var cluster = await _db.AiKnowledgeGapClusters.SingleAsync();
        Assert.Equal(cluster.Id, clusterId);
        Assert.Equal(variants.Length, cluster.OccurrenceCount);
        Assert.Equal(5, System.Text.Json.JsonSerializer.Deserialize<string[]>(cluster.SampleQuestionsJson)!.Length);

        var sensitiveId = await recorder.RecordAsync(new AiKnowledgeGapCandidate(
            sensitive, "en", AiKnowledgeGapReason.GenericFallback, "test", null));
        var stored = await _db.AiKnowledgeGapClusters.SingleAsync(item => item.Id == sensitiveId);
        Assert.DoesNotContain("test-bearer-value-123", stored.CanonicalQuestion, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("test-password-value", stored.CanonicalQuestion, StringComparison.Ordinal);
        Assert.DoesNotContain("test-api-key-value", stored.CanonicalQuestion, StringComparison.Ordinal);
        Assert.DoesNotContain("person@example.com", stored.CanonicalQuestion, StringComparison.Ordinal);
    }

    [Fact]
    public async Task RunFullAssistantPreviewAsASingleReadOnlyCallWithOptionalContext()
    {
        var hallId = Guid.NewGuid();
        AiRequestContext? capturedContext = null;
        AiConversationContext? capturedConversation = null;
        var response = new AiAssistantResponse(
            AiAssistantResponseKind.Halls,
            "Here are public halls.",
            "en",
            DateTime.UtcNow,
            [],
            null,
            null,
            new AiAssistantIntentDto(AiIntentType.SearchHalls, "Gaza", null, null, null, null));

        _assistant.Setup(service => service.ProcessMessageAsync(
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<AiConversationContext?>(),
                It.IsAny<AiRequestContext?>()))
            .Callback<string, string?, CancellationToken, AiConversationContext?, AiRequestContext?>(
                (_, _, _, conversation, requestContext) =>
                {
                    capturedConversation = conversation;
                    capturedContext = requestContext;
                })
            .ReturnsAsync(response);

        var result = await _studio.SimulateAsync(new AiKnowledgeSimulatorRequest(
            "Find halls in Gaza", "en", FullAssistant: true, PagePath: "/halls", HallId: hallId.ToString()));

        Assert.Equal("Here are public halls.", result.Answer);
        Assert.Equal("Live tool", result.SourceType);
        Assert.Equal("Halls", result.AssistantKind);
        Assert.Null(result.GeminiUsed);
        Assert.Null(result.ProviderCallCount);
        Assert.Null(capturedConversation);
        Assert.Equal("/halls", capturedContext!.Page!.Pathname);
        Assert.Equal("hall", capturedContext.Entity!.Type);
        Assert.Equal(hallId.ToString("D"), capturedContext.Entity.Id);
    }

    [Fact]
    public void RecordOnlyGenericFallbacksAndExplicitNegativeFeedback()
    {
        var detector = new AiKnowledgeGapDetector();

        Assert.True(detector.IsRecordable(AiKnowledgeGapOutcome.GenericNoTrustedAnswer));
        Assert.True(detector.IsRecordable(AiKnowledgeGapOutcome.NegativeFeedback));
        Assert.False(detector.IsRecordable(AiKnowledgeGapOutcome.TrustedAnswer));
        Assert.False(detector.IsRecordable(AiKnowledgeGapOutcome.NoMatchingHalls));
        Assert.False(detector.IsRecordable(AiKnowledgeGapOutcome.NeedsDateClarification));
        Assert.False(detector.IsRecordable(AiKnowledgeGapOutcome.ComingSoonCapability));
        Assert.False(detector.IsRecordable(AiKnowledgeGapOutcome.UnsupportedWriteAction));
        Assert.False(detector.IsRecordable(AiKnowledgeGapOutcome.OperationalFailure));
    }

    [Fact]
    public async Task BlockArticlesThatContradictTheReadOnlyBookingCapability()
    {
        var proposed = Article("assistant-booking-claim", "Booking assistance",
            "Can Mabrouk create a booking?", "مبروك يساعدك في الحجز.",
            "Mabrouk can create bookings automatically.");
        var conflicts = await _studio.CheckConflictsAsync(proposed);

        Assert.False(conflicts.CanPublish);
        Assert.Contains(conflicts.Conflicts, conflict => conflict.Code == "capability-booking-write"
            && conflict.Severity == "block");
    }

    [Fact]
    public async Task KeepGeminiDraftingUnavailableWithoutSavingAnyArticle()
    {
        await Assert.ThrowsAsync<AiKnowledgeStudioException>(() =>
            _studio.CreateAiDraftAsync(new AiKnowledgeDraftRequest("مطورين مبروك عبد الرحمن وعبد العزيز")));

        Assert.Empty(await _studio.ListKnowledgeAsync(new AiKnowledgeListQuery(Source: "dynamic")));
    }

    [Fact]
    public void RestrictStudioControllerToTheExistingAdminPolicy()
    {
        var authorization = Assert.Single(
            typeof(Wesal.API.Controllers.AdminMabroukKnowledgeController)
                .GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
                .Cast<AuthorizeAttribute>());

        Assert.Equal(ApplicationPolicies.RequireAdmin, authorization.Policy);
    }

    private static AiKnowledgeArticleInput Article(
        string key,
        string title,
        string alias,
        string answerAr,
        string answerEn,
        string? overridesBuiltInKey = null,
        DateOnly? effectiveUntil = null,
        AiKnowledgeVerificationStatus verificationStatus = AiKnowledgeVerificationStatus.Verified)
        => new(
            key,
            title,
            "support",
            answerAr,
            answerEn,
            "Admin verified source",
            50,
            verificationStatus,
            null,
            effectiveUntil,
            null,
            overridesBuiltInKey,
            [new AiKnowledgeAliasInput("en", alias)],
            "Initial reviewed draft.");

    public void Dispose() => _db.Dispose();

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
