using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// Request for the unified AI assistant endpoint. The message is the raw user
/// input; classification into a structured intent happens server-side.
/// </summary>
public sealed record AiAssistantRequest(string? Message);

/// <summary>
/// Structured intent produced for a user message. <see cref="AiIntentType"/> carries
/// the single classification; the remaining fields hold only values that were
/// explicitly stated in the message (never guesses).
/// </summary>
public sealed record AiAssistantIntentDto(
    AiIntentType Intent,
    string? Region,
    string? Area,
    DateOnly? Date,
    BookingPeriodType? BookingPeriod,
    int? Capacity,
    string? HallName);

public enum AiIntentType
{
    SearchHalls,
    GetHallDetails,
    CheckHallAvailability,
    GetFeaturedHalls,
    HowTo,
    Unsupported,
    Unknown
}

/// <summary>
/// Discriminator the frontend uses to decide how to render a turn:
/// <see cref="Halls"/> lists halls, <see cref="HallDetails"/> carries one hall's
/// full details, <see cref="Availability"/> carries per-period availability,
/// <see cref="Clarification"/> asks the user for more input,
/// <see cref="Unsupported"/> explains the action cannot be performed,
/// <see cref="Error"/> is a service-level failure, and
/// <see cref="Answer"/> is plain assistant text.
/// </summary>
public enum AiAssistantResponseKind
{
    Answer,
    Halls,
    HallDetails,
    Availability,
    Clarification,
    Unsupported,
    Error
}

public sealed record AiAssistantAvailabilityDayDto(
    Guid HallId,
    string HallName,
    DateOnly Date,
    IReadOnlyList<HallBookingPeriodStatusDto> Periods);

/// <summary>
/// Stable response contract for the unified assistant. <see cref="Halls"/>,
/// <see cref="HallDetails"/> and <see cref="Availability"/> are populated according
/// to <see cref="Kind"/>; unrelated payload fields stay empty.
/// </summary>
public sealed record AiAssistantResponse(
    AiAssistantResponseKind Kind,
    string Message,
    string ResponseLanguage,
    DateTime Timestamp,
    IReadOnlyList<HallRecommendationDto> Halls,
    HallDetailsDto? HallDetails,
    AiAssistantAvailabilityDayDto? Availability,
    AiAssistantIntentDto? Intent);