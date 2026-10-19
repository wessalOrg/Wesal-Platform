namespace Wesal.Domain.Constants;

/// <summary>
/// The account types a Guest may select while registering (US-REG-01).
/// These are the values the registration API contract accepts; each one maps to an
/// existing <see cref="ApplicationRoles"/> role that is persisted via Identity.
/// Regular User -> ApplicationRoles.RegisteredUser, Hall Owner -> ApplicationRoles.HallOwner,
/// Event Coordinator -> ApplicationRoles.EventCoordinator,
/// Photographer -> ApplicationRoles.Photographer.
/// </summary>
public static class AccountTypes
{
    public const string RegularUser = "RegularUser";

    public const string HallOwner = "HallOwner";

    public const string EventCoordinator = "EventCoordinator";

    public const string Photographer = "Photographer";

    public static readonly string[] All =
    [
        RegularUser,
        HallOwner,
        EventCoordinator,
        Photographer
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

        if (accountType!.Equals(RegularUser, StringComparison.OrdinalIgnoreCase))
        {
            return RegularUser;
        }

        if (accountType.Equals(HallOwner, StringComparison.OrdinalIgnoreCase))
        {
            return HallOwner;
        }

        if (accountType.Equals(EventCoordinator, StringComparison.OrdinalIgnoreCase))
        {
            return EventCoordinator;
        }

        return Photographer;
    }

    /// <summary>Maps a valid account type to the role that is persisted for the new user.</summary>
    public static string ToRole(string? accountType)
        => Normalize(accountType) switch
        {
            RegularUser => ApplicationRoles.RegisteredUser,
            HallOwner => ApplicationRoles.HallOwner,
            EventCoordinator => ApplicationRoles.EventCoordinator,
            _ => ApplicationRoles.Photographer
        };

    /// <summary>Maps a persisted role back to the account type, or null when the role is not an account role.</summary>
    public static string? FromRole(string? role)
    {
        if (role is null)
        {
            return null;
        }

        if (role.Equals(ApplicationRoles.RegisteredUser, StringComparison.OrdinalIgnoreCase))
        {
            return RegularUser;
        }

        if (role.Equals(ApplicationRoles.HallOwner, StringComparison.OrdinalIgnoreCase))
        {
            return HallOwner;
        }

        if (role.Equals(ApplicationRoles.EventCoordinator, StringComparison.OrdinalIgnoreCase))
        {
            return EventCoordinator;
        }

        if (role.Equals(ApplicationRoles.Photographer, StringComparison.OrdinalIgnoreCase))
        {
            return Photographer;
        }

        return null;
    }

    /// <summary>
    /// True when the account type must complete a role-specific setup step before its
    /// registration is considered finished (WESAL coordinator/photographer registration).
    /// Regular users and hall owners are complete the moment the account is created.
    /// </summary>
    public static bool RequiresRoleSetup(string? accountType)
    {
        if (!IsValid(accountType))
        {
            return false;
        }

        var normalized = Normalize(accountType);
        return normalized == EventCoordinator || normalized == Photographer;
    }
}
