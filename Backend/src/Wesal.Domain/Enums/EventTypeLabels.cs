namespace Wesal.Domain.Enums;

/// <summary>
/// Single source of the Arabic display labels for <see cref="EventType"/>. The event
/// request configuration, notification text and conversation context card all use the
/// same wording, so a future label change cannot drift between them.
/// </summary>
public static class EventTypeLabels
{
    public static string Get(EventType eventType) => eventType switch
    {
        EventType.GRADUATION => "حفل تخرج",
        EventType.WEDDING => "زفاف",
        EventType.NEWBORN => "حفل مولود",
        EventType.WORKSHOP => "ورشة عمل",
        EventType.IMPORTANT_EVENT => "حدث مهم",
        EventType.YOUTH_PARTY => "حفلة شباب",
        _ => throw new ArgumentOutOfRangeException(nameof(eventType), eventType, "Unknown event type.")
    };
}
