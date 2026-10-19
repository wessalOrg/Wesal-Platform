namespace Wesal.Domain.Constants;

public static class ApplicationRoles
{
    public const string Guest = "Guest";
    public const string RegisteredUser = "RegisteredUser";
    public const string HallOwner = "HallOwner";
    public const string Admin = "Admin";

    /// <summary>Event Coordinator (منسق المناسبات). Registrable; requires role setup data.</summary>
    public const string EventCoordinator = "EventCoordinator";

    /// <summary>Photographer (مصور). Registrable; role-specific setup arrives with Task 3.</summary>
    public const string Photographer = "Photographer";

    public static readonly string[] All =
    [
        Guest,
        RegisteredUser,
        HallOwner,
        Admin,
        EventCoordinator,
        Photographer
    ];

    public static bool IsValid(string role) => All.Contains(role, StringComparer.OrdinalIgnoreCase);
}
