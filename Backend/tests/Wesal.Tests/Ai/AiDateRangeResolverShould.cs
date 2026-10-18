using Wesal.Application.Ai;

namespace Wesal.Tests.Ai;

public sealed class AiDateRangeResolverShould
{
    private static readonly DateOnly Today = new(2026, 10, 12);

    [Fact]
    public void ResolveRelativeDaysAgainstTheTrustedDate()
    {
        Assert.Equal(new DateOnly(2026, 10, 13), AiDateRangeResolver.Resolve("بكرة", Today)?.Date);
        Assert.Equal(new DateOnly(2026, 10, 14), AiDateRangeResolver.Resolve("بعد بكرة", Today)?.Date);
        Assert.Null(AiDateRangeResolver.Resolve("بغزة عندي 150 واحد", Today));
        Assert.Equal(new DateOnly(2026, 10, 18), AiDateRangeResolver.Resolve("بغزة عندي 150 الأحد", Today)?.Date);
        Assert.Equal(new DateOnly(2026, 10, 18), AiDateRangeResolver.Resolve("بغزة عندي 150 احد", Today)?.Date);
    }

    [Fact]
    public void ResolveNextMonthToABoundedCalendarRange()
    {
        var intent = AiDateRangeResolver.Resolve("الشهر الجاي", Today);

        Assert.Equal(new DateOnly(2026, 11, 1), intent?.Range?.Start);
        Assert.Equal(new DateOnly(2026, 11, 30), intent?.Range?.End);
        Assert.Equal(11, intent?.Month?.Month);
    }

    [Fact]
    public void ResolveNamedMonthAndThisMonth()
    {
        var named = AiDateRangeResolver.Resolve("في أكتوبر", Today);
        var current = AiDateRangeResolver.Resolve("هذا الشهر", Today);

        Assert.Equal(new DateOnly(2026, 10, 1), named?.Range?.Start);
        Assert.Equal(new DateOnly(2026, 10, 31), named?.Range?.End);
        Assert.Equal(new DateOnly(2026, 10, 1), current?.Range?.Start);
        Assert.Equal(new DateOnly(2026, 10, 31), current?.Range?.End);
    }

    [Fact]
    public void ResolveGazaWeekAndWeekendRanges()
    {
        var week = AiDateRangeResolver.Resolve("الأسبوع الجاي", Today)?.Range;
        var weekend = AiDateRangeResolver.Resolve("نهاية الأسبوع", Today)?.Range;

        Assert.Equal(new DateOnly(2026, 10, 18), week?.Start);
        Assert.Equal(new DateOnly(2026, 10, 24), week?.End);
        Assert.Equal(new DateOnly(2026, 10, 16), weekend?.Start);
        Assert.Equal(new DateOnly(2026, 10, 17), weekend?.End);
    }

    [Fact]
    public void RejectRangesThatExceedTheBoundedWindow()
        => Assert.Null(AiDateRangeResolver.Resolve("2026-10-01 إلى 2026-11-05", Today));
}
