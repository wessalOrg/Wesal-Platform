using System.Globalization;
using Microsoft.Extensions.Logging;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Halls;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Unified AI assistant orchestrator. A single Gemini call (inside the intent
/// extractor) classifies the message into a structured intent; this service then
/// resolves every intent against existing, verified platform services and
/// repositories (recommendations, hall details, featured halls, how-to guidance).
/// Gemini never performs actions or touches the database, and no second Gemini
/// call is made unless a future phase opts into natural-language response
/// generation. All outgoing text is deterministic, bilingual (ar/en) and safe.
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
    private readonly IHallRepository _hallRepository;
    private readonly IAiLanguageDetector _languageDetector;
    private readonly IDateTime _dateTime;

    public AiAssistantService(
        IAiIntentExtractor intentExtractor,
        IHowToService howToService,
        IRecommendationService recommendationService,
        IFeaturedHallsService featuredHallsService,
        IHallDetailsService hallDetailsService,
        IHallRepository hallRepository,
        IAiLanguageDetector? languageDetector,
        IDateTime dateTime,
        ILogger<AiAssistantService> logger)
    {
        _intentExtractor = intentExtractor;
        _howToService = howToService;
        _recommendationService = recommendationService;
        _featuredHallsService = featuredHallsService;
        _hallDetailsService = hallDetailsService;
        _hallRepository = hallRepository;
        _languageDetector = languageDetector ?? new AiLanguageDetector();
        _dateTime = dateTime;
    }

    public async Task<AiAssistantResponse> ProcessMessageAsync(
        string message,
        string? language,
        CancellationToken cancellationToken = default,
        AiConversationContext? context = null)
    {
        var text = message?.Trim();
        if (string.IsNullOrWhiteSpace(text) || text.Length > MaxMessageLength)
        {
            throw new ArgumentException(
                $"Message is required and must not exceed {MaxMessageLength} characters.",
                nameof(message));
        }

        var detected = _languageDetector.Detect(text);
        var effectiveLanguage = detected ?? (string.IsNullOrWhiteSpace(language) ? DefaultLanguage : language);

        cancellationToken.ThrowIfCancellationRequested();

        var intent = await _intentExtractor.ExtractAsync(text, effectiveLanguage, cancellationToken, context);
        intent = MergeWithContext(intent, context);

        return intent.Intent switch
        {
            AiIntentType.HowTo => await HandleHowToAsync(text, effectiveLanguage, intention: intent, cancellationToken),
            AiIntentType.SearchHalls => await HandleSearchHallsAsync(text, effectiveLanguage, intention: intent, cancellationToken),
            AiIntentType.GetFeaturedHalls => await HandleFeaturedHallsAsync(effectiveLanguage, intention: intent, cancellationToken),
            AiIntentType.GetHallDetails => await HandleHallDetailsAsync(effectiveLanguage, intention: intent, cancellationToken),
            AiIntentType.CheckHallAvailability => await HandleAvailabilityAsync(effectiveLanguage, intention: intent, cancellationToken),
            AiIntentType.Unsupported => BuildUnsupported(effectiveLanguage, intention: intent),
            _ => BuildClarification(effectiveLanguage, intention: intent)
        };
    }

    /// <summary>
    /// When the user is refining a previous hall search (a follow-up expressed with
    /// pronouns or partial criteria, e.g. "خليها أقرب على غزة" or "300 شخص"), carry
    /// forward any search criterion that was established earlier in the conversation
    /// but is not re-stated this turn. Only applies when both the current and prior
    /// intents are hall searches, so it never invents values Gemini rejected.
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
        var period = intent.BookingPeriod ?? prior.BookingPeriod;
        var capacity = intent.Capacity ?? prior.Capacity;

        if (region == intent.Region
            && area == intent.Area
            && date == intent.Date
            && period == intent.BookingPeriod
            && capacity == intent.Capacity)
        {
            return intent;
        }

        return new AiAssistantIntentDto(
            intent.Intent,
            region,
            area,
            date,
            period,
            capacity,
            intent.HallName);
    }

    private async Task<AiAssistantResponse> HandleHowToAsync(string text, string language, AiAssistantIntentDto intention, CancellationToken cancellationToken)
    {
        var answer = await _howToService.AskHowToAsync(text, language, cancellationToken);

        return Build(
            language,
            AiAssistantResponseKind.Answer,
            answer.Answer,
            intention);
    }

    private async Task<AiAssistantResponse> HandleSearchHallsAsync(string text, string language, AiAssistantIntentDto intention, CancellationToken cancellationToken)
    {
        var result = await _recommendationService.GetRecommendationsAsync(text, language, cancellationToken);

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

    private async Task<AiAssistantResponse> HandleHallDetailsAsync(string language, AiAssistantIntentDto intention, CancellationToken cancellationToken)
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
            details = await _hallDetailsService.GetHallDetailsAsync(hall.Id, cancellationToken);
        }
        catch (NotFoundException)
        {
            return Build(language, AiAssistantResponseKind.Clarification, HallNotFoundMessage(language, hallName), intention);
        }

        var message = language == "en"
            ? $"Here are the details for {hall.Name}:"
            : $"هذه هي تفاصيل قاعة {hall.Name}:";

        return Build(language, AiAssistantResponseKind.HallDetails, message, intention, hallDetails: details);
    }

    private async Task<AiAssistantResponse> HandleAvailabilityAsync(string language, AiAssistantIntentDto intention, CancellationToken cancellationToken)
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
        if (date < DateOnly.FromDateTime(_dateTime.Now.UtcDateTime))
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

        var periods = await _hallRepository.GetBookingPeriodsAsync([hall.Id], cancellationToken);
        var availability = await _hallRepository.GetAvailabilityAsync([hall.Id], date, date, cancellationToken);

        var statusByPeriod = availability.ToDictionary(item => item.PeriodType, item => item.Status);

        var periodStatuses = periods
            .Select(period => new HallBookingPeriodStatusDto
            {
                PeriodType = period.Type,
                PeriodName = HallDisplayNames.GetPeriodName(period.Type),
                StartTime = period.StartTime,
                EndTime = period.EndTime,
                Status = statusByPeriod.TryGetValue(period.Type, out var status) ? status : AvailabilityStatus.Available
            })
            .ToList();

        var message = BuildAvailabilityMessage(language, hall.Name, date, periodStatuses);

        return Build(
            language,
            AiAssistantResponseKind.Availability,
            message,
            intention,
            availability: new AiAssistantAvailabilityDayDto(hall.Id, hall.Name, date, periodStatuses));
    }

    private async Task<Hall?> TryResolveHallAsync(string hallName, CancellationToken cancellationToken)
    {
        var normalized = hallName.Trim();
        var halls = await _hallRepository.SearchApprovedHallsAsync(
            normalized,
            region: null,
            area: null,
            date: null,
            period: null,
            skip: 0,
            take: HallResolutionLimit,
            cancellationToken);

        if (halls.Count == 0)
        {
            return null;
        }

        return halls.FirstOrDefault(hall => string.Equals(hall.Name, normalized, StringComparison.OrdinalIgnoreCase))
            ?? halls[0];
    }

    private static string BuildAvailabilityMessage(
        string language,
        string hallName,
        DateOnly date,
        IReadOnlyList<HallBookingPeriodStatusDto> periods)
    {
        var formattedDate = date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var available = periods.Where(p => p.Status == AvailabilityStatus.Available).ToList();

        if (periods.Count == 0)
        {
            return language == "en"
                ? $"This hall has no booking periods configured for {formattedDate}."
                : $"قاعة {hallName} لا تحتوي على فترات حجز معرفة لتاريخ {formattedDate}.";
        }

        if (available.Count == 0)
        {
            return language == "en"
                ? $"The hall is fully booked on {formattedDate}."
                : $"قاعة {hallName} محجوزة بالكامل في {formattedDate}.";
        }

        if (available.Count == periods.Count)
        {
            return language == "en"
                ? $"The hall is fully available on {formattedDate}."
                : $"قاعة {hallName} متاحة بالكامل في {formattedDate}.";
        }

        var availableNames = string.Join(", ", available.Select(p => p.PeriodName));
        return language == "en"
            ? $"On {formattedDate} the available period(s): {availableNames}."
            : $"في {formattedDate} الفترة (الفترات) المتاحة: {availableNames}.";
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
        AiAssistantIntentDto intention,
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