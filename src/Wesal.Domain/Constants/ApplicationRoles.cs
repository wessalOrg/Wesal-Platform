namespace Wesal.Domain.Constants;

public static class ApplicationRoles
{
    public const string Guest = "Guest";
    public const string RegisteredUser = "RegisteredUser";
    public const string HallOwner = "HallOwner";
    public const string Admin = "Admin";

    public static readonly string[] All =
    [
        Guest,
        RegisteredUser,
        HallOwner,
        Admin
    ];

    public static bool IsValid(string role) => All.Contains(role, StringComparer.OrdinalIgnoreCase);
}
