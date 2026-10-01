using Wesal.Application.Ai;

namespace Wesal.Tests.Ai;

public class AiRelativeDateResolverShould
{
    // 2026-10-01 is a Thursday.
    private static readonly DateOnly Thursday = new(2026, 10, 1);
    private static readonly DateOnly Friday = new(2026, 10, 2);
    private static readonly DateOnly Saturday = new(2026, 10, 3);

    [Theory]
    [InlineData("متاحة اليوم؟")]
    [InlineData("is it free today?")]
    public void Today(string message)
        => Assert.Equal(Thursday, AiRelativeDateResolver.Resolve(message, Thursday));

    [Theory]
    [InlineData("متاحة بكرة؟")]
    [InlineData("متاحة بكره")]
    [InlineData("غدًا")]
    [InlineData("available tomorrow?")]
    public void Tomorrow(string message)
        => Assert.Equal(Thursday.AddDays(1), AiRelativeDateResolver.Resolve(message, Thursday));

    [Theory]
    [InlineData("بعد بكرة")]
    [InlineData("the day after tomorrow")]
    public void DayAfterTomorrow(string message)
        => Assert.Equal(Thursday.AddDays(2), AiRelativeDateResolver.Resolve(message, Thursday));

    [Fact]
    public void Tomorrow_CrossesMonthAndYearBoundaries()
    {
        Assert.Equal(new DateOnly(2027, 1, 1), AiRelativeDateResolver.Resolve("بكرة", new DateOnly(2026, 12, 31)));
        Assert.Equal(new DateOnly(2026, 3, 1), AiRelativeDateResolver.Resolve("tomorrow", new DateOnly(2026, 2, 28)));
        Assert.Equal(new DateOnly(2028, 2, 29), AiRelativeDateResolver.Resolve("tomorrow", new DateOnly(2028, 2, 28)));
    }

    [Theory]
    [InlineData("متاحة الجمعة؟")]
    [InlineData("يوم الجمعة")]
    [InlineData("on Friday")]
    public void BareWeekday_IsTheNextOccurrence(string message)
        => Assert.Equal(Friday, AiRelativeDateResolver.Resolve(message, Thursday));

    [Fact]
    public void BareWeekday_OnThatSameDay_MeansToday()
        => Assert.Equal(Friday, AiRelativeDateResolver.Resolve("الجمعة", Friday));

    [Theory]
    [InlineData("الجمعة القادمة")]
    [InlineData("الجمعة الجاي")]
    [InlineData("next Friday")]
    public void UpcomingWeekday_OnThatSameDay_MeansNextWeek(string message)
        => Assert.Equal(Friday.AddDays(7), AiRelativeDateResolver.Resolve(message, Friday));

    [Fact]
    public void UpcomingWeekday_FromADifferentDay_IsThisComingOccurrence()
        => Assert.Equal(Friday, AiRelativeDateResolver.Resolve("next Friday", Thursday));

    [Fact]
    public void Weekday_AroundTheWeekBoundary()
    {
        // Saturday asks about Friday -> six days ahead (wraps the week).
        Assert.Equal(Saturday.AddDays(6), AiRelativeDateResolver.Resolve("الجمعة", Saturday));
        // Friday asks about Saturday -> tomorrow.
        Assert.Equal(Saturday, AiRelativeDateResolver.Resolve("السبت", Friday));
        // Sunday handling.
        Assert.Equal(Thursday.AddDays(3), AiRelativeDateResolver.Resolve("الأحد", Thursday));
    }

    [Theory]
    [InlineData("كم سعرها")]
    [InlineData("")]
    [InlineData(null)]
    public void NoDate_ReturnsNull(string? message)
        => Assert.Null(AiRelativeDateResolver.Resolve(message, Thursday));
}
