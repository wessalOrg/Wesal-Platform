using Wesal.Application.Ai;

namespace Wesal.Tests.Ai;

public sealed class NaturalLanguageCriteriaExtractorShould
{
    private readonly NaturalLanguageCriteriaExtractor _extractor = new();

    [Theory]
    [InlineData("بدي صالة لـ ٣٠٠ شخص", 300)]
    [InlineData("بدي قاعة ل ٣٠٠ ضيف", 300)]
    [InlineData("قاعة بسعة ۳۰۰", 300)]
    [InlineData("hall for 300 guests", 300)]
    public void Capacity_ParsesArabicPersianAndWesternDigits(string message, int expected)
        => Assert.Equal(expected, _extractor.Extract(message).Capacity);

    [Fact]
    public void Date_ParsesArabicIndicNumerals()
        => Assert.Equal(new DateOnly(2026, 10, 25), _extractor.Extract("قاعة يوم ٢٥/١٠/٢٠٢٦").Date);
}
