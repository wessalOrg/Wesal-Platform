using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public sealed record EventRequestCreateRequest(string? FullName, DateOnly? EventDate, EventType? EventType,
    bool? NeedsHall, bool? NeedsDecorationAndGifts, bool? NeedsPhotographers);

public sealed record EventRequestResponse(Guid Id, DateTimeOffset CreatedAt, DateOnly EventDate,
    EventType EventType, string EventTypeLabel, IReadOnlyList<ServiceType> ServicesToNotify);

public sealed record EventTypeConfiguration(EventType Value, string Label, string HallQuestion,
    string DecorationAndGiftsQuestion, string PhotographersQuestion);

public sealed record AdminEventRequestResponse(Guid Id, string SeekerId, string SeekerFullName,
    DateOnly EventDate, EventType EventType, bool NeedsHall, bool NeedsDecorationAndGifts,
    bool NeedsPhotographers, DateTimeOffset CreatedAt);
