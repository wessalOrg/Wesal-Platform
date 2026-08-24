using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;

namespace Wesal.Tests.Application;

public class AiHowToQuestionValidatorShould
{
    private readonly AiHowToQuestionValidator _validator = new();

    [Fact]
    public async Task ValidQuestion_Passes()
    {
        var request = new AiHowToRequest("كيف أحجز قاعة؟", null, "ar");
        var result = await _validator.ValidateAsync(request);
        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task EmptyQuestion_Fails()
    {
        var request = new AiHowToRequest("", null, "ar");
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task WhitespaceOnlyQuestion_Fails()
    {
        var request = new AiHowToRequest("   ", null, "en");
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task ExcessivelyLargeQuestion_Fails()
    {
        var large = new string('a', 2001);
        var request = new AiHowToRequest(large, null, "ar");
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Question");
    }

    [Fact]
    public async Task ExactlyMaxLength_Passes()
    {
        var max = new string('a', 2000);
        var request = new AiHowToRequest(max, null, "en");
        var result = await _validator.ValidateAsync(request);
        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task NullLanguage_Passes()
    {
        var request = new AiHowToRequest("hello", null, null);
        var result = await _validator.ValidateAsync(request);
        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task InvalidLanguage_Fails()
    {
        var request = new AiHowToRequest("hello", null, "fr");
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task MalformedRequest_NullQuestion_Fails()
    {
        var request = new AiHowToRequest(null!, null, "ar");
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
    }
}
