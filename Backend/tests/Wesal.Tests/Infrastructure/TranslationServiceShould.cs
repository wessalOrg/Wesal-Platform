using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.Localization;

namespace Wesal.Tests.Infrastructure;

public class TranslationServiceShould
{
    private readonly ITranslationService _service = new TranslationService();

    [Fact]
    public void Resolve_Arabic_ReturnsArabicTranslation()
    {
        var result = _service.Resolve("platform.name", "ar");

        Assert.Equal("وصال", result);
    }

    [Fact]
    public void Resolve_English_WithExistingEnglishTranslation_ReturnsEnglish()
    {
        var result = _service.Resolve("platform.name", "en");

        Assert.Equal("Wesal", result);
    }

    [Fact]
    public void Resolve_English_WithMissingEnglishTranslation_FallsBackToArabic()
    {
        var result = _service.Resolve("common.welcome", "en");

        Assert.Equal("أهلاً وسهلاً بك", result);
    }

    [Fact]
    public void Resolve_NoLanguageProvided_DefaultsToArabic()
    {
        var result = _service.Resolve("home.title");

        Assert.Equal("ابحث عن قاعة الأفراح المناسبة في غزة بسهولة", result);
    }

    [Fact]
    public void Resolve_UnknownLanguageCode_FallsBackToArabic()
    {
        var result = _service.Resolve("platform.name", "fr");

        Assert.Equal("وصال", result);
    }

    [Fact]
    public void Resolve_UnknownKey_ReturnsEmptyInsteadOfKey()
    {
        var result = _service.Resolve("missing.key", "en");

        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void Resolve_EmptyKey_ReturnsEmpty()
    {
        var result = _service.Resolve(string.Empty, "en");

        Assert.Equal(string.Empty, result);
    }
}