using System.Diagnostics;
using System.Globalization;
using Microsoft.Extensions.Logging;
using Wesal.Application.Ai;
using Wesal.Application.Ai.Navigation;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Halls;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Unified, application-aware assistant ("Mabrouk"). One turn is resolved in this order,
/// and exactly ONE trusted source answers it:
/// <list type="number">
/// <item><b>Trusted context</b>: the validated page, the pinned/page/ordinal hall (always
/// re-fetched from the live application services) and today's date.</item>
/// <item><b>Policy gate</b> (<see cref="AiAssistantPolicyGate"/>): navigation, services
/// Wesal has no page for, Wesal support, hall-owner subscription, booking payment.</item>
/// <item><b>Hall-context shortcut</b>: price/capacity/location/services/photos/availability
/// questions about the hall in context are answered straight from live hall data by
/// hallId — no search by name, no model round-trip.</item>
/// <item><b>Gemini orchestrator</b>: language understanding + approved live tools + official
/// knowledge, returning structured payloads. If it cannot serve the turn it reports
/// <see cref="AiOrchestrationDisposition.NotHandled"/>.</item>
/// <item><b>Deterministic degradation</b>: intent extraction, search, hall details,
/// availability, how-to/knowledge — fully functional with Gemini completely disabled.</item>
/// </list>
/// All outgoing text is deterministic or model-phrased from grounded data; actions
/// (navigation) are only ever built from <see cref="WesalNavigationRegistry"/>.
/// </summary>
public sealed class AiAssistantService : IAiAssistantService
{
    public const int MaxMessageLength = 2000;
    private const string DefaultLanguage = "ar";
    private const int HallResolutionLimit = 5;

    private readonly IAiIntentExtractor _intentExtractor;
    private readonly IHowToService _howToService;
    private readonly IRecommendationService _recommendationService;
    private readonly IFeaturedHallsService _featuredHallsService;
    private readonly IHallDetailsService _hallDetailsService;
    private readonly IHallSearchService _hallSearchService;
    private readonly IHourlySlotService _hourlySlotService;
    private readonly IAiLanguageDetector _languageDetector;
    private readonly IGeminiToolOrchestrator _toolOrchestrator;
    private readonly AiContextResolver _contextResolver;
    private readonly AiAssistantPolicyGate _policyGate;
    private readonly ILogger<AiAssistantService> _logger;

    private static readonly NaturalLanguageCriteriaExtractor CriteriaExtractor = new();

    public AiAssistantService(
        IAiIntentExtractor intentExtractor,
        IHowToService howToService,
        IRecommendationService recommendationService,
        IFeaturedHallsService featuredHallsService,
        IHallDetailsService hallDetailsService,
        IHallSearchService hallSearchService,
        IHourlySlotService hourlySlotService,
        IAiLanguageDetector? languageDetector,
        IGeminiToolOrchestrator toolOrchestrator,
        AiContextResolver contextResolver,
        AiAssistantPolicyGate policyGate,
        ILogger<AiAssistantService> logger)
    {
        _intentExtractor = intentExtractor;
        _howToService = howToService;
        _recommendationService = recommendationService;
        _featuredHallsService = featuredHallsService;
        _hallDetailsService = hallDetailsService;
        _hallSearchService = hallSearchService;
        _hourlySlotService = hourlySlotService;
        _languageDetector = languageDetector ?? new AiLanguageDetector();
        _toolOrchestrator = toolOrchestrator;
        _contextResolver = contextResolver;
        _policyGate = policyGate;
        _logger = logger;
    }

    public async Task<AiAssistantResponse> ProcessMessageAsync(
        string message,
        string? language,
        CancellationToken cancellationToken = default,
        AiConversationContext? context = null,
        AiRequestContext? requestContext = null)
    {
        var text = message?.Trim();
        if (string.IsNullOrWhiteSpace(text) || text.Length > MaxMessageLength)
        {
            throw new ArgumentException(
                $"Message is required and must not exceed {MaxMessageLength} characters.",
                nameof(message));
        }

        var total = Stopwatch.StartNew();
        var detected = _languageDetector.Detect(text);
        var effectiveLanguage = detected ?? (string.IsNullOrWhiteSpace(language) ? DefaultLanguage : language);

        var stage = Stopwatch.StartNew();
        var turn = await _contextResolver.ResolveAsync(requestContext, context, text, cancellationToken);
        var contextMs = stage.ElapsedMilliseconds;

        var (response, route) = await RouteAsync(text, effectiveLanguage, turn, context, cancellationToken);
        response = WithContextualActions(text, response, turn);

        _logger.LogInformation(
            "Assistant turn: route={Route} kind={Kind} page={PageKey} hallContext={HallSource} actions={Actions} contextMs={ContextMs} totalMs={TotalMs}",
            route,
            response.Kind,
            turn.PageKey ?? "-",
            turn.HallSource ?? "-",
            response.Actions?.Count ?? 0,
            contextMs,
            total.ElapsedMilliseconds);

        return response;
    }

    private async Task<(AiAssistantResponse Response, string Route)> RouteAsync(
        string text,
        string language,
        AiTurnContext turn,
        AiConversationContext? context,
        CancellationToken cancellationToken)
    {
        // 1) Deterministic policies: navigation, unavailable services, support, payments.
        var gate = await _policyGate.TryHandleAsync(text, language, cancellationToken);
        if (gate is not null)
        {
            return (gate, "policy");
        }

        // 2) The hall in context answers its own data questions from live data.
        var hallAnswer = await TryHandleHallContextAsync(text, language, turn, cancellationToken);
        if (hallAnswer is not null)
        {
            return (hallAnswer, "hall-context");
        }

        // 3) Gemini orchestration (structured, tool-grounded).
        var orchestration = await TryOrchestrateAsync(text, language, context, turn, cancellationToken);
        if (orchestration is not null)
        {
            return (orchestration, "gemini");
        }

        // 4) Deterministic degradation: fully functional without any model.
        cancellationToken.ThrowIfCancellationRequested();
        var degraded = await HandleDeterministicAsync(text, language, turn, context, cancellationToken);
        return (degraded, "deterministic");
    }

    private async Task<AiAssistantResponse?> TryOrchestrateAsync(
        string text,
        string language,
        AiConversationContext? context,
        AiTurnContext turn,
        CancellationToken cancellationToken)
    {
        WesalToolOrchestrationResult? result;
        try
        {
            result = await _toolOrchestrator.ExecuteAsync(text, language, cancellationToken, context, turn);
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gemini orchestrator failed unexpectedly; using the deterministic path.");
            return null;
        }

        if (result is null
            || result.Disposition == AiOrchestrationDisposition.NotHandled
            || !result.Success
            || string.IsNullOrWhiteSpace(result.Answer))
        {
            return null;
        }

        var responseLanguage = string.IsNullOrWhiteSpace(result.ResponseLanguage) ? language : result.ResponseLanguage;

        if (result.Availability is { } availability)
        {
            return new AiAssistantResponse(
                AiAssistantResponseKind.Availability,
                result.Answer,
                responseLanguage,
                DateTime.UtcNow,
                Array.Empty<HallRecommendationDto>(),
                null,
                availability,
                new AiAssistantIntentDto(AiIntentType.CheckHallAvailability, null, null, availability.Date, null, availability.HallName));
        }

        if (result.HallDetails is { } details)
        {
            return new AiAssistantResponse(
                AiAssistantResponseKind.HallDetails,
                result.Answer,
                responseLanguage,
                DateTime.UtcNow,
                Array.Empty<HallRecommendationDto>(),
                details,
                null,
                new AiAssistantIntentDto(AiIntentType.GetHallDetails, null, null, null, null, details.HallName));
        }

        if (result.Halls.Count > 0)
        {
            return new AiAssistantResponse(
                AiAssistantResponseKind.Halls,
                result.Answer,
                responseLanguage,
                DateTime.UtcNow,
                result.Halls,
                null,
                null,
                new AiAssistantIntentDto(AiIntentType.SearchHalls, null, null, null, null, null));
        }

        return Build(responseLanguage, AiAssistantResponseKind.Answer, result.Answer, null);
    }

    // ───────────────────────── hall context (pinned / page / ordinal) ─────────────────────────

    private async Task<AiAssistantResponse?> TryHandleHallContextAsync(
        string text,
        string language,
        AiTurnContext turn,
        CancellationToken cancellationToken)
    {
        var hall = turn.Hall;
        if (hall is null)
        {
            return null;
        }

        // An explicitly named hall always beats the pinned/page one.
        if (AiReferenceResolver.TryGetExplicitHallName(text) is not null)
        {
            return null;
        }

        var question = AiHallQuestionClassifier.Classify(text);
        if (question is AiHallQuestion.None or AiHallQuestion.BookingHowTo or AiHallQuestion.ContactOwner)
        {
            return null;
        }

        var name = hall.HallName;
        var intent = new AiAssistantIntentDto(AiIntentType.GetHallDetails, null, null, null, null, name);

        if (question == AiHallQuestion.Availability)
        {
            return await HandleHallAvailabilityAsync(text, language, turn, hall, cancellationToken);
        }

        var message = ComposeHallMessage(question, language, hall);

        var response = Build(language, AiAssistantResponseKind.HallDetails, message, intent, hallDetails: hall);
        if (question == AiHallQuestion.Photos)
        {
            response = response with
            {
                Actions = AiAssistantPolicyGate.NavigateAction(language, WesalNavigationRegistry.HallDetails, AiNavigationMode.Suggest, hall.HallId) is { } open
                    ? [open]
                    : null
            };
        }

        return response;
    }

    private async Task<AiAssistantResponse> HandleHallAvailabilityAsync(
        string text,
        string language,
        AiTurnContext turn,
        HallDetailsDto hall,
        CancellationToken cancellationToken)
    {
        var date = CriteriaExtractor.Extract(text).Date
            ?? AiRelativeDateResolver.Resolve(text, turn.Today);

        var intent = new AiAssistantIntentDto(AiIntentType.CheckHallAvailability, null, null, date, null, hall.HallName);

        if (date is null)
        {
            return Build(language, AiAssistantResponseKind.Clarification, WhichDateMessage(language, hall.HallName), intent);
        }

        if (date.Value < turn.Today)
        {
            return Build(language, AiAssistantResponseKind.Clarification, FutureDateMessage(language), intent);
        }

        var catalog = await _hourlySlotService.GetHourlyCatalogAsync(hall.HallId, date.Value, cancellationToken);
        var message = BuildAvailabilityMessage(language, hall.HallName, date.Value, catalog.DayOpen, catalog.Slots);

        return Build(
            language,
            AiAssistantResponseKind.Availability,
            message,
            intent,
            availability: new AiAssistantAvailabilityDayDto(hall.HallId, hall.HallName, date.Value, catalog.Slots));
    }

    /// <summary>"قاعة X" without doubling the word when the hall's name already starts with it.</summary>
    private static string HallLabel(string language, string name)
    {
        if (language == "en")
        {
            return name;
        }

        var trimmed = name.Trim();
        return trimmed.StartsWith("قاعة", StringComparison.Ordinal) || trimmed.StartsWith("صالة", StringComparison.Ordinal)
            ? trimmed
            : $"قاعة {trimmed}";
    }

    /// <summary>One focused, grounded sentence about the asked fact, built only from live hall data.</summary>
    internal static string ComposeHallMessage(AiHallQuestion question, string language, HallDetailsDto hall)
    {
        var label = HallLabel(language, hall.HallName);
        return question switch
        {
            AiHallQuestion.Price => PriceMessage(language, hall),
            AiHallQuestion.Capacity => language == "en"
                ? $"{label} holds up to {hall.Capacity} guests."
                : $"تتسع {label} لـ {hall.Capacity} شخص.",
            AiHallQuestion.Location => LocationMessage(language, hall),
            AiHallQuestion.Services => ServicesMessage(language, hall),
            AiHallQuestion.Photos => hall.Photos.Count > 0
                ? language == "en"
                    ? $"{label} has {hall.Photos.Count} photo(s). You can see them in the hall's page gallery."
                    : $"لـ{label} {hall.Photos.Count} صورة. تقدر تشوفها في معرض الصور بصفحة القاعة."
                : language == "en"
                    ? $"The owner hasn't added photos for {label} yet."
                    : $"صاحب {label} لم يضف صوراً بعد.",
            AiHallQuestion.Description => string.IsNullOrWhiteSpace(hall.Description)
                ? language == "en" ? $"{label} has no description yet." : $"لا يوجد وصف لـ{label} حتى الآن."
                : hall.Description!.Trim(),
            _ => language == "en"
                ? $"Here are the details for {label}:"
                : $"هذه هي تفاصيل {label}:"
        };
    }

    private static string PriceMessage(string language, HallDetailsDto hall)
    {
        if (hall.Price is not { } price)
        {
            return language == "en"
                ? $"The owner of {hall.HallName} hasn't published a price. Use \"Contact Hall Owner\" on the hall page to ask for it."
                : $"صاحب {HallLabel(language, hall.HallName)} لم يعرض سعراً. استخدم «التواصل مع صاحب القاعة» في صفحة القاعة لمعرفة السعر.";
        }

        var formatted = price.ToString("0.##", CultureInfo.InvariantCulture);
        return language == "en"
            ? $"The price of {hall.HallName} is {formatted} ₪ / day."
            : $"سعر {HallLabel(language, hall.HallName)}: {formatted} ₪ / يوم.";
    }

    private static string LocationMessage(string language, HallDetailsDto hall)
    {
        var parts = new[] { hall.Region, hall.Address, hall.DetailedAddress }
            .Where(part => !string.IsNullOrWhiteSpace(part))
            .Select(part => part!.Trim());
        var where = string.Join(language == "en" ? ", " : "، ", parts);

        return language == "en"
            ? $"{hall.HallName} is located in {where}."
            : $"تقع {HallLabel(language, hall.HallName)} في {where}.";
    }

    private static string ServicesMessage(string language, HallDetailsDto hall)
    {
        var items = hall.Features.Where(f => !string.IsNullOrWhiteSpace(f)).ToList();
        if (!string.IsNullOrWhiteSpace(hall.OtherFeatures))
        {
            items.Add(hall.OtherFeatures!.Trim());
        }

        if (items.Count == 0)
        {
            return language == "en"
                ? $"The owner of {hall.HallName} hasn't listed any services yet."
                : $"صاحب {HallLabel(language, hall.HallName)} لم يضف قائمة خدمات بعد.";
        }

        var list = string.Join(language == "en" ? ", " : "، ", items);
        return language == "en"
            ? $"Services at {hall.HallName}: {list}."
            : $"الخدمات المتوفرة في {HallLabel(language, hall.HallName)}: {list}.";
    }

    // ───────────────────────── contextual actions ─────────────────────────

    /// <summary>
    /// Adds a suggested navigation action to plain answers when it is useful (for example
    /// "كيف أبحث عن صالة؟" → Halls, "كيف أحجزها؟" while a hall is in context → the hall page).
    /// Never overrides actions already chosen, never attaches to data payloads, and the
    /// href always comes from the registry.
    /// </summary>
    private static AiAssistantResponse WithContextualActions(string text, AiAssistantResponse response, AiTurnContext turn)
    {
        if (response.Actions is { Count: > 0 }
            || response.Halls.Count > 0
            || response.HallDetails is not null
            || response.Availability is not null
            || response.Kind is AiAssistantResponseKind.Error or AiAssistantResponseKind.Unsupported)
        {
            return response;
        }

        var language = response.ResponseLanguage;

        if (turn.Hall is { } hall)
        {
            var question = AiHallQuestionClassifier.Classify(text);
            if (question is AiHallQuestion.BookingHowTo or AiHallQuestion.ContactOwner)
            {
                var open = AiAssistantPolicyGate.NavigateAction(language, WesalNavigationRegistry.HallDetails, AiNavigationMode.Suggest, hall.HallId);
                return open is null ? response : response with { Actions = [open] };
            }
        }

        var suggestion = AiNavigationIntentDetector.DetectSuggestion(text);
        if (suggestion is null)
        {
            return response;
        }

        var action = AiAssistantPolicyGate.NavigateAction(language, suggestion.Page.Key, AiNavigationMode.Suggest);
        return action is null ? response : response with { Actions = [action] };
    }

    // ───────────────────────── deterministic degradation ─────────────────────────

    private async Task<AiAssistantResponse> HandleDeterministicAsync(
        string text,
        string language,
        AiTurnContext turn,
        AiConversationContext? context,
        CancellationToken cancellationToken)
    {
        var intent = await _intentExtractor.ExtractAsync(text, language, cancellationToken, context);
        intent = MergeWithContext(intent, context);
        intent = RefineIntent(text, intent, turn);

        // "كم سعرها؟" with no hall in context and no hall named: ask which hall instead of
        // answering from the platform FAQ (which would talk about Wesal's own price).
        var question = AiHallQuestionClassifier.Classify(text);
        if (turn.Hall is null
            && string.IsNullOrWhiteSpace(intent.HallName)
            && intent.Intent is AiIntentType.HowTo or AiIntentType.Unknown
            && question is AiHallQuestion.Price or AiHallQuestion.Capacity or AiHallQuestion.Photos
                or AiHallQuestion.Description or AiHallQuestion.Details or AiHallQuestion.Availability
            && !AiHallQuestionClassifier.MentionsPlatform(text))
        {
            return BuildClarification(language, intent, WhichHallMessage(language));
        }

        return intent.Intent switch
        {
            AiIntentType.HowTo => await HandleHowToAsync(text, language, intent, cancellationToken),
            AiIntentType.SearchHalls => await HandleSearchHallsAsync(text, language, intent, cancellationToken),
            AiIntentType.GetFeaturedHalls => await HandleFeaturedHallsAsync(language, intent, cancellationToken),
            AiIntentType.GetHallDetails => await HandleHallDetailsAsync(language, intent, question, cancellationToken),
            AiIntentType.CheckHallAvailability => await HandleAvailabilityAsync(language, intent, turn.Today, cancellationToken),
            AiIntentType.Unsupported => BuildUnsupported(language, intent),
            _ => BuildClarification(language, intent)
        };
    }

    /// <summary>
    /// Deterministic repairs on top of whatever produced the intent: resolve relative
    /// dates from trusted "today", and turn a named-hall data question into a hall
    /// details / availability intent so it works with Gemini off.
    /// </summary>
    internal static AiAssistantIntentDto RefineIntent(string text, AiAssistantIntentDto intent, AiTurnContext turn)
    {
        var date = intent.Date ?? AiRelativeDateResolver.Resolve(text, turn.Today);
        var hallName = intent.HallName;
        var kind = intent.Intent;

        var named = AiReferenceResolver.TryGetExplicitHallName(text);
        var question = AiHallQuestionClassifier.Classify(text);

        if (named is not null
            && question is not AiHallQuestion.None and not AiHallQuestion.BookingHowTo and not AiHallQuestion.ContactOwner
            && kind is AiIntentType.HowTo or AiIntentType.Unknown or AiIntentType.SearchHalls or AiIntentType.GetHallDetails or AiIntentType.CheckHallAvailability)
        {
            hallName = string.IsNullOrWhiteSpace(hallName) ? named : hallName;
            kind = question == AiHallQuestion.Availability
                ? AiIntentType.CheckHallAvailability
                : AiIntentType.GetHallDetails;
        }

        if (kind == intent.Intent && date == intent.Date && hallName == intent.HallName)
        {
            return intent;
        }

        return new AiAssistantIntentDto(kind, intent.Region, intent.Area, date, intent.Capacity, hallName);
    }

    /// <summary>
    /// When the user is refining a previous hall search (a follow-up expressed with
    /// pronouns or partial criteria, e.g. "300 شخص"), carry forward any search criterion
    /// that was established earlier but is not re-stated this turn. Only applies when both
    /// the current and prior intents are hall searches.
    /// </summary>
    internal static AiAssistantIntentDto MergeWithContext(AiAssistantIntentDto intent, AiConversationContext? context)
    {
        if (context?.LastIntent is not { Intent: AiIntentType.SearchHalls } prior
            || intent.Intent != AiIntentType.SearchHalls)
        {
            return intent;
        }

        var region = intent.Region ?? prior.Region;
        var area = intent.Area ?? prior.Area;
        var date = intent.Date ?? prior.Date;
        var capacity = intent.Capacity ?? prior.Capacity;

        if (region == intent.Region
            && area == intent.Area
            && date == intent.Date
            && capacity == intent.Capacity)
        {
            return intent;
        }

        return new AiAssistantIntentDto(
            intent.Intent,
            region,
            area,
            date,
            capacity,
            intent.HallName);
    }

    private async Task<AiAssistantResponse> HandleHowToAsync(string text, string language, AiAssistantIntentDto intention, CancellationToken cancellationToken)
    {
        // Deterministic only: the orchestrator already tried (and failed to use) Gemini.
        var answer = await _howToService.AskHowToAsync(text, language, cancellationToken, allowModel: false);

        return Build(
            language,
            AiAssistantResponseKind.Answer,
            answer.Answer,
            intention);
    }

    private async Task<AiAssistantResponse> HandleSearchHallsAsync(string text, string language, AiAssistantIntentDto intention, CancellationToken cancellationToken)
    {
        // Search against the MERGED intent (carry-forward from earlier turns), not just the raw text.
        var query = BuildSearchQuery(text, intention);
        var result = await _recommendationService.GetRecommendationsAsync(query, language, cancellationToken);

        return result.Status switch
        {
            RecommendationStatus.Success => Build(
                language,
                AiAssistantResponseKind.Halls,
                result.Message,
                intention,
                halls: result.Recommendations),
            RecommendationStatus.IncompleteCriteria => Build(
                language,
                AiAssistantResponseKind.Clarification,
                result.Message,
                intention),
            RecommendationStatus.NoResults => Build(
                language,
                AiAssistantResponseKind.Answer,
                result.Message,
                intention),
            _ => Build(
                language,
                AiAssistantResponseKind.Error,
                result.Message,
                intention)
        };
    }

    /// <summary>
    /// Appends carried-forward criteria to the user's wording so the recommendation
    /// extractor sees them ("300 شخص" after "قاعات بغزة" searches Gaza for 300).
    /// </summary>
    internal static string BuildSearchQuery(string text, AiAssistantIntentDto intent)
    {
        var extra = new List<string>();
        var already = CriteriaExtractor.Extract(text);

        if (already.Region is null && !string.IsNullOrWhiteSpace(intent.Region))
        {
            extra.Add(intent.Region switch
            {
                "NorthGaza" => "North Gaza",
                "SouthGaza" => "South Gaza",
                "MiddleArea" => "Middle Area",
                _ => "Gaza"
            });
        }

        if (already.Capacity is null && intent.Capacity is { } capacity)
        {
            extra.Add($"for {capacity} people");
        }

        if (already.Date is null && intent.Date is { } date)
        {
            extra.Add(date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        }

        return extra.Count == 0 ? text : $"{text} {string.Join(' ', extra)}";
    }

    private async Task<AiAssistantResponse> HandleFeaturedHallsAsync(string language, AiAssistantIntentDto intention, CancellationToken cancellationToken)
    {
        HallRegion? region = null;
        if (!string.IsNullOrWhiteSpace(intention.Region)
            && Enum.TryParse<HallRegion>(intention.Region, true, out var parsedRegion))
        {
            region = parsedRegion;
        }

        var featured = await _featuredHallsService.GetFeaturedHallsAsync(region, cancellationToken);

        var halls = featured
            .Select(f => new HallRecommendationDto(
                f.HallId,
                f.HallName,
                f.Region,
                f.Address,
                f.Capacity,
                f.Price,
                f.MainImage,
                IsAvailable: true,
                UnavailableReason: null))
            .ToList();

        var regionName = region.HasValue ? HallDisplayNames.GetRegionDisplayName(region.Value) : null;
        var message = featured.Count == 0
            ? language == "en"
                ? "There are no featured halls right now. Use the Browse & Search page to explore all halls."
                : "لا توجد قاعات مميزة حالياً. استخدم صفحة الاستكشاف والبحث لتصفح جميع القاعات."
            : regionName is not null
                ? language == "en"
                    ? $"Here are {featured.Count} featured hall(s) in {regionName}."
                    : $"إليك {featured.Count} قاعة (قاعات) مميزة في {regionName}."
                : language == "en"
                    ? $"Here are {featured.Count} featured hall(s)."
                    : $"إليك {featured.Count} قاعة (قاعات) مميزة.";

        return Build(language, AiAssistantResponseKind.Halls, message, intention, halls: halls);
    }

    private async Task<AiAssistantResponse> HandleHallDetailsAsync(string language, AiAssistantIntentDto intention, AiHallQuestion question, CancellationToken cancellationToken)
    {
        var hallName = intention.HallName;
        if (string.IsNullOrWhiteSpace(hallName))
        {
            return BuildClarification(language, intention: intention, message: WhichHallMessage(language));
        }

        var hall = await TryResolveHallAsync(hallName, cancellationToken);
        if (hall is null)
        {
            return Build(language, AiAssistantResponseKind.Clarification, HallNotFoundMessage(language, hallName), intention);
        }

        HallDetailsDto details;
        try
        {
            details = await _hallDetailsService.GetHallDetailsAsync(hall.HallId, cancellationToken);
        }
        catch (NotFoundException)
        {
            return Build(language, AiAssistantResponseKind.Clarification, HallNotFoundMessage(language, hallName), intention);
        }

        // A named-hall data question ("كم سعر قاعة النخيل؟") gets the focused live fact, not
        // just a generic header.
        var message = ComposeHallMessage(question, language, details);

        return Build(language, AiAssistantResponseKind.HallDetails, message, intention, hallDetails: details);
    }

    private async Task<AiAssistantResponse> HandleAvailabilityAsync(string language, AiAssistantIntentDto intention, DateOnly today, CancellationToken cancellationToken)
    {
        var hallName = intention.HallName;
        if (string.IsNullOrWhiteSpace(hallName))
        {
            return Build(language, AiAssistantResponseKind.Clarification, WhichHallMessage(language), intention);
        }

        if (!intention.Date.HasValue)
        {
            return Build(
                language,
                AiAssistantResponseKind.Clarification,
                WhichDateMessage(language, hallName),
                intention);
        }

        var date = intention.Date.Value;
        if (date < today)
        {
            return Build(
                language,
                AiAssistantResponseKind.Clarification,
                FutureDateMessage(language),
                intention);
        }

        var hall = await TryResolveHallAsync(hallName, cancellationToken);
        if (hall is null)
        {
            return Build(language, AiAssistantResponseKind.Clarification, HallNotFoundMessage(language, hallName), intention);
        }

        var catalog = await _hourlySlotService.GetHourlyCatalogAsync(hall.HallId, date, cancellationToken);
        var message = BuildAvailabilityMessage(language, hall.HallName, date, catalog.DayOpen, catalog.Slots);

        return Build(
            language,
            AiAssistantResponseKind.Availability,
            message,
            intention,
            availability: new AiAssistantAvailabilityDayDto(hall.HallId, hall.HallName, date, catalog.Slots));
    }

    private async Task<HallListItemDto?> TryResolveHallAsync(string hallName, CancellationToken cancellationToken)
    {
        var normalized = hallName.Trim();
        var page = await _hallSearchService.SearchHallsAsync(
            new HallSearchRequest
            {
                Name = normalized,
                PageNumber = 1,
                PageSize = HallResolutionLimit
            },
            cancellationToken);

        if (page.Items.Count == 0)
        {
            return null;
        }

        return page.Items.FirstOrDefault(hall => string.Equals(hall.HallName, normalized, StringComparison.OrdinalIgnoreCase))
            ?? page.Items[0];
    }

    private static string BuildAvailabilityMessage(
        string language,
        string hallName,
        DateOnly date,
        bool dayOpen,
        IReadOnlyList<HallHourlySlotDto> slots)
    {
        var formattedDate = date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        if (!dayOpen)
        {
            return language == "en"
                ? $"{hallName} is closed on {formattedDate}."
                : $"{HallLabel(language, hallName)} مغلقة في {formattedDate}.";
        }

        if (slots.Count == 0)
        {
            return language == "en"
                ? $"No available hourly slots were found for {hallName} on {formattedDate}."
                : $"لم يتم العثور على فترات ساعة متاحة لـ{HallLabel(language, hallName)} في {formattedDate}.";
        }

        var available = slots
            .Where(slot => slot.Status == HallSlotStatus.Available)
            .ToList();

        if (available.Count == 0)
        {
            return language == "en"
                ? $"{hallName} is fully booked on {formattedDate}."
                : $"{HallLabel(language, hallName)} محجوزة بالكامل في {formattedDate}.";
        }

        var availableRanges = string.Join(
            ", ",
            available.Select(slot => $"{slot.StartTime.ToString("HH:mm", CultureInfo.InvariantCulture)}-{slot.EndTime.ToString("HH:mm", CultureInfo.InvariantCulture)}"));

        return language == "en"
            ? $"{hallName} on {formattedDate} — available hourly slot(s): {availableRanges}."
            : $"{HallLabel(language, hallName)} في {formattedDate} — الفترات المتاحة بالساعة: {availableRanges}.";
    }

    private static AiAssistantResponse BuildClarification(string language, AiAssistantIntentDto intention, string? message = null)
        => new(
            AiAssistantResponseKind.Clarification,
            message ?? ClarificationMessage(language),
            language,
            DateTime.UtcNow,
            Array.Empty<HallRecommendationDto>(),
            HallDetails: null,
            Availability: null,
            Intent: intention);

    private static AiAssistantResponse BuildUnsupported(string language, AiAssistantIntentDto intention)
        => new(
            AiAssistantResponseKind.Unsupported,
            UnsupportedMessage(language),
            language,
            DateTime.UtcNow,
            Array.Empty<HallRecommendationDto>(),
            HallDetails: null,
            Availability: null,
            Intent: intention);

    private static AiAssistantResponse Build(
        string language,
        AiAssistantResponseKind kind,
        string message,
        AiAssistantIntentDto? intention,
        IReadOnlyList<HallRecommendationDto>? halls = null,
        HallDetailsDto? hallDetails = null,
        AiAssistantAvailabilityDayDto? availability = null)
        => new(
            kind,
            message,
            language,
            DateTime.UtcNow,
            halls ?? Array.Empty<HallRecommendationDto>(),
            hallDetails,
            availability,
            intention);

    private static string ClarificationMessage(string language)
        => language == "en"
            ? "I can help you search for halls, view hall details, check availability, or learn how to use Wesal. What would you like to do?"
            : "يمكنني مساعدتك في البحث عن قاعات، عرض تفاصيل قاعة، التحقق من التوفر، أو التعرف على كيفية استخدام وصال. ماذا تريد أن تفعل؟";

    private static string UnsupportedMessage(string language)
        => language == "en"
            ? "I can't perform that action for you. I can help you search for halls, view hall details, check availability, or explain how to use Wesal (booking, ratings, comments, contacting owners, and payments)."
            : "لا أستطيع تنفيذ هذا الإجراء نيابة عنك. يمكنني مساعدتك في البحث عن القاعات، عرض تفاصيل قاعة، التحقق من التوفر، أو شرح كيفية استخدام وصال (الحجز، التقييمات، التعليقات، التواصل مع أصحاب القاعات، والمدفوعات).";

    private static string WhichHallMessage(string language)
        => language == "en"
            ? "Which hall are you asking about? Please include the hall name."
            : "ما اسم القاعة التي تسأل عنها؟ يرجى ذكر اسم القاعة.";

    private static string WhichDateMessage(string language, string hallName)
        => language == "en"
            ? $"For which date would you like to check availability for {hallName}?"
            : $"متى تريد التحقق من توفر قاعة {hallName}؟ يرجى ذكر التاريخ.";

    private static string FutureDateMessage(string language)
        => language == "en"
            ? "Please ask about a future date. I can only check availability for upcoming dates."
            : "يرجى السؤال عن تاريخ مستقبلي. يمكنني التحقق من التوفر فقط للتواريخ القادمة.";

    private static string HallNotFoundMessage(string language, string hallName)
        => language == "en"
            ? $"I couldn't find a hall named '{hallName}'. Try a different name."
            : $"لم أجد قاعة باسم '{hallName}'. جرّب اسماً آخر.";
}
