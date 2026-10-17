using Wesal.Application.Ai;
using Wesal.Application.Common.Models;

namespace Wesal.Tests.Ai;

public sealed class AiPriceBudgetExtractorShould
{
    private readonly NaturalLanguageCriteriaExtractor _criteria = new();

    [Theory]
    [InlineData("بدي صالة ب1500", 1500)]
    [InlineData("بدي صالة بـ 1500 شيكل", 1500)]
    [InlineData("ميزانيتي ١٥٠٠", 1500)]
    [InlineData("معي 1500", 1500)]
    [InlineData("حدي 1500", 1500)]
    [InlineData("ما بدي أتجاوز 2000", 2000)]
    [InlineData("أقل من 1800", 1800)]
    [InlineData("1500شيكل", 1500)]
    public void ExtractMaximumBudgetsInPalestinianArabic(string message, decimal expected)
        => Assert.Equal(expected, _criteria.Extract(message).MaximumPrice);

    [Theory]
    [InlineData("بين 1000 و2000", 1000, 2000)]
    [InlineData("from 1000 to 2000 NIS", 1000, 2000)]
    public void ExtractPriceRanges(string message, decimal minimum, decimal maximum)
    {
        var result = _criteria.Extract(message);
        Assert.Equal(minimum, result.MinimumPrice);
        Assert.Equal(maximum, result.MaximumPrice);
    }

    [Fact]
    public void KeepMinimumAndAroundPricesSeparateFromMaximum()
    {
        var minimum = _criteria.Extract("أكثر من 1500 شيكل");
        var around = _criteria.Extract("حوالي 1500 شيكل");

        Assert.Equal(1500, minimum.MinimumPrice);
        Assert.Null(minimum.MaximumPrice);
        Assert.Equal(AiPriceSortPreference.Relevance, minimum.SortPreference);
        Assert.Equal(1500, around.AroundPrice);
        Assert.Equal(AiPriceSortPreference.ClosestToTarget, around.SortPreference);
    }

    [Fact]
    public void AStandaloneNumberIsNotTreatedAsPriceOrCapacity()
    {
        var result = _criteria.Extract("1500");

        Assert.Null(result.MinimumPrice);
        Assert.Null(result.MaximumPrice);
        Assert.Null(result.AroundPrice);
        Assert.Null(result.Capacity);
    }

    [Theory]
    [InlineData("أرخص وحدة", AiPriceSortPreference.LowestPrice)]
    [InlineData("مين أغلى؟", AiPriceSortPreference.HighestPrice)]
    public void ExtractPriceOrdering(string message, AiPriceSortPreference expected)
        => Assert.Equal(expected, AiPriceBudgetExtractor.Extract(message).SortPreference);
}
