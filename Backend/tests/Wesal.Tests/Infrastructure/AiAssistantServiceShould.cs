using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Infrastructure.Halls;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

public class AiAssistantServiceShould
{
    private readonly FakeIntentExtractor _extractor = new();
    private readonly FakeHowToService _howTo = new();
    private readonly FakeRecommendationService _recommendation = new();
    private readonly FakeFeaturedHallsService _featured = new();
    private readonly FakeHallDetailsService _details = new();
    private readonly FakeHourlySlotService _availability = new();
    private readonly FakeHallRepository _repository = new();
    private readonly FakeDateTime _dateTime = new();
    private readonly FakeGeminiToolOrchestrator _orchestrator = new();

    private AiAssistantService CreateService()
        => new(
            _extractor,
            _howTo,
            _recommendation,
            _featured,
            _details,
            new HallSearchService(_repository),
            _availability,
            new AiLanguageDetector(),
            _dateTime,
            _orchestrator,
            NullLogger<AiAssistantService>.Instance);

    [Fact]
    public async Task HowToIntent_ReturnsAnswerKind()
    {
        _extractor.Result = With(AiIntentType.HowTo);
        _howTo.Answer = "Open the search page to find halls.";

        var result = await CreateService().ProcessMessageAsync("how do I search?", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Answer, result.Kind);
        Assert.Equal("Open the search page to find halls.", result.Message);
        Assert.Empty(result.Halls);
        Assert.Null(result.HallDetails);
        Assert.Null(result.Availability);
    }

    [Fact]
    public async Task SearchHalls_Success_ReturnsHallsKind()
    {
        _extractor.Result = With(AiIntentType.SearchHalls);
        _recommendation.Response = new RecommendationResponse(
            RecommendationStatus.Success,
            new ExtractedCriteriaDto("Gaza", null, null, 250),
            [new HallRecommendationDto(Guid.NewGuid(), "Gaza Grand Hall", "Gaza", "Center", 300, 1500, null, true, null)],
            "I found 1 hall(s) matching your criteria.",
            "en",
            DateTime.UtcNow);

        var result = await CreateService().ProcessMessageAsync("I need a hall in Gaza", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Halls, result.Kind);
        Assert.Single(result.Halls);
        Assert.Equal("Gaza Grand Hall", result.Halls[0].HallName);
        Assert.Contains("found 1", result.Message);
    }

    [Fact]
    public async Task SearchHalls_IncompleteCriteria_ReturnsClarification()
    {
        _extractor.Result = With(AiIntentType.SearchHalls);
        _recommendation.Response = new RecommendationResponse(
            RecommendationStatus.IncompleteCriteria,
            null,
            [],
            "I need a bit more detail...",
            "en",
            DateTime.UtcNow);

        var result = await CreateService().ProcessMessageAsync("hello", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Clarification, result.Kind);
    }

    [Fact]
    public async Task SearchHalls_NoResults_ReturnsAnswer()
    {
        _extractor.Result = With(AiIntentType.SearchHalls);
        _recommendation.Response = new RecommendationResponse(
            RecommendationStatus.NoResults,
            null,
            [],
            "I couldn't find a hall matching your criteria right now.",
            "en",
            DateTime.UtcNow);

        var result = await CreateService().ProcessMessageAsync("need 5000 capacity", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Answer, result.Kind);
        Assert.Empty(result.Halls);
    }

    [Fact]
    public async Task SearchHalls_AiUnavailable_ReturnsError()
    {
        _extractor.Result = With(AiIntentType.SearchHalls);
        _recommendation.Response = new RecommendationResponse(
            RecommendationStatus.AiUnavailable,
            null,
            [],
            "The recommendation service is temporarily unavailable. Please try again later.",
            "en",
            DateTime.UtcNow);

        var result = await CreateService().ProcessMessageAsync("find halls", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Error, result.Kind);
    }

    [Fact]
    public async Task Featured_ReturnsHallsKind()
    {
        _extractor.Result = With(AiIntentType.GetFeaturedHalls, region: "Gaza");
        _featured.Result = new List<FeaturedHallDto>
        {
            new FeaturedHallDto { HallId = Guid.NewGuid(), HallName = "Gaza Grand Hall", Region = "Gaza", Address = "Center", Capacity = 300, Price = 1500, MainImage = "img.jpg" }
        };

        var result = await CreateService().ProcessMessageAsync("show me featured halls in Gaza", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Halls, result.Kind);
        var hall = Assert.Single(result.Halls);
        Assert.Equal("Gaza Grand Hall", hall.HallName);
        Assert.True(hall.IsAvailable);
    }

    [Fact]
    public async Task Featured_Empty_StillReturnsHallsKindWithGuidance()
    {
        _extractor.Result = With(AiIntentType.GetFeaturedHalls);
        _featured.Result = [];

        var result = await CreateService().ProcessMessageAsync("featured halls please", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Halls, result.Kind);
        Assert.Empty(result.Halls);
        Assert.Contains("no featured halls", result.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task HallDetails_ResolvesHall_ReturnsHallDetailsKind()
    {
        _extractor.Result = With(AiIntentType.GetHallDetails, hallName: "Grand Hall");
        _repository.ApprovedHallResults = [new Hall { Id = HallId, Name = "Grand Hall", Status = HallStatus.Approved, IsDeleted = false }];
        _details.Result = new HallDetailsDto { HallId = HallId, HallName = "Grand Hall", Capacity = 300 };

        var result = await CreateService().ProcessMessageAsync("tell me about Grand Hall", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.HallDetails, result.Kind);
        Assert.NotNull(result.HallDetails);
        Assert.Equal(HallId, result.HallDetails!.HallId);
        Assert.Contains("Grand Hall", result.Message);
    }

    [Fact]
    public async Task HallDetails_NoHallName_ReturnsClarification()
    {
        _extractor.Result = With(AiIntentType.GetHallDetails);

        var result = await CreateService().ProcessMessageAsync("tell me about the hall", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Clarification, result.Kind);
    }

    [Fact]
    public async Task HallDetails_HallNotFound_ReturnsClarification()
    {
        _extractor.Result = With(AiIntentType.GetHallDetails, hallName: "Ghost Hall");
        _repository.ApprovedHallResults = [];

        var result = await CreateService().ProcessMessageAsync("tell me about Ghost Hall", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Clarification, result.Kind);
        Assert.Contains("Ghost Hall", result.Message);
    }

    [Fact]
    public async Task HallDetails_NotFoundFromService_ReturnsClarification()
    {
        _extractor.Result = With(AiIntentType.GetHallDetails, hallName: "Grand Hall");
        _repository.ApprovedHallResults = [new Hall { Id = HallId, Name = "Grand Hall", Status = HallStatus.Approved, IsDeleted = false }];
        _details.ThrowNotFound = true;

        var result = await CreateService().ProcessMessageAsync("tell me about Grand Hall", "ar", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Clarification, result.Kind);
    }

    [Fact]
    public async Task Availability_ReturnsAvailabilityKind_WithRealSlotStatuses()
    {
        _extractor.Result = With(AiIntentType.CheckHallAvailability, hallName: "Grand Hall", date: FutureDate);
        _repository.ApprovedHallResults = [new Hall { Id = HallId, Name = "Grand Hall", Status = HallStatus.Approved, IsDeleted = false }];
        _availability.Response = new HallHourlyCatalogDto
        {
            HallId = HallId,
            Date = FutureDate,
            DayOpen = true,
            Slots =
            [
                new HallHourlySlotDto { StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(11, 0), Status = HallSlotStatus.Available },
                new HallHourlySlotDto { StartTime = new TimeOnly(18, 0), EndTime = new TimeOnly(19, 0), Status = HallSlotStatus.Booked }
            ]
        };

        var result = await CreateService().ProcessMessageAsync("is Grand Hall available on 2026-12-01 in the evening?", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Availability, result.Kind);
        Assert.NotNull(result.Availability);
        Assert.Equal(FutureDate, result.Availability!.Date);
        Assert.Equal(2, result.Availability.Slots.Count);

        var first = result.Availability.Slots.Single(s => s.StartTime == new TimeOnly(10, 0));
        var second = result.Availability.Slots.Single(s => s.StartTime == new TimeOnly(18, 0));
        Assert.Equal(HallSlotStatus.Available, first.Status);
        Assert.Equal(HallSlotStatus.Booked, second.Status);
    }

    [Fact]
    public async Task Availability_MissingDate_ReturnsClarification()
    {
        _extractor.Result = With(AiIntentType.CheckHallAvailability, hallName: "Grand Hall");

        var result = await CreateService().ProcessMessageAsync("when is Grand Hall available?", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Clarification, result.Kind);
    }

    [Fact]
    public async Task Availability_PastDate_ReturnsClarification()
    {
        _extractor.Result = With(AiIntentType.CheckHallAvailability, hallName: "Grand Hall", date: PastDate);
        _repository.ApprovedHallResults = [new Hall { Id = HallId, Name = "Grand Hall", Status = HallStatus.Approved, IsDeleted = false }];

        var result = await CreateService().ProcessMessageAsync("was Grand Hall available yesterday?", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Clarification, result.Kind);
    }

    [Fact]
    public async Task Availability_HallNotFound_ReturnsClarification()
    {
        _extractor.Result = With(AiIntentType.CheckHallAvailability, hallName: "Ghost Hall", date: FutureDate);
        _repository.ApprovedHallResults = [];

        var result = await CreateService().ProcessMessageAsync("is Ghost Hall available?", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Clarification, result.Kind);
    }

    [Fact]
    public async Task UnsupportedIntent_ReturnsUnsupportedKind()
    {
        _extractor.Result = With(AiIntentType.Unsupported);

        var result = await CreateService().ProcessMessageAsync("book a hall for me", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Unsupported, result.Kind);
    }

    [Fact]
    public async Task UnknownIntent_ReturnsClarification()
    {
        _extractor.Result = With(AiIntentType.Unknown);

        var result = await CreateService().ProcessMessageAsync("zzzz", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Clarification, result.Kind);
    }

    [Fact]
    public async Task EmptyMessage_ThrowsArgumentException()
    {
        var service = CreateService();

        await Assert.ThrowsAsync<ArgumentException>(() => service.ProcessMessageAsync("   ", "en", CancellationToken.None));
    }

    [Fact]
    public async Task OverLongMessage_ThrowsArgumentException()
    {
        var service = CreateService();

        await Assert.ThrowsAsync<ArgumentException>(() => service.ProcessMessageAsync(new string('a', AiAssistantService.MaxMessageLength + 1), "en", CancellationToken.None));
    }

    [Fact]
    public async Task TrimsMessage_BeforeExtraction()
    {
        string? captured = null;
        _extractor.OnExtract = message => captured = message;
        _extractor.Result = With(AiIntentType.HowTo);

        await CreateService().ProcessMessageAsync("  how do I search?  ", "en", CancellationToken.None);

        Assert.Equal("how do I search?", captured);
    }

    [Fact]
    public async Task ArabicMessage_FlowsArabicResponseLanguage()
    {
        _extractor.Result = With(AiIntentType.Unknown);

        var result = await CreateService().ProcessMessageAsync("مرحباً", null, CancellationToken.None);

        Assert.Equal("ar", result.ResponseLanguage);
    }

    [Fact]
    public async Task Orchestrator_ReturnsLargeResponseKind()
    {
        _extractor.Result = With(AiIntentType.HowTo);
        _orchestrator.Result = new WesalToolOrchestrationResult(
            true,
            "Grand Hall is available on Saturday from 6 PM to 10 PM.",
            "en",
            [],
            DateTime.UtcNow);

        var result = await CreateService().ProcessMessageAsync("when is Grand Hall available?", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Answer, result.Kind);
        Assert.Equal("Grand Hall is available on Saturday from 6 PM to 10 PM.", result.Message);
        Assert.Empty(result.Halls);
        Assert.Null(result.HallDetails);
        Assert.Null(result.Availability);
        Assert.Null(result.Intent);
        Assert.Equal(1, _orchestrator.Invocations);
    }

    [Fact]
    public async Task OrchestratorWinsOverIntentExtractor()
    {
        _extractor.Result = With(AiIntentType.Unsupported);
        _orchestrator.Result = new WesalToolOrchestrationResult(
            true,
            "Here are 3 matching halls in Gaza.",
            "en",
            [],
            DateTime.UtcNow);

        var result = await CreateService().ProcessMessageAsync("find me a hall in Gaza", "en", CancellationToken.None);

        // The orchestrator is the primary path: the deterministic intent
        // extractor must never run when the orchestrator succeeds.
        Assert.Equal(AiAssistantResponseKind.Answer, result.Kind);
        Assert.Equal("Here are 3 matching halls in Gaza.", result.Message);
        Assert.Equal(0, _extractor.CallCount);
    }

    [Fact]
    public async Task Orchestrator_ReturnsArabicAnswer_FlowsArabicResponseLanguage()
    {
        _orchestrator.Result = new WesalToolOrchestrationResult(
            true,
            "قاعة السلام متاحة يوم السبت.",
            "ar",
            [],
            DateTime.UtcNow);

        var result = await CreateService().ProcessMessageAsync("هل قاعة السلام متاحة؟", "ar", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Answer, result.Kind);
        Assert.Equal("ar", result.ResponseLanguage);
        Assert.Equal("قاعة السلام متاحة يوم السبت.", result.Message);
    }

    [Fact]
    public async Task OrchestratorThrows_FallsBackToDeterministicPath()
    {
        _extractor.Result = With(AiIntentType.HowTo);
        _howTo.Answer = "Open the search page to find halls.";
        _orchestrator.Exception = new InvalidOperationException("orchestrator exploded");

        var result = await CreateService().ProcessMessageAsync("how do I search?", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Answer, result.Kind);
        Assert.Equal("Open the search page to find halls.", result.Message);
        Assert.NotNull(result.Intent);
        Assert.Equal(AiIntentType.HowTo, result.Intent!.Intent);
    }

    [Fact]
    public async Task Orchestrator_SuccessFalse_FallsBackToDeterministicPath()
    {
        _extractor.Result = With(AiIntentType.GetFeaturedHalls, region: "Gaza");
        _featured.Result = new List<FeaturedHallDto>
        {
            new FeaturedHallDto { HallId = Guid.NewGuid(), HallName = "Gaza Grand Hall", Region = "Gaza", Address = "Center", Capacity = 300, Price = 1500, MainImage = "img.jpg" }
        };
        _orchestrator.Result = new WesalToolOrchestrationResult(
            false,
            "",
            "en",
            [],
            DateTime.UtcNow);

        var result = await CreateService().ProcessMessageAsync("show me featured halls in Gaza", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Halls, result.Kind);
        Assert.Single(result.Halls);
        Assert.NotNull(result.Intent);
    }

    [Fact]
    public async Task Orchestrator_BlankAnswer_FallsBackToDeterministicPath()
    {
        _extractor.Result = With(AiIntentType.HowTo);
        _howTo.Answer = "Deterministic fallback answer.";
        _orchestrator.Result = new WesalToolOrchestrationResult(
            true,
            "   ",
            "en",
            [],
            DateTime.UtcNow);

        var result = await CreateService().ProcessMessageAsync("how do I search?", "en", CancellationToken.None);

        Assert.Equal(AiAssistantResponseKind.Answer, result.Kind);
        Assert.Equal("Deterministic fallback answer.", result.Message);
    }

    [Fact]
    public async Task Orchestrator_ReceivesNormalizedMessageAndLanguage()
    {
        string? capturedMessage = null;
        string? capturedLanguage = null;
        _orchestrator.OnExecute = (message, language, ct, context) =>
        {
            capturedMessage = message;
            capturedLanguage = language;
        };
        _orchestrator.Result = new WesalToolOrchestrationResult(
            true,
            "ok",
            "ar",
            [],
            DateTime.UtcNow);

        await CreateService().ProcessMessageAsync("  كيف أبحث عن قاعة؟  ", "en", CancellationToken.None);

        Assert.Equal("كيف أبحث عن قاعة؟", capturedMessage);
        // Arabic message overrides the fallback en language, matching the
        // deterministic path behavior.
        Assert.Equal("ar", capturedLanguage);
    }

    private Guid HallId { get; } = Guid.NewGuid();

    [Fact]
    public void MergeWithContext_NoPriorSearch_ReturnsIntentUnchanged()
    {
        var intent = With(AiIntentType.SearchHalls, region: "Gaza", date: null);

        var result = AiAssistantService.MergeWithContext(intent, null);

        Assert.Same(intent, result);
    }

    [Fact]
    public void MergeWithContext_PriorSearchCarriesForwardMissingCriteria()
    {
        var prior = With(AiIntentType.SearchHalls, region: "Gaza", date: new DateOnly(2026, 12, 1));
        var context = new AiConversationContext(
            [new AiConversationTurn("user", "أريد قاعة في غزة بتاريخ 2026-12-01")],
            prior);

        // Follow-up only adds a new region refinement; date from prior should be kept.
        var followUp = new AiAssistantIntentDto(
            AiIntentType.SearchHalls, "SouthGaza", null, null, null, null);

        var result = AiAssistantService.MergeWithContext(followUp, context);

        Assert.Equal(AiIntentType.SearchHalls, result.Intent);
        Assert.Equal("SouthGaza", result.Region);
        Assert.Equal(new DateOnly(2026, 12, 1), result.Date);
    }

    [Fact]
    public void MergeWithContext_ExplicitValueWinsOverPrior()
    {
        var prior = With(AiIntentType.SearchHalls, region: "Gaza", date: null);
        var context = new AiConversationContext(
            [new AiConversationTurn("user", "أريد قاعة في غزة")],
            prior);

        var followUp = new AiAssistantIntentDto(
            AiIntentType.SearchHalls, "Gaza", null, new DateOnly(2026, 11, 5), 400, null);

        var result = AiAssistantService.MergeWithContext(followUp, context);

        Assert.Equal(new DateOnly(2026, 11, 5), result.Date);
        Assert.Equal(400, result.Capacity);
    }

    [Fact]
    public void MergeWithContext_NonSearchIntent_Unchanged()
    {
        var prior = With(AiIntentType.SearchHalls, region: "Gaza", date: null);
        var context = new AiConversationContext([new AiConversationTurn("user", "أريد قاعة")], prior);

        var howTo = With(AiIntentType.HowTo);

        var result = AiAssistantService.MergeWithContext(howTo, context);

        Assert.Equal(AiIntentType.HowTo, result.Intent);
        Assert.Null(result.Region);
    }
    private DateOnly FutureDate => DateOnly.FromDateTime(_dateTime.Now.UtcDateTime).AddDays(7);
    private DateOnly PastDate => DateOnly.FromDateTime(_dateTime.Now.UtcDateTime).AddDays(-7);

    private static AiAssistantIntentDto With(
        AiIntentType intent,
        string? region = null,
        string? hallName = null,
        DateOnly? date = null)
        => new(intent, region, null, date, null, hallName);

    private sealed class FakeIntentExtractor : IAiIntentExtractor
    {
        public AiAssistantIntentDto Result { get; set; } = new(AiIntentType.Unknown, null, null, null, null, null);
        public Action<string?>? OnExtract { get; set; }
        public int CallCount { get; private set; }

        public Task<AiAssistantIntentDto> ExtractAsync(string message, string? language, CancellationToken cancellationToken = default, AiConversationContext? context = null)
        {
            CallCount++;
            OnExtract?.Invoke(message);
            return Task.FromResult(Result);
        }
    }

    private sealed class FakeGeminiToolOrchestrator : IGeminiToolOrchestrator
    {
        public WesalToolOrchestrationResult Result { get; set; } = new(false, string.Empty, "ar", [], DateTime.UtcNow);
        public Exception? Exception { get; set; }
        public int Invocations { get; private set; }
        public Action<string?, string?, CancellationToken, AiConversationContext?>? OnExecute { get; set; }

        public Task<WesalToolOrchestrationResult> ExecuteAsync(string message, string? language, CancellationToken cancellationToken = default, AiConversationContext? context = null)
        {
            Invocations++;
            OnExecute?.Invoke(message, language, cancellationToken, context);

            if (Exception is not null)
            {
                throw Exception;
            }

            return Task.FromResult(Result);
        }
    }

    private sealed class FakeHowToService : IHowToService
    {
        public string Answer { get; set; } = string.Empty;

        public Task<HowToResponse> AskHowToAsync(string question, string? language, CancellationToken cancellationToken = default)
            => Task.FromResult(new HowToResponse(Answer, "general", language ?? "ar", DateTime.UtcNow));
    }

    private sealed class FakeRecommendationService : IRecommendationService
    {
        public RecommendationResponse Response { get; set; } = new(
            RecommendationStatus.IncompleteCriteria,
            null,
            [],
            string.Empty,
            "en",
            DateTime.UtcNow);

        public Task<RecommendationResponse> GetRecommendationsAsync(string message, string? language, CancellationToken cancellationToken = default)
            => Task.FromResult(Response);
    }

    private sealed class FakeFeaturedHallsService : IFeaturedHallsService
    {
        public IReadOnlyList<FeaturedHallDto> Result { get; set; } = [];

        public Task<IReadOnlyList<FeaturedHallDto>> GetFeaturedHallsAsync(HallRegion? region = null, CancellationToken cancellationToken = default)
            => Task.FromResult(Result);
    }

    private sealed class FakeHallDetailsService : IHallDetailsService
    {
        public HallDetailsDto? Result { get; set; }
        public bool ThrowNotFound { get; set; }

        public Task<HallDetailsDto> GetHallDetailsAsync(Guid hallId, CancellationToken cancellationToken = default)
        {
            if (ThrowNotFound)
            {
                throw new NotFoundException(nameof(Hall), hallId);
            }

            return Task.FromResult(Result!);
        }
    }

    private sealed class FakeHallRepository : IHallRepository
    {
        public IReadOnlyList<Hall> ApprovedHallResults { get; set; } = [];
        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(ApprovedHallResults.FirstOrDefault(h => h.Id == id));

        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default)
            => Task.FromResult(ApprovedHallResults);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(HallRegion region, int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(ApprovedHallResults.Where(h => h.Region == region).ToList());

        public Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult(ApprovedHallResults);

        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(ApprovedHallResults.Count);

        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(string? name, HallRegion? region, string? area, string? detailedAddress, DateOnly? date, TimeOnly? startTime, int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult(ApprovedHallResults);

        public Task<int> SearchApprovedHallsCountAsync(string? name, HallRegion? region, string? area, string? detailedAddress, DateOnly? date, TimeOnly? startTime, CancellationToken cancellationToken = default)
            => Task.FromResult(ApprovedHallResults.Count);

        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallImage>>([]);

    }

    private sealed class FakeDateTime : IDateTime
    {
        public DateTimeOffset Now { get; set; } = DateTimeOffset.UtcNow;
    }
}
