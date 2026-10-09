using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Ai;

/// <summary>
/// A realistic assistant wired from the REAL deterministic components (policy gate,
/// context resolver, knowledge base, how-to, recommendation, classifier, gateway,
/// orchestrator) over fake data sources, so scenarios exercise the same code paths as
/// production with Gemini on (scripted) or off.
/// </summary>
internal sealed class MabroukHarness
{
    public static readonly DateTimeOffset Now = new(2026, 10, 1, 9, 0, 0, TimeSpan.Zero); // Thursday

    public Guid NakheelId { get; } = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public Guid OrchidId { get; } = Guid.Parse("22222222-2222-2222-2222-222222222222");

    public FakeHallDetails Details { get; } = new();
    public FakeHallSearch Search { get; } = new();
    public FakeHourlySlotService Slots { get; } = new();
    public ScriptedGemini Gemini { get; } = new();
    public FakeClock Clock { get; } = new() { Now = Now };
    public AiAssistantService Service { get; }
    public AiContextResolver ContextResolver { get; }

    public MabroukHarness(bool geminiAvailable = false)
    {
        Gemini.Available = geminiAvailable;

        Details.Add(Hall(NakheelId, "قاعة النخيل", "غزة", "حي الرمال", 400, 7000m, ["تكييف", "موقف سيارات"]));
        Details.Add(Hall(OrchidId, "قاعة الأوركيد", "غزة", "النصر", 250, 5000m, []));

        Search.Items =
        [
            new HallListItemDto { HallId = NakheelId, HallName = "قاعة النخيل", Region = "Gaza", Address = "حي الرمال", Capacity = 400, Price = 7000m },
            new HallListItemDto { HallId = OrchidId, HallName = "قاعة الأوركيد", Region = "Gaza", Address = "النصر", Capacity = 250, Price = 5000m }
        ];

        var detector = new AiLanguageDetector();
        var criteria = new NaturalLanguageCriteriaExtractor();
        var knowledge = new WesalKnowledgeService();
        var payment = new SubscriptionPaymentService(Options.Create(new SubscriptionPaymentOptions()));
        var clock = new AiClock(Clock);

        var gateway = new WesalToolGateway(Search, Details, Slots, NullLogger<WesalToolGateway>.Instance);
        var orchestrator = new GeminiToolOrchestrator(
            Gemini, gateway, knowledge, detector, Options.Create(new GoogleAiSettings()), NullLogger<GeminiToolOrchestrator>.Instance);

        var extractor = new GeminiAiIntentExtractor(
            new OfflineGemini(), detector, new AiIntentFallbackClassifier(criteria), NullLogger<GeminiAiIntentExtractor>.Instance);

        ContextResolver = new AiContextResolver(Details, clock, NullLogger<AiContextResolver>.Instance);

        Service = new AiAssistantService(
            extractor,
            new HowToService(payment, detector, null, null, knowledge),
            new RecommendationService(criteria, new HallRecommendationMatcher(Search), detector),
            new EmptyFeatured(),
            Details,
            Search,
            Slots,
            detector,
            orchestrator,
            ContextResolver,
            new AiAssistantPolicyGate(payment, knowledge),
            NullLogger<AiAssistantService>.Instance);
    }

    public Task<AiAssistantResponse> AskAsync(
        string message,
        string language = "ar",
        string? pathname = null,
        Guid? pinnedHall = null,
        string? pinnedRaw = null,
        AiConversationContext? conversation = null)
    {
        var entity = pinnedRaw is not null
            ? new AiEntityContextDto("hall", pinnedRaw)
            : pinnedHall is { } id ? new AiEntityContextDto("hall", id.ToString()) : null;
        var page = pathname is null ? null : new AiPageContextDto(pathname);

        return Service.ProcessMessageAsync(
            message,
            language,
            CancellationToken.None,
            conversation,
            new AiRequestContext(page, entity));
    }

    public static HallDetailsDto Hall(Guid id, string name, string region, string address, int capacity, decimal? price, IReadOnlyList<string> features)
        => new()
        {
            HallId = id,
            HallName = name,
            Region = region,
            Address = address,
            Description = "قاعة أنيقة",
            Capacity = capacity,
            Price = price,
            ShowPrice = price is not null,
            Features = features,
            Status = HallStatus.Approved,
            Photos = [new HallImageDto { Id = Guid.NewGuid(), Url = "/uploads/a.png", DisplayOrder = 1 }]
        };

    // ───────────────────────── fakes ─────────────────────────

    internal sealed class FakeClock : IDateTime
    {
        public DateTimeOffset Now { get; set; }
    }

    internal sealed class FakeHallDetails : IHallDetailsService
    {
        private readonly Dictionary<Guid, HallDetailsDto> _halls = [];
        public List<Guid> Requested { get; } = [];

        public void Add(HallDetailsDto hall) => _halls[hall.HallId] = hall;

        public Task<HallDetailsDto> GetHallDetailsAsync(Guid hallId, CancellationToken cancellationToken = default)
        {
            Requested.Add(hallId);
            return _halls.TryGetValue(hallId, out var hall)
                ? Task.FromResult(hall)
                : throw new NotFoundException("Hall", hallId);
        }
    }

    internal sealed class FakeHallSearch : IHallSearchService
    {
        public IReadOnlyList<HallListItemDto> Items { get; set; } = [];
        public List<HallSearchRequest> Requests { get; } = [];

        public Task<PagedResult<HallListItemDto>> SearchHallsAsync(HallSearchRequest request, CancellationToken cancellationToken = default)
        {
            Requests.Add(request);
            IEnumerable<HallListItemDto> query = Items;

            if (!string.IsNullOrWhiteSpace(request.Name))
            {
                query = query.Where(h => h.HallName.Contains(request.Name!, StringComparison.OrdinalIgnoreCase));
            }

            if (request.Region is { } region)
            {
                query = query.Where(h => string.Equals(h.Region, region.ToString(), StringComparison.OrdinalIgnoreCase));
            }

            if (request.MinimumCapacity is { } minimumCapacity)
            {
                query = query.Where(h => h.Capacity >= minimumCapacity);
            }

            var list = query.ToList();
            return Task.FromResult(new PagedResult<HallListItemDto>(list, 1, request.PageSize, list.Count));
        }
    }

    internal sealed class EmptyFeatured : IFeaturedHallsService
    {
        public Task<IReadOnlyList<FeaturedHallDto>> GetFeaturedHallsAsync(HallRegion? region = null, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<FeaturedHallDto>>([]);
    }

    internal sealed class OfflineGemini : IGeminiService
    {
        public bool IsAvailable => false;
        public Task<string?> GenerateTextAsync(string prompt, string language, CancellationToken cancellationToken = default) => Task.FromResult<string?>(null);

        public Task<T?> GenerateStructuredAsync<T>(string prompt, string systemInstruction, JsonNode responseSchema, CancellationToken cancellationToken = default)
            where T : class => Task.FromResult<T?>(null);
    }

    internal sealed class ScriptedGemini : IGeminiToolCallService
    {
        public bool Available { get; set; }
        public Queue<GeminiToolTurn?> Script { get; } = new();
        public List<(IReadOnlyList<GeminiConversationMessage> Contents, string System)> Calls { get; } = [];
        public bool IsAvailable => Available;

        public Task<GeminiToolTurn?> GenerateToolTurnAsync(
            IReadOnlyList<GeminiConversationMessage> contents,
            string systemInstruction,
            IReadOnlyList<GeminiFunctionDeclaration> functions,
            CancellationToken cancellationToken = default)
        {
            Calls.Add((contents.ToList(), systemInstruction));
            return Task.FromResult(Script.Count > 0 ? Script.Dequeue() : null);
        }
    }
}
