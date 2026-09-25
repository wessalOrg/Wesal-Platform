using Wesal.Domain.Enums;

namespace Wesal.Infrastructure.Halls;

internal static class HallDisplayNames
{
    public static string GetRegionDisplayName(HallRegion region) => region switch
    {
        HallRegion.NorthGaza => "North Gaza",
        HallRegion.Gaza => "Gaza",
        HallRegion.MiddleArea => "Middle Area",
        HallRegion.SouthGaza => "South Gaza",
        _ => region.ToString()
    };
}
