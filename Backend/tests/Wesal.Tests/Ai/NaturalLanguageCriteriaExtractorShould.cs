using Wesal.Application.Ai;
using Wesal.Application.Common.Models;

namespace Wesal.Tests.Ai;

public sealed class NaturalLanguageCriteriaExtractorShould
{
    private readonly NaturalLanguageCriteriaExtractor _extractor = new();

    [Theory]
    [InlineData("بدي صالة لـ ٣٠٠ شخص", 300)]
    [InlineData("بدي قاعة ل ٣٠٠ ضيف", 300)]
    [InlineData("بغزة عندي 150 واحد", 150)]
    [InlineData("قاعة بسعة ۳۰۰", 300)]
    [InlineData("hall for 300 guests", 300)]
    public void Capacity_ParsesArabicPersianAndWesternDigits(string message, int expected)
        => Assert.Equal(expected, _extractor.Extract(message).Capacity);

    [Fact]
    public void Date_ParsesArabicIndicNumerals()
        => Assert.Equal(new DateOnly(2026, 10, 25), _extractor.Extract("قاعة يوم ٢٥/١٠/٢٠٢٦").Date);

    [Fact]
    public void Area_ParsesBareCatalogNeighborhood()
    {
        var result = _extractor.Extract("حي الرمال");

        Assert.Equal("Gaza", result.Region);
        Assert.Equal("حي الرمال", result.Area);
    }

    [Theory]
    [InlineData("find halls in Gaza", "Gaza")]
    [InlineData("find halls in North Gaza", "NorthGaza")]
    [InlineData("find halls in South Gaza", "SouthGaza")]
    [InlineData("find halls in the Middle Area", "MiddleArea")]
    public void DoNotTreatAnEnglishRegionAsASeparateNeighborhood(string message, string expectedRegion)
    {
        var result = _extractor.Extract(message);

        Assert.Equal(expectedRegion, result.Region);
        Assert.Null(result.Area);
    }

    [Theory]
    [InlineData("بدي صالة ب1500شيكل", 1500)]
    [InlineData("ميزانيتي ١٥٠٠ شيكل", 1500)]
    [InlineData("hall under 1500 NIS", 1500)]
    public void Price_ParsesArabicBudgetAndCurrency(string message, decimal expected)
        => Assert.Equal(expected, _extractor.Extract(message).MaximumPrice);

    [Theory]
    [InlineData("بدي صالة رخيصة")]
    [InlineData("أرخص قاعة في غزة")]
    [InlineData("cheapest hall")]
    public void PricePreference_RequestsCheapestFirst(string message)
        => Assert.True(_extractor.Extract(message).SortByPrice);

    [Fact]
    public void Capacity_IsNotMistakenForPrice()
    {
        var result = _extractor.Extract("قاعة لـ ١٥٠ شخص");

        Assert.Equal(150, result.Capacity);
        Assert.Null(result.MaximumPrice);
    }

    [Fact]
    public void PreserveGazaAndCapacityWithoutInventingAnArea()
    {
        var result = _extractor.Extract("بغزة عندي 150 واحد");

        Assert.Equal("Gaza", result.Region);
        Assert.Equal(150, result.Capacity);
        Assert.Null(result.Area);
        Assert.Null(result.MinimumPrice);
        Assert.Null(result.MaximumPrice);
        Assert.Null(result.AroundPrice);
    }

    [Fact]
    public void DoNotTreatEventWordingAsANeighborhood()
    {
        var result = _extractor.Extract("بدي اعمل عرسي في صالة رخيصة وحلوة");

        Assert.Null(result.Area);
        Assert.Equal(AiPriceSortPreference.LowestPrice, result.SortPreference);
    }
}
