namespace Wesal.Domain.Constants;

/// <summary>
/// The management interface a Hall Owner is routed to after tapping the Profile
/// icon in the top bar (US-OWNER-01). Regular Users keep the simple profile panel.
/// </summary>
public static class OwnerInterfaceTypes
{
    public const string HallOwnerManagement = "HallOwnerManagement";
}

/// <summary>
/// Stable keys for the sidebar sections of the Hall Owner management interface
/// (US-OWNER-01). The 'Profile' section is always first and open by default.
/// </summary>
public static class OwnerSidebarSections
{
    public const string Profile = "profile";

    public const string MyHalls = "halls";
}

/// <summary>
/// Machine-readable values returned by the Add Hall initiation endpoint (US-OWNER-03).
/// The flow is stateless: verifying a valid Hall Owner session and reporting 'Ready' is
/// all that happens here. The actual hall record is created by the Add Hall form
/// submission (US-OWNER-04), so initiation never produces an empty or draft hall.
/// </summary>
public static class HallInitiation
{
    public const string StatusReady = "Ready";

    public const string CodeReady = "AddHallReady";
}