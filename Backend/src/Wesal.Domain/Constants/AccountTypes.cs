namespace Wesal.Domain.Constants;

/// <summary>
/// The account types a Guest may select while registering (US-REG-01).
/// These are the values the registration API contract accepts; each one maps to an
/// existing <see cref="ApplicationRoles"/> role that is persisted via Identity.
/// Regular User -> ApplicationRoles.RegisteredUser, Hall Owner -> ApplicationRoles.HallOwner.
/// </summary>
public static class AccountTypes
{
    public const string RegularUser = "RegularUser";

    public const string HallOwner = "HallOwner";

    public static readonly string[] All =
    [
        RegularUser,
        HallOwner
    ];

    public static bool IsValid(string? accountType)
        => accountType is not null
           && All.Contains(accountType, StringComparer.OrdinalIgnoreCase);

    /// <summary>Returns the canonical spelling of a valid account type.</summary>
    public static string Normalize(string? accountType)
    {
        if (!IsValid(accountType))
        {
            throw new ArgumentOutOfRangeException(nameof(accountType), accountType, "Unknown account type.");
        }

        return accountType!.Equals(RegularUser, StringComparison.OrdinalIgnoreCase)
            ? RegularUser
            : HallOwner;
    }

    /// <summary>Maps a valid account type to the role that is persisted for the new user.</summary>
    public static string ToRole(string? accountType)
        => Normalize(accountType) == RegularUser
            ? ApplicationRoles.RegisteredUser
            : ApplicationRoles.HallOwner;
}