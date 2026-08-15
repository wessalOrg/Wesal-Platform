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

    public static string GetPeriodName(BookingPeriodType type) => type switch
    {
        BookingPeriodType.FirstPeriod => "First Period",
        BookingPeriodType.SecondPeriod => "Second Period",
        _ => type.ToString()
    };
}
