using Wesal.Application.Ai;
using Wesal.Domain.Enums;

namespace Wesal.Tests.Application;

public class NaturalLanguageCriteriaExtractorShould
{
    private readonly NaturalLanguageCriteriaExtractor _extractor = new();

    [Fact]
    public void Extract_AreaOnly_ReturnsRegion()
    {
        var result = _extractor.Extract("I need a hall in Gaza");
        Assert.Equal(HallRegion.Gaza.ToString(), result.Region);
        Assert.Null(result.Date);
        Assert.Null(result.BookingPeriod);
    }

    [Fact]
    public void Extract_DateOnly_ReturnsDate()
    {
        var result = _extractor.Extract("I need a hall on 2026-08-30");
        Assert.Equal(new DateOnly(2026, 8, 30), result.Date);
    }

    [Fact]
    public void Extract_PeriodOnly_FirstPeriod()
    {
        var result = _extractor.Extract("first period please");
        Assert.Equal(BookingPeriodType.FirstPeriod.ToString(), result.BookingPeriod);
    }

    [Fact]
    public void Extract_AreaAndDate_ReturnsBoth()
    {
        var result = _extractor.Extract("hall in Gaza on 2026-08-30");
        Assert.Equal(HallRegion.Gaza.ToString(), result.Region);
        Assert.Equal(new DateOnly(2026, 8, 30), result.Date);
    }

    [Fact]
    public void Extract_AreaAndPeriod_ReturnsBoth()
    {
        var result = _extractor.Extract("hall in Gaza for second period");
        Assert.Equal(HallRegion.Gaza.ToString(), result.Region);
        Assert.Equal(BookingPeriodType.SecondPeriod.ToString(), result.BookingPeriod);
    }

    [Fact]
    public void Extract_AreaDatePeriod_ReturnsAll()
    {
        var result = _extractor.Extract("I need a hall in Gaza on August 30 for the first period");
        Assert.Equal(HallRegion.Gaza.ToString(), result.Region);
        Assert.NotNull(result.Date);
        Assert.Equal(BookingPeriodType.FirstPeriod.ToString(), result.BookingPeriod);
    }

    [Fact]
    public void Extract_DifferentPhrasings_SameCriteria()
    {
        var a = _extractor.Extract("hall in Gaza on 2026-08-30 first period");
        var b = _extractor.Extract("Need hall Gaza 2026-08-30 First Period");
        Assert.Equal(a.Region, b.Region);
        Assert.Equal(a.Date, b.Date);
        Assert.Equal(a.BookingPeriod, b.BookingPeriod);
    }

    [Fact]
    public void Extract_ValidDate_August30()
    {
        var result = _extractor.Extract("August 30");
        Assert.NotNull(result.Date);
        Assert.Equal(8, result.Date!.Value.Month);
        Assert.Equal(30, result.Date.Value.Day);
    }

    [Fact]
    public void Extract_InvalidDate_HandledSafely()
    {
        var result = _extractor.Extract("on 2026-02-30"); // invalid date Feb 30
        // Should not throw, should return null date
        Assert.Null(result.Date);
    }

    [Fact]
    public void Extract_ValidPeriod_ArabicFirst()
    {
        var result = _extractor.Extract("أحتاج قاعة الفترة الأولى");
        Assert.Equal(BookingPeriodType.FirstPeriod.ToString(), result.BookingPeriod);
    }

    [Fact]
    public void Extract_InvalidPeriod_HandledSafely()
    {
        var result = _extractor.Extract("for third period");
        Assert.Null(result.BookingPeriod);
    }

    [Fact]
    public void Extract_Capacity_ReturnsCapacity()
    {
        var result = _extractor.Extract("hall for 300 people in Gaza");
        Assert.Equal(300, result.Capacity);
    }

    [Fact]
    public void Extract_ArabicRegion_ReturnsRegion()
    {
        var result = _extractor.Extract("قاعة في غزة");
        Assert.Equal(HallRegion.Gaza.ToString(), result.Region);
    }

    [Fact]
    public void Extract_EmptyMessage_ReturnsEmptyCriteria()
    {
        var result = _extractor.Extract("");
        Assert.Null(result.Region);
        Assert.Null(result.Date);
        Assert.Null(result.BookingPeriod);
    }

    [Fact]
    public void Extract_WhitespaceOnly_ReturnsEmpty()
    {
        var result = _extractor.Extract("   ");
        Assert.Null(result.Region);
        Assert.Null(result.Date);
    }
}
