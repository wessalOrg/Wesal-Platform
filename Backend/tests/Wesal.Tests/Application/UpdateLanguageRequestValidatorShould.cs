using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;

namespace Wesal.Tests.Application;

public class UpdateLanguageRequestValidatorShould
{
    private readonly UpdateLanguageRequestValidator _validator = new();

    [Theory]
    [InlineData("ar")]
    [InlineData("en")]
    public async Task Validate_SupportedLanguage_Passes(string language)
    {
        var request = new UpdateLanguageRequest { Language = language };

        var result = await _validator.ValidateAsync(request);

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("")]
    [InlineData("fr")]
    [InlineData("de")]
    [InlineData("es")]
    [InlineData("Arabic")]
    [InlineData("English")]
    [InlineData("ARABIC")]
    [InlineData("unknown")]
    public async Task Validate_UnsupportedLanguage_Fails(string language)
    {
        var request = new UpdateLanguageRequest { Language = language };

        var result = await _validator.ValidateAsync(request);

        Assert.False(result.IsValid);
    }
}