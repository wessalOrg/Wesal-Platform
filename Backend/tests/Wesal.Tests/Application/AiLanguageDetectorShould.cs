using Wesal.Application.Ai;

namespace Wesal.Tests.Application;

public class AiLanguageDetectorShould
{
    private readonly AiLanguageDetector _detector = new();

    [Theory]
    [InlineData("كيف أبحث عن قاعة")]
    [InlineData("مرحبا، أحتاج قاعة في غزة")]
    [InlineData("السلام عليكم")]
    [InlineData("أريد حجز قاعة")]
    public void Arabic_DetectedAsArabic(string text)
    {
        Assert.Equal("ar", _detector.Detect(text));
    }

    [Theory]
    [InlineData("how do I search for halls")]
    [InlineData("I need a hall in Gaza")]
    [InlineData("hello")]
    [InlineData("please help me book a hall")]
    public void English_DetectedAsEnglish(string text)
    {
        Assert.Equal("en", _detector.Detect(text));
    }

    [Fact]
    public void ArabicWithPunctuation_DetectedAsArabic()
    {
        Assert.Equal("ar", _detector.Detect("مرحبا! كيف حالك؟"));
        Assert.Equal("ar", _detector.Detect("أحتاج قاعة، في غزة."));
    }

    [Fact]
    public void EnglishWithPunctuation_DetectedAsEnglish()
    {
        Assert.Equal("en", _detector.Detect("Hello, how are you?"));
        Assert.Equal("en", _detector.Detect("I need a hall - in Gaza!"));
    }

    [Fact]
    public void ShortArabic_Detected()
    {
        Assert.Equal("ar", _detector.Detect("مرحبا"));
    }

    [Fact]
    public void ShortEnglish_Detected()
    {
        Assert.Equal("en", _detector.Detect("hi"));
        Assert.Equal("en", _detector.Detect("help"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    [InlineData("123")]
    [InlineData("!!!")]
    [InlineData("123 456")]
    public void Ambiguous_ReturnsNullFallback(string? text)
    {
        Assert.Null(_detector.Detect(text));
    }

    [Fact]
    public void Mixed_DominantArabic_ReturnsArabic()
    {
        // 70% Arabic characters should be detected as Arabic to prevent mixed response
        var text = "مرحبا مرحبا مرحبا hello";
        Assert.Equal("ar", _detector.Detect(text));
    }

    [Fact]
    public void Mixed_DominantEnglish_ReturnsEnglish()
    {
        var text = "hello hello hello مرحبا";
        Assert.Equal("en", _detector.Detect(text));
    }

    [Fact]
    public void Mixed_Balanced_ReturnsNullFallback()
    {
        var text = "مرحبا hello";
        Assert.Null(_detector.Detect(text));
    }

    [Fact]
    public void NullText_DoesNotThrow_ReturnsNull()
    {
        var ex = Record.Exception(() => _detector.Detect(null));
        Assert.Null(ex);
        Assert.Null(_detector.Detect(null));
    }
}
