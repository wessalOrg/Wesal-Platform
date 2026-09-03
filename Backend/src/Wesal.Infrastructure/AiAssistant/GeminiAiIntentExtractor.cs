using System.Globalization;
using Microsoft.Extensions.Logging;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// <see cref="IAiIntentExtractor"/> backed by Gemini structured output. When Gemini
/// is disabled, fails, times out, returns invalid JSON, or returns an
/// unrecognized classification, control falls through to the deterministic
/// <see cref="AiIntentFallbackClassifier"/>. Every extracted value is validated:
/// regions/periods must match the platform enums, dates must be real ISO dates,
/// capacities must be within bounds, and hall names are trimmed and length-capped.
/// </summary>
public sealed class GeminiAiIntentExtractor : IAiIntentExtractor
{
    private const int MinCapacity = 1;
    private const int MaxCapacity = 9999;
    private const int MaxHallNameLength = 120;

    private readonly IGeminiService _geminiService;
    private readonly IAiLanguageDetector _languageDetector;
    private readonly AiIntentFallbackClassifier _fallbackClassifier;
    private readonly ILogger<GeminiAiIntentExtractor> _logger;

    public GeminiAiIntentExtractor(
        IGeminiService geminiService,
        IAiLanguageDetector? languageDetector,
        AiIntentFallbackClassifier fallbackClassifier,
        ILogger<GeminiAiIntentExtractor> logger)
    {
        _geminiService = geminiService;
        _languageDetector = languageDetector ?? new AiLanguageDetector();
        _fallbackClassifier = fallbackClassifier;
        _logger = logger;
    }

    public async Task<AiAssistantIntentDto> ExtractAsync(
        string message,
        string? language,
        CancellationToken cancellationToken = default,
        AiConversationContext? context = null)
    {
        if (_geminiService.IsAvailable)
        {
            var userPrompt = GeminiPromptBuilder.BuildIntentUserPrompt(
                message,
                context,
                GeminiPromptBuilder.MaxIntentPromptCharacters);

            var payload = await _geminiService.GenerateStructuredAsync<GeminiIntentPayload>(
                userPrompt,
                GeminiPromptBuilder.BuildIntentSystemInstruction(language),
                GeminiPromptBuilder.BuildIntentSchema(),
                cancellationToken);

            if (payload is not null)
            {
                var intent = MapPayload(payload);
                if (intent.Intent is not AiIntentType.Unknown)
                {
                    return intent;
                }

                _logger.LogInformation(
                    "Gemini returned an unrecognized intent ({RawIntent}); using deterministic classifier.",
                    payload.Intent);
            }
        }

        return _fallbackClassifier.Classify(message);
    }

    private static AiAssistantIntentDto MapPayload(GeminiIntentPayload payload)
    {
        return new AiAssistantIntentDto(
            MapIntent(payload.Intent),
            NormalizeRegion(payload.Region),
            NormalizeArea(payload.Area),
            ParseDate(payload.Date),
            MapBookingPeriod(payload.BookingPeriod),
            NormalizeCapacity(payload.Capacity),
            NormalizeHallName(payload.HallName));
    }

    private static AiIntentType MapIntent(string? raw)
    {
        return raw?.Trim().ToLowerInvariant() switch
        {
            "search_halls" => AiIntentType.SearchHalls,
            "get_hall_details" => AiIntentType.GetHallDetails,
            "check_hall_availability" => AiIntentType.CheckHallAvailability,
            "get_featured_halls" => AiIntentType.GetFeaturedHalls,
            "how_to" => AiIntentType.HowTo,
            "unsupported" => AiIntentType.Unsupported,
            _ => AiIntentType.Unknown
        };
    }

    private static string? NormalizeRegion(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        if (Enum.TryParse<HallRegion>(raw.Trim(), true, out var region))
        {
            return region.ToString();
        }

        return raw.Trim().Length <= 40 ? raw.Trim() : null;
    }

    private static string? NormalizeArea(string? raw)
    {
        var area = raw?.Trim();
        return string.IsNullOrWhiteSpace(area) || area.Length > 80 ? null : area;
    }

    private static DateOnly? ParseDate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var candidate = raw.Trim();
        if (candidate.Length > 10 && DateTime.TryParse(candidate, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dateTime))
        {
            return DateOnly.FromDateTime(dateTime);
        }

        if (DateOnly.TryParseExact(candidate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            return date;
        }

        return DateOnly.TryParse(candidate, CultureInfo.InvariantCulture, DateTimeStyles.None, out var generic)
            ? generic
            : null;
    }

    private static BookingPeriodType? MapBookingPeriod(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        if (Enum.TryParse<BookingPeriodType>(raw.Trim(), true, out var period))
        {
            return period;
        }

        return raw.Trim().ToLowerInvariant() switch
        {
            "morning" or "صباحية" or "الفترة الأولى" => BookingPeriodType.FirstPeriod,
            "evening" or "afternoon" or "مسائية" or "الفترة الثانية" => BookingPeriodType.SecondPeriod,
            _ => null
        };
    }

    private static int? NormalizeCapacity(int? raw)
    {
        return raw.HasValue && raw.Value >= MinCapacity && raw.Value <= MaxCapacity ? raw.Value : null;
    }

    private static string? NormalizeHallName(string? raw)
    {
        var name = raw?.Trim();
        if (string.IsNullOrWhiteSpace(name) || name.Length > MaxHallNameLength)
        {
            return null;
        }

        return name;
    }

    /// <summary>
    /// Payload shape mirroring the responseSchema properties exactly (camelCase
    /// property names via the shared serializer policy).
    /// </summary>
    private sealed record GeminiIntentPayload(
        string? Intent,
        string? Region,
        string? Area,
        string? Date,
        string? BookingPeriod,
        int? Capacity,
        string? HallName);
}