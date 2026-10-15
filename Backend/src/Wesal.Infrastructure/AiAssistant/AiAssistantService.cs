using System.Diagnostics;
using System.Globalization;
using Microsoft.Extensions.Logging;
using Wesal.Application.Ai;
using Wesal.Application.Ai.Navigation;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Halls;
using System.Text.Json.Nodes;
using Wesal.Infrastructure.OwnerDashboard;

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
    private readonly IAiKnowledgeGapRecorder? _gapRecorder;
    private readonly IAiKnowledgeGapDetector? _gapDetector;
    private readonly ICurrentUserService? _currentUserService;
    private readonly IWesalToolGateway? _toolGateway;
    private readonly IOwnerBookingRequestNotifier _ownerBookingRequestNotifier;

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
        ILogger<AiAssistantService> logger,
        IAiKnowledgeGapRecorder? gapRecorder = null,
        IAiKnowledgeGapDetector? gapDetector = null,
        ICurrentUserService? currentUserService = null,
        IWesalToolGateway? toolGateway = null,
        IOwnerBookingRequestNotifier? ownerBookingRequestNotifier = null)
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
        _gapRecorder = gapRecorder;
        _gapDetector = gapDetector;
        _currentUserService = currentUserService;
        _toolGateway = toolGateway;
        _ownerBookingRequestNotifier = ownerBookingRequestNotifier ?? new OwnerBookingRequestNotifier(null!);
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
        var semanticPlan = AiSemanticPlanResolver.Resolve(text, effectiveLanguage, turn.Today, context, turn);

        var resumed = AiConversationStateResolver.TryResume(context?.State, text, turn.Today);
        if (resumed is not null)
        {
            HallDetailsDto? hall = turn.Hall;
            if (context?.State?.ActiveHallId is { } hallId)
            {
                try { hall = await _hallDetailsService.GetHallDetailsAsync(hallId, cancellationToken); }
                catch (NotFoundException) { hall = null; }
            }
            if (hall is not null)
            {
                var availabilityTurn = turn with { Hall = hall, HallSource = "conversation" };
                var resumedAnswer = await HandleHallAvailabilityAsync(text, effectiveLanguage, availabilityTurn, hall, cancellationToken);
                resumedAnswer = resumedAnswer with { SemanticPlan = semanticPlan };
                _logger.LogInformation("Assistant turn: route={Route} kind={Kind} resolvedGoal={ResolvedGoal} resolvedIntent={ResolvedIntent} activeHallSource={HallSource} hasPendingClarification={HasPendingClarification} pendingField={PendingField} selectedResultIndex={SelectedResultIndex} toolName={ToolName} fallbackReason={FallbackReason} totalMs={TotalMs}",
                    "slot_resume", resumedAnswer.Kind, "find_hall", "check_availability", "conversation", false, "-", context?.State?.SelectedResultIndex, "availability", "-", total.ElapsedMilliseconds);
                return resumedAnswer;
            }
        }

        var contextualHall = turn.Hall;
        if (contextualHall is null && context?.State?.LastSelectedHallId is { } rememberedHallId
            && IsContextualHallNavigation(text))
        {
            try { contextualHall = await _hallDetailsService.GetHallDetailsAsync(rememberedHallId, cancellationToken); }
            catch (NotFoundException) { contextualHall = null; }
        }

        if (contextualHall is not null && IsContextualHallNavigation(text))
        {
            var action = AiAssistantPolicyGate.NavigateAction(
                effectiveLanguage,
                WesalNavigationRegistry.HallDetails,
                AiNavigationMode.Auto,
                contextualHall.HallId);
            if (action is not null)
            {
                var navigationResponse = Build(
                    effectiveLanguage,
                    AiAssistantResponseKind.Answer,
                    effectiveLanguage == "en"
                        ? $"Opening {contextualHall.HallName}. You can continue booking from its hall page. No booking has been submitted."
                        : $"بفتحلك صفحة {contextualHall.HallName}. بتقدر تكمّل طلب الحجز من صفحة القاعة. ما تم إرسال أي حجز.",
                    new AiAssistantIntentDto(AiIntentType.GetHallDetails, null, null, null, null, contextualHall.HallName));
                navigationResponse = navigationResponse with { Actions = [action], SemanticPlan = semanticPlan };
                return navigationResponse;
            }
        }

        if (IsHallResumeRequest(text) && context?.State?.LastSelectedHallId is { } selectedHallId)
        {
            HallDetailsDto? hall = null;
            try { hall = await _hallDetailsService.GetHallDetailsAsync(selectedHallId, cancellationToken); }
            catch (NotFoundException) { }
            if (hall is not null)
            {
                var action = AiAssistantPolicyGate.NavigateAction(effectiveLanguage, WesalNavigationRegistry.HallDetails, AiNavigationMode.Auto, hall.HallId);
                if (action is not null)
                {
                    var resumeResponse = Build(effectiveLanguage, AiAssistantResponseKind.Answer,
                        effectiveLanguage == "en" ? $"Returning to {hall.HallName}. No booking has been submitted." : $"برجعك لصفحة {hall.HallName}. ما تم إرسال أي حجز.",
                        new AiAssistantIntentDto(AiIntentType.GetHallDetails, null, null, null, null, hall.HallName));
                    return resumeResponse with { Actions = [action], SemanticPlan = semanticPlan };
                }
            }
        }

        var routed = await RouteAsync(text, effectiveLanguage, turn, context, semanticPlan, cancellationToken);
        var response = routed.Response with
        {
            SemanticPlan = IsPlatformServicesQuestion(text)
                ? semanticPlan with { Goal = AiSemanticGoal.PlatformKnowledge, HallReference = new AiHallReference(AiHallReferenceKind.None), ResultSetReference = null }
                : routed.Route == "search_exhausted_affirmative"
                    ? semanticPlan with
                    {
                        Goal = AiSemanticGoal.FindHall,
                        ClarificationRequirement = new AiClarificationRequirement("search_filter",
                            effectiveLanguage == "en" ? "Which filter may I change: area, guest capacity, or budget?" : "أي شرط بتحب نعدّله عشان أوسع البحث: المنطقة، عدد الضيوف، ولا الميزانية؟")
                    }
                    : AiSemanticPlanResolver.Resolve(text, effectiveLanguage, turn.Today, context, turn, routed.Response.Intent)
        };
        response = WithContextualActions(text, response, turn);

        _logger.LogInformation(
            "Assistant turn: route={Route} kind={Kind} resolvedGoal={ResolvedGoal} resolvedIntent={ResolvedIntent} activeHallSource={HallSource} hasPendingClarification={HasPendingClarification} pendingField={PendingField} selectedResultIndex={SelectedResultIndex} toolName={ToolName} page={PageKey} hallContext={HallSource} actions={Actions} contextMs={ContextMs} policyMs={PolicyMs} hallContextMs={HallContextMs} orchestrationMs={OrchestrationMs} fallbackReason={FallbackReason} totalMs={TotalMs}",
            routed.Route,
            response.Kind,
            response.Intent?.Intent.ToString() ?? "unknown",
            response.Intent?.Intent.ToString() ?? "unknown",
            turn.HallSource ?? "-",
            context?.State?.PendingClarification is not null,
            context?.State?.MissingField ?? "-",
            context?.State?.SelectedResultIndex,
            response.Availability is not null ? "availability" : response.Halls.Count > 0 ? "search_halls" : "-",
            turn.PageKey ?? "-",
            turn.HallSource ?? "-",
            response.Actions?.Count ?? 0,
            contextMs,
            routed.PolicyMs,
            routed.HallContextMs,
            routed.OrchestrationMs,
            routed.FallbackReason ?? "-",
            total.ElapsedMilliseconds);

        return response;
    }

    private async Task<AssistantRouteResult> RouteAsync(
        string text,
        string language,
        AiTurnContext turn,
        AiConversationContext? context,
        AiSemanticPlan semanticPlan,
        CancellationToken cancellationToken)
    {
        var policyMs = 0L;

        if (IsPlatformServicesQuestion(text))
        {
            var services = await _howToService.TryAnswerKnownQuestionAsync(text, language, cancellationToken, context);
            services ??= await _howToService.TryAnswerKnownQuestionAsync(
                language == "en" ? "What does Wesal offer?" : "شو بتقدموا؟", language, cancellationToken, context);
            if (services is not null)
                return new AssistantRouteResult(Build(language, AiAssistantResponseKind.Answer, services.Answer, null),
                    "platform_services_topic_switch", policyMs, 0, 0, null);
        }

        if (IsAffirmativeContinueSearch(text) && context?.State?.TaskStatus == "exhausted")
        {
            var clarify = language == "en"
                ? "Which filter may I change: area, guest capacity, or budget? I will keep all other constraints."
                : "أي شرط بتحب نعدّله عشان أوسع البحث: المنطقة، عدد الضيوف، ولا الميزانية؟ بخلّي باقي الشروط زي ما هي.";
            return new AssistantRouteResult(Build(language, AiAssistantResponseKind.Clarification, clarify, null),
                "search_exhausted_affirmative", policyMs, 0, 0, null);
        }

        if (AsksWhyThisHall(text) && turn.Hall is not null)
        {
            var explanation = await TryHandleHallContextAsync(
                text, language, turn, context?.State?.LastSemanticPlan, cancellationToken);
            if (explanation is not null)
                return new AssistantRouteResult(explanation, "recommendation_explanation", policyMs, 0, 0, null);
        }

        var parsedCriteria = CriteriaExtractor.Extract(text);
        var previousHallResults = GetConversationHallIds(context);
        if (semanticPlan.ComparisonIntent == AiComparisonIntent.MostSuitable
            && semanticPlan.ResultSetReference is not null
            && context?.State?.LastSemanticPlan is { } previousPlan)
        {
            // Short recommendation follow-ups reuse prior explicit hard constraints.
            // Current-turn values are parsed first and always take precedence.
            semanticPlan = semanticPlan with
            {
                Region = semanticPlan.Region ?? previousPlan.Region,
                Area = semanticPlan.Area ?? previousPlan.Area,
                Capacity = semanticPlan.Capacity ?? previousPlan.Capacity,
                PriceBudget = semanticPlan.PriceBudget.IsSpecified ? semanticPlan.PriceBudget : previousPlan.PriceBudget,
                SortPreference = semanticPlan.SortPreference == AiPriceSortPreference.Relevance
                    ? previousPlan.SortPreference
                    : semanticPlan.SortPreference
            };
        }
        if (parsedCriteria.SortByPrice
            && !parsedCriteria.MaximumPrice.HasValue
            && IsHallSearchContext(context)
            && previousHallResults.Count > 0)
        {
            var cheapest = await HandleCheapestShownHallAsync(previousHallResults, language, cancellationToken);
            return new AssistantRouteResult(cheapest, "cheapest_shown_hall", policyMs, 0, 0, null);
        }

        // "شو بتقدموا غير القاعات؟" asks about services, not for a hall
        // listing, even though it names halls. Only the explicit exclusion
        // flips it; mixed listing+services questions still list.
        if (AiConversationStateResolver.IsCollectionQuestion(text) && !AsksBeyondHalls(text))
        {
            var collectionIntent = await _intentExtractor.ExtractWithoutModelAsync(text, language, cancellationToken, context);
            var collectionQuestion = AiHallQuestionClassifier.Classify(text);
            var collection = await _hallSearchService.SearchHallsAsync(new HallSearchRequest { PageNumber = 1, PageSize = 12 }, cancellationToken);
            var all = collection.Items.Select(h => new HallRecommendationDto(h.HallId, h.HallName, h.Region, h.Address, h.Capacity, h.Price, h.MainImage, IsAvailable: true, UnavailableReason: null)).ToList();
            if (collectionQuestion == AiHallQuestion.Price)
                all = all.Where(h => h.Price.HasValue).ToList();
            var message = all.Count == 0
                ? (language == "en" ? "No public halls were found." : "ما لقيت قاعات متاحة للعرض حالياً.")
                : (language == "en" ? $"Here are {all.Count} public halls." : $"هاي {all.Count} من القاعات الموجودة، والأسعار ظاهرة للقاعات اللي ناشرتها.");
            return new AssistantRouteResult(Build(language, AiAssistantResponseKind.Halls, message,
                collectionIntent with { Intent = AiIntentType.SearchHalls }, halls: all), "hall_collection", policyMs, 0, 0, null);
        }

        // "غيرها" walks the last shown results. The durable state keeps the result
        // ids across turns that show no new list (a details turn wipes the
        // short-lived LastHalls memory), so fall back to it when it is empty.
        if (AiConversationStateResolver.IsNextResult(text))
        {
            IReadOnlyList<Guid> resultIds = context?.LastHalls is { Count: > 0 } shownHalls
                ? shownHalls.Select(hall => hall.HallId).ToList()
                : context?.State?.ShownHallIds ?? (IReadOnlyList<Guid>)Array.Empty<Guid>();
            if (resultIds.Count > 0)
            {
                var currentHallId = context?.State?.LastSelectedHallId ?? context?.State?.ActiveHallId ?? context?.LastHall?.HallId;
                var nextIndex = (context?.State?.SelectedResultIndex ?? -1) + 1;
                var seenHallIds = context?.State?.SeenHallIds ?? Array.Empty<Guid>();
                while (nextIndex < resultIds.Count
                    && (currentHallId == resultIds[nextIndex] || seenHallIds.Contains(resultIds[nextIndex])))
                {
                    nextIndex++;
                }
                if (nextIndex >= resultIds.Count
                    && currentHallId is { } rankedHallId
                    && context?.State?.LastSemanticPlan?.ComparisonIntent is
                        AiComparisonIntent.Cheapest or AiComparisonIntent.MostExpensive
                            or AiComparisonIntent.Largest or AiComparisonIntent.Smallest or AiComparisonIntent.BestBudgetFit or AiComparisonIntent.MostSuitable)
                {
                    // A ranking answer ("cheapest", "largest") selects a result
                    // independently of list position. "Another one" should show a
                    // different result even when that ranked result was last in order.
                    nextIndex = resultIds.ToList().FindIndex(id => id != rankedHallId);
                }

                if (nextIndex < 0 || nextIndex >= resultIds.Count)
                {
                    var end = language == "en" ? "That's the last result in this search. I can look with different criteria." : "هاي آخر نتيجة عندي من البحث الحالي. إذا بدك بدورلك بمعايير ثانية.";
                    return new AssistantRouteResult(Build(language, AiAssistantResponseKind.Answer, end, null), "result_navigation_end", policyMs, 0, 0, null);
                }
                var selected = await _hallDetailsService.GetHallDetailsAsync(resultIds[nextIndex], cancellationToken);
                var selectedMessage = language == "en" ? $"Another result: {selected.HallName}." : $"هاي نتيجة ثانية: {selected.HallName}.";
                return new AssistantRouteResult(Build(language, AiAssistantResponseKind.HallDetails, selectedMessage,
                    new AiAssistantIntentDto(AiIntentType.GetHallDetails, null, null, null, null, selected.HallName), hallDetails: selected), "result_navigation", policyMs, 0, 0, null);
            }
        }

        // A bare ordinal ("الثانية") selects that result. Guarded to selection-only
        // turns so an ordinal inside a real question ("الأولى شو سعرها؟") still
        // reaches hall-context and gets the asked fact answered about that hall.
        if (AiReferenceResolver.TryGetOrdinal(text) is { } ordinal
            && semanticPlan.ComparisonIntent != AiComparisonIntent.CompareSelected
            && AiHallQuestionClassifier.Classify(text) == AiHallQuestion.None
            && AiReferenceResolver.TryGetExplicitHallName(text) is null)
        {
            IReadOnlyList<Guid> ordinalIds = context?.LastHalls is { Count: > 0 } ordinalHalls
                ? ordinalHalls.Select(hall => hall.HallId).ToList()
                : context?.State?.ShownHallIds ?? (IReadOnlyList<Guid>)Array.Empty<Guid>();
            if (ordinalIds.Count > 0)
            {
                var resolvedIndex = ordinal < 0 ? ordinalIds.Count - 1 : ordinal;
                if (resolvedIndex < 0 || resolvedIndex >= ordinalIds.Count)
                {
                    var end = language == "en" ? "That's the last result in this search. I can look with different criteria." : "هاي آخر نتيجة عندي من البحث الحالي. إذا بدك بدورلك بمعايير ثانية.";
                    return new AssistantRouteResult(Build(language, AiAssistantResponseKind.Answer, end, null), "result_ordinal_end", policyMs, 0, 0, null);
                }
                var ordinalSelected = await _hallDetailsService.GetHallDetailsAsync(ordinalIds[resolvedIndex], cancellationToken);
                var ordinalMessage = language == "en" ? $"Result {resolvedIndex + 1}: {ordinalSelected.HallName}." : $"النتيجة {resolvedIndex + 1}: {ordinalSelected.HallName}.";
                return new AssistantRouteResult(Build(language, AiAssistantResponseKind.HallDetails, ordinalMessage,
                    new AiAssistantIntentDto(AiIntentType.GetHallDetails, null, null, null, null, ordinalSelected.HallName), hallDetails: ordinalSelected), "result_ordinal", policyMs, 0, 0, null);
            }
        }

        // 1) Deterministic policies: navigation, unavailable services, support, payments.
        var stage = Stopwatch.StartNew();
        var gate = await _policyGate.TryHandleAsync(text, language, cancellationToken);
        policyMs = stage.ElapsedMilliseconds;
        if (gate is not null)
        {
            return new AssistantRouteResult(gate, "policy", policyMs, 0, 0, null);
        }

        if (LooksLikeBareHallName(text) && AiHallQuestionClassifier.Classify(text) == AiHallQuestion.None)
        {
            var namedHall = await TryResolveHallAsync(text, cancellationToken);
            if (namedHall is not null)
            {
                try
                {
                    var details = await _hallDetailsService.GetHallDetailsAsync(namedHall.HallId, cancellationToken);
                    var intent = new AiAssistantIntentDto(AiIntentType.GetHallDetails, null, null, null, null, details.HallName);
                    var message = language == "en"
                        ? $"Here are the current details for {details.HallName}."
                        : $"هاي التفاصيل الحالية لـ{HallLabel(language, details.HallName)}.";
                    return new AssistantRouteResult(
                        Build(language, AiAssistantResponseKind.HallDetails, message, intent, hallDetails: details),
                        "bare_hall_entity",
                        policyMs,
                        0,
                        0,
                        null);
                }
                catch (NotFoundException)
                {
                    // The public result can disappear between name search and detail lookup.
                }
            }
        }

        if (semanticPlan.AvailabilityIntent && semanticPlan.DateRange is not null)
        {
            var rangeAnswer = await HandleAvailabilityRangeAsync(
                semanticPlan,
                turn,
                language,
                cancellationToken);
            return new AssistantRouteResult(rangeAnswer, "availability_range", policyMs, 0, 0, null);
        }

        // Handle booking conversation flow
        if (semanticPlan.Goal == AiSemanticGoal.FindHall
            && context?.State?.BookingHallId is not null
            && context?.State?.BookingDate is not null
            && context?.State?.BookingStartTime is not null
            && context?.State?.BookingEndTime is not null
            && context?.State?.BookingCustomerName is not null)
        {
            var bookingResponse = await HandleBookingConversationAsync(
                text,
                language,
                turn,
                context,
                cancellationToken);
            return new AssistantRouteResult(bookingResponse, "booking_conversation", policyMs, 0, 0, null);
        }

        var hallIds = GetConversationHallIds(context);
        if (semanticPlan.ComparisonIntent != AiComparisonIntent.None
            && semanticPlan.ResultSetReference is not null
            && hallIds.Count > 0)
        {
            var comparison = await HandleResultComparisonAsync(
                semanticPlan,
                hallIds,
                language,
                cancellationToken);
            if (comparison is not null)
            {
                return new AssistantRouteResult(comparison, "result_comparison", policyMs, 0, 0, null);
            }
        }

        var isBareArea = IsBareAreaRequest(text, parsedCriteria.Area);
        var priorSearch = context?.LastIntent is { Intent: AiIntentType.SearchHalls };
        var priorPriceSearch = context?.LastIntent is
            { Intent: AiIntentType.SearchHalls, MaximumPrice: not null } or
            { Intent: AiIntentType.SearchHalls, SortByPrice: true };
        // A stated price constraint (max/min/target or a price sort) means the user is
        // shopping by budget, so the price-aware branch must own the turn.
        var hasPriceConstraint = parsedCriteria.MaximumPrice.HasValue
            || parsedCriteria.MinimumPrice.HasValue
            || parsedCriteria.AroundPrice.HasValue
            || parsedCriteria.SortByPrice;
        if (hasPriceConstraint || isBareArea || priorPriceSearch)
        {
            var deterministicIntent = await _intentExtractor.ExtractWithoutModelAsync(text, language, cancellationToken, context);
            deterministicIntent = MergeWithContext(deterministicIntent, context);
            // A bare budget refinement ("طيب لو ميزانيتي 2200؟") states a price but no
            // hall-search vocabulary, so the deterministic classifier answers it as a
            // how-to question. When the user is refining an ongoing hall search, rebuild
            // the search intent from the stated price and carry the rest forward.
            if (deterministicIntent.Intent != AiIntentType.SearchHalls && priorSearch && hasPriceConstraint)
            {
                deterministicIntent = new AiAssistantIntentDto(
                    AiIntentType.SearchHalls,
                    parsedCriteria.Region,
                    parsedCriteria.Area,
                    parsedCriteria.Date,
                    parsedCriteria.Capacity,
                    null,
                    parsedCriteria.MaximumPrice,
                    parsedCriteria.SortByPrice,
                    parsedCriteria.MinimumPrice,
                    parsedCriteria.AroundPrice,
                    parsedCriteria.SortPreference);
                deterministicIntent = MergeWithContext(deterministicIntent, context);
            }

            if (deterministicIntent.Intent == AiIntentType.SearchHalls
                && (hasPriceConstraint
                    || deterministicIntent.MaximumPrice.HasValue
                    || deterministicIntent.MinimumPrice.HasValue
                    || deterministicIntent.AroundPrice.HasValue
                    || deterministicIntent.SortByPrice
                    || isBareArea))
            {
                var response = await HandleSearchHallsAsync(text, language, deterministicIntent, cancellationToken);
                return new AssistantRouteResult(response, isBareArea ? "catalog_area_search" : "price_aware_hall_search", policyMs, 0, 0, null);
            }
        }

        // 2) The hall in context answers its own data questions from live data.
        stage.Restart();
        var hallAnswer = await TryHandleHallContextAsync(text, language, turn, context?.State?.LastSemanticPlan, cancellationToken);
        var hallContextMs = stage.ElapsedMilliseconds;
        if (hallAnswer is not null)
        {
            return new AssistantRouteResult(hallAnswer, "hall-context", policyMs, hallContextMs, 0, null);
        }

        // Verified static facts and deterministic how-tos are authoritative and do
        // not require Gemini. Unknown questions return null and continue to orchestration.
        stage.Restart();
        var knownAnswer = await _howToService.TryAnswerKnownQuestionAsync(text, language, cancellationToken, context);
        var knowledgeMs = stage.ElapsedMilliseconds;
        if (knownAnswer is not null)
        {
            var response = Build(language, AiAssistantResponseKind.Answer, knownAnswer.Answer, null);
            return new AssistantRouteResult(response, "knowledge", policyMs, hallContextMs, knowledgeMs, null);
        }

        // 3) Gemini orchestration (structured, tool-grounded).
        stage.Restart();
        var (orchestration, fallbackReason) = await TryOrchestrateAsync(text, language, context, turn, cancellationToken);
        var orchestrationMs = stage.ElapsedMilliseconds;
        if (orchestration is not null)
        {
            return new AssistantRouteResult(orchestration, "gemini", policyMs, hallContextMs, orchestrationMs, null);
        }

        var fallbackIntent = await _intentExtractor.ExtractWithoutModelAsync(
            text, language, cancellationToken, context);
        var pendingCapacityAnswer = context?.State?.PendingClarification == "capacity"
            && semanticPlan.Capacity.HasValue;
        // Preserve the structured model/tool path when it can handle the turn. The
        // validated semantic plan is the deterministic fallback, so numeric and
        // conversational criteria remain available when Gemini is off or declines.
        if (semanticPlan.Goal == AiSemanticGoal.FindHall
            && (fallbackIntent.Intent is AiIntentType.SearchHalls or AiIntentType.Unknown || pendingCapacityAnswer
                || semanticPlan.PriceBudget.IsSpecified)
            && (semanticPlan.Region is not null
                || semanticPlan.Area is not null
                || semanticPlan.Capacity.HasValue
                || semanticPlan.Date.HasValue
                || semanticPlan.PriceBudget.IsSpecified
                || semanticPlan.SortPreference != AiPriceSortPreference.Relevance))
        {
            var plannedIntent = AiSemanticPlanResolver.ToLegacyIntent(semanticPlan);
            plannedIntent = MergeWithContext(plannedIntent, context);
            var response = await HandleSearchHallsAsync(text, language, plannedIntent, cancellationToken);
            return new AssistantRouteResult(response, "semantic_plan_search", policyMs, hallContextMs, orchestrationMs, fallbackReason);
        }

        // 4) Deterministic degradation: fully functional without any model.
        cancellationToken.ThrowIfCancellationRequested();
        var degraded = await HandleDeterministicAsync(text, language, turn, context, cancellationToken, fallbackIntent);
        return new AssistantRouteResult(degraded, "deterministic", policyMs, hallContextMs, orchestrationMs, fallbackReason);
    }

    private async Task<(AiAssistantResponse? Response, string? FallbackReason)> TryOrchestrateAsync(
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
            // Exception messages and stack traces may contain user text or provider payloads.
            _logger.LogWarning(
                "Gemini orchestrator failed; using deterministic path. exceptionType={ExceptionType}",
                ex.GetType().Name);
            return (null, "exception");
        }

        if (result is null)
        {
            return (null, "no_result");
        }

        if (result.Disposition == AiOrchestrationDisposition.NotHandled)
        {
            return (null, "not_handled");
        }

        if (!result.Success)
        {
            return (null, "unsuccessful");
        }

        if (string.IsNullOrWhiteSpace(result.Answer))
        {
            return (null, "empty_answer");
        }

        var responseLanguage = string.IsNullOrWhiteSpace(result.ResponseLanguage) ? language : result.ResponseLanguage;

        if (result.Availability is { } availability)
        {
            return (new AiAssistantResponse(
                AiAssistantResponseKind.Availability,
                result.Answer,
                responseLanguage,
                DateTime.UtcNow,
                Array.Empty<HallRecommendationDto>(),
                null,
                availability,
                new AiAssistantIntentDto(AiIntentType.CheckHallAvailability, null, null, availability.Date, null, availability.HallName)), null);
        }

        if (result.HallDetails is { } details)
        {
            return (new AiAssistantResponse(
                AiAssistantResponseKind.HallDetails,
                result.Answer,
                responseLanguage,
                DateTime.UtcNow,
                Array.Empty<HallRecommendationDto>(),
                details,
                null,
                new AiAssistantIntentDto(AiIntentType.GetHallDetails, null, null, null, null, details.HallName)), null);
        }

        if (result.Halls.Count > 0)
        {
            return (new AiAssistantResponse(
                AiAssistantResponseKind.Halls,
                result.Answer,
                responseLanguage,
                DateTime.UtcNow,
                result.Halls,
                null,
                null,
                new AiAssistantIntentDto(AiIntentType.SearchHalls, null, null, null, null, null)), null);
        }

        return (Build(responseLanguage, AiAssistantResponseKind.Answer, result.Answer, null), null);
    }

    private sealed record AssistantRouteResult(
        AiAssistantResponse Response,
        string Route,
        long PolicyMs,
        long HallContextMs,
        long OrchestrationMs,
        string? FallbackReason);

    /// <summary>
    /// True when the turn asks what Wesal offers beyond halls ("شو بتقدموا غير
    /// القاعات؟"). Mirrors the capabilities answer keywords; the explicit
    /// "غير" keeps mixed listing+services questions on the listing path.
    /// </summary>
    private static bool AsksBeyondHalls(string text)
        => text.Contains("غير", StringComparison.Ordinal)
            && (text.Contains("بتقدم", StringComparison.Ordinal)
                || text.Contains("بتوفر", StringComparison.Ordinal)
                || text.Contains("بتسو", StringComparison.Ordinal)
                || text.Contains("بتعمل", StringComparison.Ordinal)
                || text.Contains("خدمات", StringComparison.Ordinal)
                || text.Contains("services", StringComparison.OrdinalIgnoreCase));

    private static bool IsPlatformServicesQuestion(string text)
    {
        var folded = AiText.Normalize(text);
        return folded is "شو بتقدموا" or "احكيلي شو بتقدموا" or "شو بتقدموا بالزبط"
            or "شو خدمات وصال" or "شو خدمات wesal" or "شو غير القاعات بتقدموا"
            or "ايش عندكم خدمات" or "ايش خدماتكم" or "what does wesal offer"
            or "what services do you offer" or "what does wesal provide"
            || folded.Contains("شو بتقدموا", StringComparison.Ordinal)
                && !folded.Contains("قاعة", StringComparison.Ordinal)
                && !folded.Contains("صالة", StringComparison.Ordinal);
    }

    private static bool IsContextualHallNavigation(string text)
    {
        var folded = AiText.Normalize(text);
        return folded is "وديني هناك" or "بتقدر توديني هناك" or "بتقدر توديني لهناك"
            or "وديني على هاي الصاله" or "وديني لهاي الصاله"
            or "وديني عالصاله" or "افتحها" or "افتحلي هاي" or "افتحلي الصاله"
            or "فرجيني القاعه" or "ورجيني القاعه" or "فرجيني تفاصيلها"
            or "take me there" or "open it" or "show this hall" or "show me its details";
    }

    private static bool IsHallResumeRequest(string text)
    {
        var folded = AiText.Normalize(text);
        return folded is "ارجع للصاله" or "رجعني للصاله" or "رجعني الها"
            or "ارجع لها" or "back to the hall" or "return to the hall";
    }

    private static bool IsAffirmativeContinueSearch(string text)
    {
        var folded = AiText.Normalize(text);
        return folded is "طيب اه دور" or "اه دور" or "ايوه دور" or "نعم ابحث"
            or "yes search" or "okay search" or "go ahead and search";
    }

    private static bool AsksWhyThisHall(string text)
    {
        var folded = AiText.Normalize(text);
        return folded.Contains("ليش هاي", StringComparison.Ordinal)
            || folded.Contains("ليش هي", StringComparison.Ordinal)
            || folded.Contains("ليش اختر", StringComparison.Ordinal)
            || folded.Contains("why this", StringComparison.Ordinal)
            || folded.Contains("why did you choose", StringComparison.Ordinal);
    }

    // ───────────────────────── hall context (pinned / page / ordinal) ─────────────────────────

    private async Task<AiAssistantResponse?> TryHandleHallContextAsync(
        string text,
        string language,
        AiTurnContext turn,
        AiSemanticPlan? priorPlan,
        CancellationToken cancellationToken)
    {
        var hall = turn.Hall;
        if (hall is null)
        {
            return null;
        }

        if (AsksWhyThisHall(text))
        {
            var reasons = priorPlan?.ComparisonIntent == AiComparisonIntent.MostSuitable
                ? SuitabilityReasons(hall, priorPlan, language)
                : Array.Empty<string>();
            var why = reasons.Length > 0
                ? string.Join(language == "en" ? " and " : "، ", reasons)
                : language == "en"
                    ? "I can explain it against a budget, guest count, or preferred area if you share those criteria."
                    : "بقدر أوضح سبب الاختيار حسب الميزانية أو عدد الضيوف أو المنطقة إذا بتحددلي المعايير.";
            var whyMessage = language == "en"
                ? $"{hall.HallName} was selected from the shown results because {why}."
                : $"اخترت {hall.HallName} من النتائج المعروضة للأسباب التالية: {why}.";
            return Build(language, AiAssistantResponseKind.Answer, whyMessage,
                new AiAssistantIntentDto(AiIntentType.GetHallDetails, null, null, null, null, hall.HallName), hallDetails: hall);
        }

        // An explicitly named hall always beats the pinned/page one.
        if (AiReferenceResolver.TryGetExplicitHallName(text) is not null)
        {
            return null;
        }

        var question = AiHallQuestionClassifier.Classify(text);
        if (question is AiHallQuestion.None or AiHallQuestion.BookingHowTo)
        {
            return null;
        }

        var name = hall.HallName;
        var intent = new AiAssistantIntentDto(AiIntentType.GetHallDetails, null, null, null, null, name);

        if (question == AiHallQuestion.Availability)
        {
            return await HandleHallAvailabilityAsync(text, language, turn, hall, cancellationToken);
        }

        if (question == AiHallQuestion.ContactOwner)
        {
            var contact = hall.ContactPhone?.Trim();
            var contactMessage = !string.IsNullOrWhiteSpace(contact)
                ? language == "en"
                    ? $"The contact number published for {hall.HallName} is {contact}."
                    : $"رقم التواصل المنشور لـ{HallLabel(language, hall.HallName)} هو {contact}."
                : language == "en"
                    ? $"No hall-owner contact number is published in the details I can verify. You can open {hall.HallName}'s page to see its available contact options."
                    : $"ما في رقم تواصل منشور أقدر أتحقق منه لـ{HallLabel(language, hall.HallName)}. افتح صفحة القاعة لتشوف خيارات التواصل المتاحة.";
            var contactResponse = Build(language, AiAssistantResponseKind.Answer, contactMessage, intent, hallDetails: hall);
            return contactResponse with
            {
                Actions = AiAssistantPolicyGate.NavigateAction(
                    language,
                    WesalNavigationRegistry.HallDetails,
                    AiNavigationMode.Suggest,
                    hall.HallId) is { } open ? [open] : null
            };
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
        var date = AiRelativeDateResolver.Resolve(text, turn.Today)
            ?? CriteriaExtractor.Extract(text, turn.Today, allowBareCapacity: false).Date;

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
        CancellationToken cancellationToken,
        AiAssistantIntentDto? extractedIntent = null)
    {
        var intent = extractedIntent ?? await _intentExtractor.ExtractWithoutModelAsync(text, language, cancellationToken, context);
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
        var area = intent.SemanticPlan?.ClearAreaPreference == true ? null : intent.Area ?? prior.Area;
        var date = intent.Date ?? prior.Date;
        var capacity = intent.Capacity ?? prior.Capacity;
        var maximumPrice = intent.MaximumPrice ?? prior.MaximumPrice;
        var minimumPrice = intent.MinimumPrice ?? prior.MinimumPrice;
        var aroundPrice = intent.AroundPrice ?? prior.AroundPrice;
        var sortByPrice = intent.SortByPrice || prior.SortByPrice;
        var sortPreference = intent.SortPreference != AiPriceSortPreference.Relevance
            ? intent.SortPreference
            : prior.SortPreference;

        if (region == intent.Region
            && area == intent.Area
            && date == intent.Date
            && capacity == intent.Capacity
            && maximumPrice == intent.MaximumPrice
            && minimumPrice == intent.MinimumPrice
            && aroundPrice == intent.AroundPrice
            && sortByPrice == intent.SortByPrice
            && sortPreference == intent.SortPreference)
        {
            return intent;
        }

        return new AiAssistantIntentDto(
            intent.Intent,
            region,
            area,
            date,
            capacity,
            intent.HallName,
            maximumPrice,
            sortByPrice,
            minimumPrice,
            aroundPrice,
            sortPreference,
            intent.SemanticPlan);
    }

    private async Task<AiAssistantResponse> HandleHowToAsync(string text, string language, AiAssistantIntentDto intention, CancellationToken cancellationToken)
    {
        // Deterministic only: the orchestrator already tried (and failed to use) Gemini.
        var answer = await _howToService.AskHowToAsync(text, language, cancellationToken, allowModel: false);

        await TryRecordKnowledgeGapAsync(text, language, answer, cancellationToken);

        return Build(
            language,
            AiAssistantResponseKind.Answer,
            answer.Answer,
            intention);
    }

    /// <summary>
    /// Learning-inbox hook: records at most one gap candidate per turn, only for
    /// genuine no-trusted-information outcomes, and never breaks the turn.
    /// Recording is best-effort and fail-open; the returned response is built
    /// independently of whether recording succeeded.
    /// </summary>
    private async Task TryRecordKnowledgeGapAsync(
        string text,
        string language,
        HowToResponse answer,
        CancellationToken cancellationToken)
    {
        try
        {
            if (_gapRecorder is null || _gapDetector is null)
            {
                return;
            }

            if (!HowToService.IsGenericFallbackAnswer(answer))
            {
                return;
            }

            if (!_gapDetector.IsRecordable(AiKnowledgeGapOutcome.GenericNoTrustedAnswer))
            {
                return;
            }

            await _gapRecorder.RecordAsync(new AiKnowledgeGapCandidate(
                AiKnowledgeGapSanitizer.Sanitize(text, 500),
                language,
                AiKnowledgeGapReason.GenericFallback,
                "deterministic-howto",
                DateTimeOffset.UtcNow), cancellationToken);
        }
        catch (Exception ex)
        {
            // Never leak the raw question; the response path is unaffected.
            _logger.LogWarning(
                "Knowledge gap recording failed; assistant response unaffected. exceptionType={ExceptionType}",
                ex.GetType().Name);
        }
    }

    private async Task<AiAssistantResponse> HandleSearchHallsAsync(string text, string language, AiAssistantIntentDto intention, CancellationToken cancellationToken)
    {
        // Search against the MERGED intent (carry-forward from earlier turns), not just the raw text.
        var query = BuildSearchQuery(text, intention, language);
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
    internal static string BuildSearchQuery(string text, AiAssistantIntentDto intent, string language)
    {
        var extra = new List<string>();
        var queryText = text;
        if (intent.SemanticPlan is { ClearAreaPreference: true, ClearedArea: { Length: > 0 } clearedArea })
        {
            var areaToken = clearedArea.Split(' ', StringSplitOptions.RemoveEmptyEntries).LastOrDefault() ?? clearedArea;
            var pattern = $@"(?:مش|ليس|not)\s+(?:في\s+|بال|ب)?{System.Text.RegularExpressions.Regex.Escape(areaToken)}";
            queryText = System.Text.RegularExpressions.Regex.Replace(queryText, pattern, " ", System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.CultureInvariant);
        }
        var already = CriteriaExtractor.Extract(queryText);
        var isArabic = language.StartsWith("ar", StringComparison.OrdinalIgnoreCase);

        if (already.Region is null && !string.IsNullOrWhiteSpace(intent.Region))
        {
            extra.Add(isArabic
                ? intent.Region switch
                {
                    "NorthGaza" => "شمال غزة",
                    "SouthGaza" => "جنوب غزة",
                    "MiddleArea" => "الوسطى",
                    _ => "غزة"
                }
                : intent.Region switch
            {
                "NorthGaza" => "North Gaza",
                "SouthGaza" => "South Gaza",
                "MiddleArea" => "Middle Area",
                _ => "Gaza"
            });
        }

        if (already.Capacity is null && intent.Capacity is { } capacity)
        {
            extra.Add(isArabic ? $"لـ {capacity} شخص" : $"for {capacity} people");
        }

        if (already.Area is null && !string.IsNullOrWhiteSpace(intent.Area))
        {
            extra.Add(isArabic ? $"في {intent.Area}" : $"in {intent.Area}");
        }

        if (intent.Date is { } date && already.Date != date)
        {
            extra.Add(date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        }

        if (already.MaximumPrice is null && intent.MaximumPrice is { } maximumPrice)
        {
            var formattedPrice = maximumPrice.ToString("0.##", CultureInfo.InvariantCulture);
            extra.Add(isArabic ? $"لحد {formattedPrice} شيكل" : "under " + formattedPrice + " NIS");
        }

        if (already.MinimumPrice is null && intent.MinimumPrice is { } minimumPrice)
        {
            var formattedPrice = minimumPrice.ToString("0.##", CultureInfo.InvariantCulture);
            extra.Add(isArabic ? $"ابتداء من {formattedPrice} شيكل" : "at least " + formattedPrice + " NIS");
        }

        if (already.AroundPrice is null && intent.AroundPrice is { } aroundPrice)
        {
            var formattedPrice = aroundPrice.ToString("0.##", CultureInfo.InvariantCulture);
            extra.Add(isArabic ? $"حوالي {formattedPrice} شيكل" : "around " + formattedPrice + " NIS");
        }

        if (!already.SortByPrice && intent.SortPreference is AiPriceSortPreference.LowestPrice or AiPriceSortPreference.HighestPrice)
        {
            extra.Add(intent.SortPreference == AiPriceSortPreference.HighestPrice
                ? isArabic ? "الأغلى" : "most expensive"
                : isArabic ? "الأرخص" : "cheapest");
        }

        return extra.Count == 0 ? queryText : $"{queryText} {string.Join(' ', extra)}";
    }

    private async Task<AiAssistantResponse> HandleAvailabilityRangeAsync(
        AiSemanticPlan plan,
        AiTurnContext turn,
        string language,
        CancellationToken cancellationToken)
    {
        var intent = AiSemanticPlanResolver.ToLegacyIntent(plan);
        var range = plan.DateRange!;
        if (range.End < turn.Today || range.Start > range.End || range.End.DayNumber - range.Start.DayNumber > 30)
        {
            return Build(language, AiAssistantResponseKind.Clarification, FutureDateMessage(language), intent);
        }

        HallDetailsDto? hall = plan.HallReference.Kind is AiHallReferenceKind.ExplicitName
            ? null
            : turn.Hall;
        if (hall is null && !string.IsNullOrWhiteSpace(plan.HallReference.Name))
        {
            var match = await TryResolveHallAsync(plan.HallReference.Name, cancellationToken);
            if (match is not null)
            {
                try { hall = await _hallDetailsService.GetHallDetailsAsync(match.HallId, cancellationToken); }
                catch (NotFoundException) { hall = null; }
            }
        }

        if (hall is null)
        {
            return Build(language, AiAssistantResponseKind.Clarification, WhichHallMessage(language), intent);
        }

        var firstDate = range.Start < turn.Today ? turn.Today : range.Start;
        if (firstDate > range.End)
        {
            return Build(language, AiAssistantResponseKind.Clarification, FutureDateMessage(language), intent);
        }

        var availableDates = new List<DateOnly>();
        for (var date = firstDate; date <= range.End; date = date.AddDays(1))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var catalog = await _hourlySlotService.GetHourlyCatalogAsync(hall.HallId, date, cancellationToken);
            if (catalog.DayOpen && catalog.Slots.Any(slot => slot.IsSelectable))
            {
                availableDates.Add(date);
            }
        }

        var period = $"{firstDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)}–{range.End.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)}";
        var message = availableDates.Count == 0
            ? language == "en"
                ? $"No selectable hourly slots were returned for {hall.HallName} between {period}."
                : $"ما ظهر عندي فترات ساعة قابلة للحجز لـ{HallLabel(language, hall.HallName)} بين {period}."
            : language == "en"
                ? $"{hall.HallName} has selectable hourly slots on: {string.Join(", ", availableDates.Select(date => date.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)))}."
                : $"ظهر توفر لـ{HallLabel(language, hall.HallName)} في الأيام التالية: {string.Join("، ", availableDates.Select(date => date.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)))}.";

        return Build(language, AiAssistantResponseKind.Answer, message, intent);
    }

    private async Task<AiAssistantResponse> CreateBookingThroughToolAsync(
        string language,
        HallDetailsDto hall,
        string customerName,
        Guid hallId,
        DateOnly date,
        TimeOnly startTime,
        TimeOnly endTime,
        CancellationToken cancellationToken)
    {
        var arguments = new JsonObject
        {
            ["hallId"] = hallId.ToString(),
            ["date"] = date.ToString("yyyy-MM-dd"),
            ["startTime"] = startTime.ToString("HH:mm"),
            ["endTime"] = endTime.ToString("HH:mm"),
            ["customerName"] = customerName
        };
        var invocation = new Wesal.Application.Common.Models.WesalToolInvocation(
            WesalToolNames.CreateBooking, arguments);
        var result = await _toolGateway!.ExecuteAsync(invocation, cancellationToken);
        if (!result.Success)
        {
            return Build(
                language,
                AiAssistantResponseKind.Clarification,
                result.ErrorMessage ?? (language == "en"
                    ? "I could not prepare the booking request preview. No booking was submitted."
                    : "تعذر تجهيز معاينة طلب الحجز. لم يتم إرسال أي طلب."),
                new AiAssistantIntentDto(AiIntentType.Unknown, null, null, null, null, hallId.ToString()));
        }

        var preview = language == "en"
            ? $"Booking request preview for {hall.HallName}: {date:yyyy-MM-dd}, {startTime:HH:mm}–{endTime:HH:mm}, name: {customerName}. No booking was submitted or confirmed. Review and submit it through the hall's booking form."
            : $"معاينة طلب الحجز لقاعة {hall.HallName}: بتاريخ {date:yyyy-MM-dd} من {startTime:HH:mm} إلى {endTime:HH:mm} باسم {customerName}. لم يتم إرسال الطلب أو تأكيد الحجز. راجع التفاصيل وأرسل الطلب من نموذج الحجز في صفحة القاعة.";
        return Build(
            language,
            AiAssistantResponseKind.Answer,
            preview,
            new AiAssistantIntentDto(AiIntentType.Unknown, null, null, null, null, hallId.ToString()));
    }

    private async Task<AiAssistantResponse> HandleBookingConversationAsync(
        string text,
        string language,
        AiTurnContext turn,
        AiConversationContext context,
        CancellationToken cancellationToken)
    {
        var state = context.State;
        var hallId = state?.BookingHallId ?? state?.ActiveHallId ?? turn.Hall?.HallId;
        if (hallId is null)
        {
            return Build(language, AiAssistantResponseKind.Clarification, "Please specify which hall you want to book.", null);
        }

        var hall = await _hallDetailsService.GetHallDetailsAsync(hallId.Value, cancellationToken);
        if (hall is null)
        {
            return Build(language, AiAssistantResponseKind.Clarification, "Hall not found.", null);
        }

        if (state?.BookingDate is not { } date)
        {
            return Build(language, AiAssistantResponseKind.Clarification, "Please provide the date for the booking.", null);
        }

        if (state.BookingStartTime is not { } startTime || state.BookingEndTime is not { } endTime)
        {
            return Build(language, AiAssistantResponseKind.Clarification, "Please provide the start and end time for the booking.", null);
        }

        var customerName = state.BookingCustomerName;
        if (string.IsNullOrWhiteSpace(customerName))
        {
            return Build(language, AiAssistantResponseKind.Clarification, "Please provide the customer name for the booking.", null);
        }

        // This path only prepares a preview; it never creates or submits a booking.
        return await CreateBookingThroughToolAsync(
            language, hall, customerName, hallId.Value, date, startTime, endTime, cancellationToken);
    }

    private async Task<AiAssistantResponse?> HandleResultComparisonAsync(
        AiSemanticPlan plan,
        IReadOnlyList<Guid> hallIds,
        string language,
        CancellationToken cancellationToken)
    {
        var selected = plan.SelectedResultReferences is { Count: > 0 }
            ? plan.SelectedResultReferences.Select(reference => reference.Index).Distinct().Take(10).ToArray()
            : plan.SelectedResultReference is { } single ? [single.Index] : [];

        var ids = selected.Length == 0
            ? hallIds.Take(10).ToArray()
            : selected.Where(index => index >= 0 && index < hallIds.Count)
                .Select(index => hallIds[index]).Distinct().Take(10).ToArray();

        if (plan.ComparisonIntent == AiComparisonIntent.CompareSelected && ids.Length < 2)
        {
            var clarification = language == "en"
                ? "Tell me which two results to compare, for example the first and third."
                : "احكيلي أي نتيجتين بدك أقارن، مثلاً الأولى والثالثة.";
            return Build(language, AiAssistantResponseKind.Clarification, clarification, null);
        }

        if (plan.ComparisonIntent == AiComparisonIntent.MostSuitable && !HasSuitabilityCriteria(plan))
        {
            var clarify = language == "en"
                ? "What matters most for a suitable hall: staying under a budget, guest capacity, or a specific area?"
                : "شو الأهم بالنسبة للقاعة الأنسب: الميزانية، عدد الضيوف، ولا منطقة معيّنة؟";
            return Build(language, AiAssistantResponseKind.Clarification, clarify, null);
        }

        var rankingTimer = Stopwatch.StartNew();
        var current = new List<HallDetailsDto>();
        foreach (var hallId in ids)
        {
            try { current.Add(await _hallDetailsService.GetHallDetailsAsync(hallId, cancellationToken)); }
            catch (NotFoundException)
            {
                // Removed or no longer public results are omitted from a comparison.
            }
        }

        if (current.Count == 0)
        {
            return null;
        }

        if (plan.ComparisonIntent == AiComparisonIntent.CompareSelected)
        {
            var facts = current.Select(hall =>
            {
                var price = hall.ShowPrice && hall.Price.HasValue
                    ? $"{hall.Price.Value.ToString("0.##", CultureInfo.InvariantCulture)} { (language == "en" ? "ILS" : "شيكل") }"
                    : (language == "en" ? "price not published" : "السعر غير منشور");
                return language == "en"
                    ? $"{hall.HallName}: capacity {hall.Capacity}, {price}, {hall.Address}."
                    : $"{hall.HallName}: السعة {hall.Capacity}، {price}، {hall.Address}.";
            });
            var message = string.Join(language == "en" ? " " : "\n", facts);
            return Build(language, AiAssistantResponseKind.Answer, message, null);
        }

        HallDetailsDto? winner = plan.ComparisonIntent switch
        {
            AiComparisonIntent.Cheapest => current.Where(HasPublishedPrice).OrderBy(hall => hall.Price).FirstOrDefault(),
            AiComparisonIntent.MostExpensive => current.Where(HasPublishedPrice).OrderByDescending(hall => hall.Price).FirstOrDefault(),
            AiComparisonIntent.Largest => current.OrderByDescending(hall => hall.Capacity).FirstOrDefault(),
            AiComparisonIntent.Smallest => current.OrderBy(hall => hall.Capacity).FirstOrDefault(),
            AiComparisonIntent.BestBudgetFit when plan.PriceBudget.AroundPrice is { } target
                => current.Where(HasPublishedPrice).OrderBy(hall => Math.Abs(hall.Price!.Value - target)).FirstOrDefault(),
            AiComparisonIntent.MostSuitable when HasSuitabilityCriteria(plan)
                => current.Where(hall => IsWithinHardConstraints(hall, plan))
                    .OrderBy(hall => SuitabilityScore(hall, plan))
                    .ThenBy(hall => hall.HallName, StringComparer.Ordinal)
                    .FirstOrDefault(),
            _ => null
        };
        rankingTimer.Stop();
        if (plan.ComparisonIntent == AiComparisonIntent.MostSuitable)
        {
            _logger.LogInformation(
                "Hall recommendation ranking: candidateCount={CandidateCount} validCount={ValidCount} rankingMs={RankingMs} method={Method}",
                ids.Length,
                current.Count(hall => IsWithinHardConstraints(hall, plan)),
                rankingTimer.ElapsedMilliseconds,
                "explicit-criteria");
        }

        if (winner is null)
        {
            if (plan.ComparisonIntent == AiComparisonIntent.MostSuitable)
            {
                var noMatch = language == "en"
                    ? "None of the shown halls meets all those criteria. You can adjust the budget, guest count, or area and I can search again."
                    : "ما في قاعة من النتائج المعروضة بتطابق كل هالمعايير. ممكن نعدّل الميزانية أو عدد الضيوف أو المنطقة وببحث من جديد.";
                return Build(language, AiAssistantResponseKind.Answer, noMatch, null);
            }
            var noPrice = language == "en"
                ? "I can't compare these results because none has a currently published price."
                : "ما بقدر أقارن الأسعار لأن ما في نتيجة بسعر منشور حالياً.";
            return Build(language, AiAssistantResponseKind.Answer, noPrice, null);
        }

        var winnerMessage = plan.ComparisonIntent switch
        {
            AiComparisonIntent.Cheapest => language == "en"
                ? $"The lowest currently published price among these results is {winner.HallName} at {winner.Price!.Value.ToString("0.##", CultureInfo.InvariantCulture)} ILS."
                : $"أقل سعر منشور حالياً بين النتائج هو {winner.HallName}: {winner.Price!.Value.ToString("0.##", CultureInfo.InvariantCulture)} شيكل.",
            AiComparisonIntent.MostExpensive => language == "en"
                ? $"The highest currently published price among these results is {winner.HallName} at {winner.Price!.Value.ToString("0.##", CultureInfo.InvariantCulture)} ILS."
                : $"أعلى سعر منشور حالياً بين النتائج هو {winner.HallName}: {winner.Price!.Value.ToString("0.##", CultureInfo.InvariantCulture)} شيكل.",
            AiComparisonIntent.Largest => language == "en"
                ? $"The largest capacity among these results is {winner.HallName}, for {winner.Capacity} guests."
                : $"أكبر سعة بين النتائج هي لـ{winner.HallName}: {winner.Capacity} شخص.",
            AiComparisonIntent.Smallest => language == "en"
                ? $"The smallest capacity among these results is {winner.HallName}, for {winner.Capacity} guests."
                : $"أقل سعة بين النتائج هي لـ{winner.HallName}: {winner.Capacity} شخص.",
            AiComparisonIntent.MostSuitable => SuitabilityMessage(winner, plan, language),
            _ => language == "en"
                ? $"The closest currently published price to your budget is {winner.HallName} at {winner.Price!.Value.ToString("0.##", CultureInfo.InvariantCulture)} ILS."
                : $"أقرب سعر منشور لميزانيتك هو {winner.HallName}: {winner.Price!.Value.ToString("0.##", CultureInfo.InvariantCulture)} شيكل."
        };

        var intent = new AiAssistantIntentDto(AiIntentType.GetHallDetails, null, null, null, null, winner.HallName);
        return Build(language, AiAssistantResponseKind.HallDetails, winnerMessage, intent, hallDetails: winner);

        static bool HasPublishedPrice(HallDetailsDto hall) => hall.ShowPrice && hall.Price.HasValue;
        static bool HasSuitabilityCriteria(AiSemanticPlan candidatePlan)
            => candidatePlan.PriceBudget.IsSpecified || candidatePlan.Capacity.HasValue
                || !string.IsNullOrWhiteSpace(candidatePlan.Region) || !string.IsNullOrWhiteSpace(candidatePlan.Area);
        static bool IsWithinHardConstraints(HallDetailsDto hall, AiSemanticPlan candidatePlan)
            => (!candidatePlan.PriceBudget.MinimumPrice.HasValue || hall.ShowPrice && hall.Price >= candidatePlan.PriceBudget.MinimumPrice)
                && (!candidatePlan.PriceBudget.MaximumPrice.HasValue || hall.ShowPrice && hall.Price <= candidatePlan.PriceBudget.MaximumPrice)
                && (!candidatePlan.Capacity.HasValue || hall.Capacity >= candidatePlan.Capacity.Value)
                && (string.IsNullOrWhiteSpace(candidatePlan.Area) || hall.Address.Contains(candidatePlan.Area, StringComparison.OrdinalIgnoreCase))
                && (string.IsNullOrWhiteSpace(candidatePlan.Region) || hall.Region.Contains(candidatePlan.Region, StringComparison.OrdinalIgnoreCase));
        static decimal SuitabilityScore(HallDetailsDto hall, AiSemanticPlan candidatePlan)
        {
            decimal score = 0;
            if (candidatePlan.PriceBudget.AroundPrice is { } target && HasPublishedPrice(hall))
                score += Math.Abs(hall.Price!.Value - target) / Math.Max(1m, target);
            else if (candidatePlan.PriceBudget.MaximumPrice is not null && HasPublishedPrice(hall))
                score += hall.Price!.Value / Math.Max(1m, candidatePlan.PriceBudget.MaximumPrice.Value);
            if (candidatePlan.Capacity is { } capacity && hall.Capacity >= capacity)
                score += (hall.Capacity - capacity) / (decimal)Math.Max(capacity, 1) * 0.5m;
            if (!string.IsNullOrWhiteSpace(candidatePlan.Area)
                && !hall.Address.Contains(candidatePlan.Area, StringComparison.OrdinalIgnoreCase))
                score += 2m;
            if (!string.IsNullOrWhiteSpace(candidatePlan.Region)
                && !hall.Region.Contains(candidatePlan.Region, StringComparison.OrdinalIgnoreCase))
                score += 2m;
            if (!HasPublishedPrice(hall) && candidatePlan.PriceBudget.IsSpecified)
                score += 0.25m;
            return score;
        }
        static string SuitabilityMessage(HallDetailsDto hall, AiSemanticPlan candidatePlan, string responseLanguage)
        {
            var publishedPrice = hall.ShowPrice && hall.Price.HasValue;
            var price = publishedPrice
                ? $"{hall.Price!.Value.ToString("0.##", CultureInfo.InvariantCulture)} {(responseLanguage == "en" ? "ILS" : "شيكل")}"
                : (responseLanguage == "en" ? "price not published" : "السعر غير منشور");
            var reasons = new List<string>();
            if (publishedPrice && candidatePlan.PriceBudget.IsSpecified)
                reasons.Add(responseLanguage == "en" ? $"published price {price}" : $"سعرها المنشور {price}");
            if (candidatePlan.Capacity is { } requested)
                reasons.Add(responseLanguage == "en"
                    ? $"capacity {hall.Capacity} for about {requested} guests"
                    : $"سعتها {hall.Capacity} لـ{requested} ضيف");
            if (!string.IsNullOrWhiteSpace(candidatePlan.Area))
                reasons.Add(responseLanguage == "en" ? $"area {hall.Address}" : $"موقعها {hall.Address}");
            if (!string.IsNullOrWhiteSpace(candidatePlan.Region) && reasons.Count == 0)
                reasons.Add(responseLanguage == "en" ? $"region {hall.Region}" : $"منطقتها {hall.Region}");
            var why = reasons.Count == 0
                ? (responseLanguage == "en" ? "it best matches your stated criteria" : "هي الأقرب لمعاييرك المذكورة")
                : string.Join(responseLanguage == "en" ? " and " : "، ", reasons);
            return responseLanguage == "en"
                ? $"Based on the results and your criteria, {hall.HallName} is the best fit because {why}."
                : $"اخترت {hall.HallName} من النتائج لأنها تطابق معاييرك: {why}.";
        }
    }

    private static string[] SuitabilityReasons(HallDetailsDto hall, AiSemanticPlan plan, string language)
    {
        var reasons = new List<string>();
        if (hall.ShowPrice && hall.Price is { } price && plan.PriceBudget.IsSpecified)
        {
            var formatted = price.ToString("0.##", CultureInfo.InvariantCulture);
            if (plan.PriceBudget.MaximumPrice is { } max && price <= max)
                reasons.Add(language == "en" ? $"its published price {formatted} ILS is within your {max:0.##} ILS budget" : $"سعرها المنشور {formatted} شيكل ضمن ميزانيتك {max:0.##} شيكل");
            else if (plan.PriceBudget.MinimumPrice is { } min && price >= min)
                reasons.Add(language == "en" ? $"its published price {formatted} ILS meets your minimum budget" : $"سعرها المنشور {formatted} شيكل يحقق الحد الأدنى لميزانيتك");
            else if (plan.PriceBudget.AroundPrice is { } target)
                reasons.Add(language == "en" ? $"its published price {formatted} ILS is close to your {target:0.##} ILS target" : $"سعرها المنشور {formatted} شيكل قريب من ميزانيتك المستهدفة {target:0.##} شيكل");
        }
        if (plan.Capacity is { } capacity)
            reasons.Add(language == "en" ? $"its capacity of {hall.Capacity} covers about {capacity} guests" : $"سعتها {hall.Capacity} شخص وتكفي العدد المطلوب {capacity}");
        if (!string.IsNullOrWhiteSpace(plan.Area))
            reasons.Add(language == "en" ? $"its address is {hall.Address}" : $"عنوانها {hall.Address} في المنطقة المطلوبة");
        if (!string.IsNullOrWhiteSpace(plan.Region) && reasons.Count == 0)
            reasons.Add(language == "en" ? $"it is in {hall.Region}" : $"تقع في {hall.Region}");
        return reasons.ToArray();
    }

    private async Task<AiAssistantResponse> HandleCheapestShownHallAsync(
        IReadOnlyList<Guid> hallIds,
        string language,
        CancellationToken cancellationToken)
    {
        var candidates = new List<HallDetailsDto>();
        foreach (var hallId in hallIds.Take(10))
        {
            try
            {
                var hall = await _hallDetailsService.GetHallDetailsAsync(hallId, cancellationToken);
                if (hall.ShowPrice && hall.Price.HasValue)
                {
                    candidates.Add(hall);
                }
            }
            catch (NotFoundException)
            {
                // A hall can become unavailable after a result was shown. Ignore it
                // and compare only currently public, re-fetched hall details.
            }
        }

        var cheapest = candidates.OrderBy(hall => hall.Price).FirstOrDefault();
        if (cheapest is null)
        {
            var unavailable = language == "en"
                ? "I can't compare these halls because none has a published price. I can show halls whose owners publish their prices."
                : "ما بقدر أحدد الأرخص لأن أسعار القاعات في النتائج غير منشورة. بقدر أعرض القاعات اللي أصحابها ناشرين أسعارها.";
            return Build(language, AiAssistantResponseKind.Answer, unavailable, null);
        }

        var price = cheapest.Price!.Value.ToString("0.##", CultureInfo.InvariantCulture);
        var message = language == "en"
            ? $"The lowest published price among these results is {cheapest.HallName} at {price} ILS."
            : $"أرخص قاعة من النتائج هي {cheapest.HallName} بسعر {price} شيكل.";
        var intent = new AiAssistantIntentDto(AiIntentType.GetHallDetails, null, null, null, null, cheapest.HallName);
        return Build(language, AiAssistantResponseKind.HallDetails, message, intent, hallDetails: cheapest);
    }

    private static IReadOnlyList<Guid> GetConversationHallIds(AiConversationContext? context)
    {
        if (context?.LastHalls is { Count: > 0 } halls)
        {
            return halls.Select(hall => hall.HallId).Distinct().Take(10).ToArray();
        }

        return context?.State?.ShownHallIds?.Distinct().Take(10).ToArray() ?? [];
    }

    private static bool IsHallSearchContext(AiConversationContext? context)
        => context?.LastIntent?.Intent == AiIntentType.SearchHalls
            || string.Equals(context?.State?.ActiveGoal, "find_hall", StringComparison.Ordinal);

    private static bool IsBareAreaRequest(string message, string? area)
    {
        if (string.IsNullOrWhiteSpace(area))
        {
            return false;
        }

        if (!NaturalLanguageCriteriaExtractor.IsCatalogArea(area))
        {
            return false;
        }

        var foldedMessage = AiText.Normalize(message).Trim();
        var foldedArea = AiText.Normalize(area).Trim();
        return foldedMessage == foldedArea
            || foldedMessage == $"في {foldedArea}"
            || foldedMessage == $"ب{foldedArea}";
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
        var terms = HallNameSearchTerms(hallName);
        var candidates = new Dictionary<Guid, HallListItemDto>();
        foreach (var term in terms.Take(6))
        {
            var page = await _hallSearchService.SearchHallsAsync(
                new HallSearchRequest { Name = term, PageNumber = 1, PageSize = HallResolutionLimit },
                cancellationToken);
            foreach (var hall in page.Items)
                candidates.TryAdd(hall.HallId, hall);
        }

        var ranked = candidates.Values
            .Select(hall => (Hall: hall, Score: HallNameSimilarity(terms, hall.HallName)))
            .Where(candidate => candidate.Score >= 0.9)
            .OrderByDescending(candidate => candidate.Score)
            .ThenBy(candidate => candidate.Hall.HallName, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (ranked.Length == 0 || ranked.Length > 1 && ranked[0].Score - ranked[1].Score < 0.15)
            return null;

        return ranked[0].Hall;
    }

    private static IReadOnlyList<string> HallNameSearchTerms(string hallName)
    {
        var terms = new List<string> { hallName.Trim() };
        var normalized = AiText.Normalize(hallName);
        if (normalized.Contains("سيتي ستارز", StringComparison.Ordinal))
            terms.Add("City Stars");
        if (normalized.Contains("city stars", StringComparison.OrdinalIgnoreCase))
            terms.Add("سيتي ستارز");

        terms.AddRange(hallName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        return terms.Where(value => value.Length is > 0 and <= 120).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private static double HallNameSimilarity(IReadOnlyList<string> searchTerms, string candidateName)
    {
        var candidate = HallNameTokens(candidateName);
        if (candidate.Length == 0)
            return 0;

        var best = 0d;
        foreach (var term in searchTerms)
        {
            var query = HallNameTokens(term);
            if (query.Length != candidate.Length)
                continue;

            var matched = 0;
            for (var index = 0; index < query.Length; index++)
            {
                if (string.Equals(query[index], candidate[index], StringComparison.Ordinal))
                {
                    matched++;
                    continue;
                }

                if (query[index].Length >= 4 && candidate[index].Length >= 4
                    && EditDistanceAtMostOne(query[index], candidate[index]))
                    matched++;
            }

            var score = (double)matched / query.Length;
            if (score > best)
                best = score;
        }

        return best;
    }

    private static string[] HallNameTokens(string value)
        => AiText.Normalize(value)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(token => token is not "hall" and not "قاعة" and not "قاعه" and not "صالة" and not "صاله")
            .ToArray();

    private static bool EditDistanceAtMostOne(string left, string right)
    {
        if (Math.Abs(left.Length - right.Length) > 1)
            return false;

        var leftIndex = 0;
        var rightIndex = 0;
        var edits = 0;
        while (leftIndex < left.Length && rightIndex < right.Length)
        {
            if (left[leftIndex] == right[rightIndex])
            {
                leftIndex++;
                rightIndex++;
                continue;
            }

            if (++edits > 1)
                return false;
            if (left.Length > right.Length) leftIndex++;
            else if (right.Length > left.Length) rightIndex++;
            else { leftIndex++; rightIndex++; }
        }

        return edits + (leftIndex < left.Length || rightIndex < right.Length ? 1 : 0) <= 1;
    }

    private static bool LooksLikeBareHallName(string text)
    {
        var words = text.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return words.Length is > 0 and <= 4
            && words.All(word => word.All(character => char.IsAsciiLetter(character) || character is '-' or '&' or '\''))
            && !words.Any(word => word.Equals("hall", StringComparison.OrdinalIgnoreCase)
                || word.Equals("halls", StringComparison.OrdinalIgnoreCase)
                || word.Equals("wedding", StringComparison.OrdinalIgnoreCase)
                || word.Equals("weddings", StringComparison.OrdinalIgnoreCase)
                || word.Equals("please", StringComparison.OrdinalIgnoreCase)
                || word.Equals("show", StringComparison.OrdinalIgnoreCase)
                || word.Equals("find", StringComparison.OrdinalIgnoreCase));
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
