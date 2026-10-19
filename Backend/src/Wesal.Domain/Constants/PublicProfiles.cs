namespace Wesal.Domain.Constants;

/// <summary>
/// Client-facing identity labels for public professional content (requirements 17.5 and 18.4).
///
/// A photographer without a studio supplies a legal full name that is STRICTLY administrator-only
/// (requirement 3.3): it must never appear in any public response. Because no public display name
/// was specified for that branch, the platform presents the photographer under this single shared
/// neutral label in Discover, search, public profiles and comment/notification text, so the account
/// stays publicly discoverable without leaking the private name.
/// </summary>
public static class PublicProfiles
{
    /// <summary>The shared neutral display name used when a professional has no public business name.</summary>
    public const string DisplayNameFallback = "مستخدم";

    /// <summary>
    /// Resolves the safe public display name: the supplied business/studio name when present,
    /// otherwise the shared neutral fallback.
    /// </summary>
    public static string ResolveDisplayName(string? publicBusinessName)
        => string.IsNullOrWhiteSpace(publicBusinessName) ? DisplayNameFallback : publicBusinessName;
}
