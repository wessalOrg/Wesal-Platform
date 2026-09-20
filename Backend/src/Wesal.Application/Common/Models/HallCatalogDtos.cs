using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>Region with its predefined detailed-address list (US-HALL).</summary>
public class RegionAddressCatalogDto
{
    public HallRegion Region { get; init; }

    public string RegionDisplayName { get; init; } = string.Empty;

    public IReadOnlyList<string> Addresses { get; init; } = [];
}

/// <summary>Predefined hall features with their canonical Arabic names (US-HALL).</summary>
public class HallFeatureCatalogDto
{
    public IReadOnlyList<string> Features { get; init; } = [];
}