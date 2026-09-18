using Wesal.Domain.Constants;

namespace Wesal.Application.Common.Models;

/// <summary>
/// Sidebar data for the Hall Owner management interface (US-OWNER-01).
/// Only navigation data is returned; the Profile section content is loaded
/// independently through the existing profile API so it stays accessible even
/// when this management data fails to load.
/// </summary>
public class OwnerSidebarResponse
{
    /// <summary>
    /// Routing signal telling the client which interface to render:
    /// <see cref="OwnerInterfaceTypes.HallOwnerManagement"/> (Wesal.Domain.Constants).
    /// </summary>
    public string InterfaceType { get; init; } = string.Empty;

    public IReadOnlyList<OwnerSidebarSectionDto> Sections { get; init; } = [];
}

public class OwnerSidebarSectionDto
{
    public string Key { get; init; } = string.Empty;

    public string Label { get; init; } = string.Empty;

    /// <summary>The visual order within the sidebar; lower renders first.</summary>
    public int Order { get; init; }

    /// <summary>True when this section is open by default when the interface loads.</summary>
    public bool IsDefault { get; init; }

    /// <summary>Optional navigation badge (e.g. the number of the owner's halls).</summary>
    public int? BadgeCount { get; init; }
}