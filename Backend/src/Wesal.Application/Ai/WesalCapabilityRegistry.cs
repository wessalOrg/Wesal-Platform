using Wesal.Application.Ai.Navigation;

namespace Wesal.Application.Ai;

public enum WesalCapabilityStatus
{
    Available,
    ComingSoon,
    Unavailable,
    Private,
    AuthRequired
}

/// <summary>Application-owned description of one implemented Wesal capability.</summary>
public sealed record WesalCapability(
    string Key,
    string LabelAr,
    string LabelEn,
    WesalCapabilityStatus Status,
    string? PageKey,
    bool AssistantNavigable,
    bool RequiresAuth,
    IReadOnlyList<string> AvailableTools,
    string? KnowledgeSource,
    IReadOnlyList<string> SupportedActions,
    IReadOnlyList<string> UnsupportedActions);

/// <summary>
/// The assistant's shared current-product truth. Route resolution remains owned by
/// <see cref="WesalNavigationRegistry"/>; this registry records what each real route
/// and tool can currently do, including services that are planned or absent.
/// </summary>
public static class WesalCapabilityRegistry
{
    private static readonly IReadOnlyList<WesalCapability> Registry =
    [
        Capability("halls.search", "البحث عن القاعات", "Search halls", WesalCapabilityStatus.Available,
            WesalNavigationRegistry.Halls, false, false, ["search_halls"], "user-guide/search",
            ["search public approved halls by location, date and capacity"], ["create or change bookings"]),
        Capability("halls.details", "تفاصيل القاعات", "Hall details", WesalCapabilityStatus.Available,
            WesalNavigationRegistry.Halls, false, false, ["get_hall_details"], "user-guide/hall-details",
            ["read public hall information"], ["change owner-managed hall data"]),
        Capability("halls.availability", "توفر القاعات", "Hall availability", WesalCapabilityStatus.Available,
            WesalNavigationRegistry.Halls, false, false, ["check_hall_availability"], "user-guide/booking",
            ["read hourly availability for a date"], ["reserve a slot or guarantee future availability"]),
        Capability("hall.booking", "حجز القاعة", "Book a hall", WesalCapabilityStatus.Available,
            WesalNavigationRegistry.Halls, true, true, [], "user-guide/booking",
            ["guide the user through the booking flow"], ["create, cancel or pay for a booking on the user's behalf"]),
        Capability("photographers.marketplace", "المصورين", "Photographers", WesalCapabilityStatus.ComingSoon,
            WesalNavigationRegistry.Photographers, true, false, [], "platform/about-wesal",
            ["explain that the service is coming soon"], ["search, compare or book photographers"]),
        Capability("event_planners.marketplace", "منسقي المناسبات", "Event planners", WesalCapabilityStatus.ComingSoon,
            WesalNavigationRegistry.EventPlanners, true, false, [], "platform/about-wesal",
            ["explain that the service is coming soon"], ["search, compare or book event planners"]),
        Capability("catering", "الضيافة والبوفيه", "Catering", WesalCapabilityStatus.Unavailable,
            null, false, false, [], "platform/about-wesal", [], ["find or book catering"]),
        Capability("private.bookings", "الحجوزات الخاصة", "Private bookings", WesalCapabilityStatus.AuthRequired,
            WesalNavigationRegistry.Bookings, true, true, [], "user-guide/booking-status",
            ["navigate the user to their bookings after normal authentication"], []),
        Capability("private.bookings.data", "بيانات الحجوزات الخاصة", "Private booking data", WesalCapabilityStatus.Private,
            WesalNavigationRegistry.Bookings, false, true, [], "user-guide/booking-status",
            ["view only through the authenticated Wesal application"], ["read private booking records through public assistant tools"])
    ];

    public static IReadOnlyList<WesalCapability> All => Registry;

    public static WesalCapability? Find(string? key)
        => string.IsNullOrWhiteSpace(key)
            ? null
            : Registry.FirstOrDefault(item => string.Equals(item.Key, key.Trim(), StringComparison.Ordinal));

    public static string BuildAssistantContext()
        => string.Join("\n", Registry.Select(item =>
            $"{item.Key} ({item.LabelEn} / {item.LabelAr}): status={item.Status}; " +
            $"route={(item.PageKey is null ? "none" : WesalNavigationRegistry.Find(item.PageKey)?.Path ?? "none")}; " +
            $"assistantNavigable={item.AssistantNavigable}; authRequired={item.RequiresAuth}; " +
            $"tools={(item.AvailableTools.Count == 0 ? "none" : string.Join(",", item.AvailableTools))}; " +
            $"knowledge={(item.KnowledgeSource ?? "none")}; " +
            $"supported=[{string.Join("; ", item.SupportedActions)}]; " +
            $"unsupported=[{string.Join("; ", item.UnsupportedActions)}]."));

    private static WesalCapability Capability(
        string key,
        string labelAr,
        string labelEn,
        WesalCapabilityStatus status,
        string? pageKey,
        bool navigable,
        bool requiresAuth,
        string[] tools,
        string? source,
        string[] supported,
        string[] unsupported)
        => new(key, labelAr, labelEn, status, pageKey, navigable, requiresAuth, tools, source, supported, unsupported);
}
