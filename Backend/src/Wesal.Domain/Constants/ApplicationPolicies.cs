namespace Wesal.Domain.Constants;

public static class ApplicationPolicies
{
    public const string RequireAdmin = "RequireAdmin";
    public const string RequireHallOwner = "RequireHallOwner";
    public const string RequireRegisteredUser = "RequireRegisteredUser";
    public const string RequireAuthenticatedUser = "RequireAuthenticatedUser";
    public const string RequireEventCoordinator = "RequireEventCoordinator";
    public const string RequirePhotographer = "RequirePhotographer";

    /// <summary>
    /// The account-level publishing gate (WESAL approval enforcement). Passes for every
    /// account except an Event Coordinator or Photographer whose approval status is not
    /// Approved; intended for user-generated-content creation/editing endpoints.
    /// </summary>
    public const string RequireApprovedAccount = "RequireApprovedAccount";
}
