using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;

namespace Wesal.Tests.Application;

public class RecommendationRequestValidatorShould
{
    private readonly RecommendationRequestValidator _validator = new();

    [Fact]
    public async Task Validate_ValidRequest_Passes()
    {
        var result = await _validator.ValidateAsync(new RecommendationRequest("I need a hall in Gaza for 200 guests"));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_EmptyMessage_Fails()
    {
        var result = await _validator.ValidateAsync(new RecommendationRequest(""));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_NullMessage_Fails()
    {
        var result = await _validator.ValidateAsync(new RecommendationRequest(null));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_WhitespaceMessage_Fails()
    {
        var result = await _validator.ValidateAsync(new RecommendationRequest("   "));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_ExceedsMaxMessageLength_Fails()
    {
        var longMessage = new string('a', RecommendationRequestValidator.MaxMessageLength + 1);
        var result = await _validator.ValidateAsync(new RecommendationRequest(longMessage));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_ExactlyMaxMessageLength_Passes()
    {
        var maxMessage = new string('a', RecommendationRequestValidator.MaxMessageLength);
        var result = await _validator.ValidateAsync(new RecommendationRequest(maxMessage));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_SingleCharacterMessage_Passes()
    {
        var result = await _validator.ValidateAsync(new RecommendationRequest("a"));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_ArabicMessage_Passes()
    {
        var result = await _validator.ValidateAsync(new RecommendationRequest("أحتاج قاعة في غزة لـ 200 شخص"));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_MessageWithSpecialCharacters_Passes()
    {
        var result = await _validator.ValidateAsync(new RecommendationRequest("I need a hall for 300 guests! Date: Aug 15, 2-6 PM."));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_UnicodeMessage_Passes()
    {
        var result = await _validator.ValidateAsync(new RecommendationRequest("قاعة أفراح في رفح 🎉"));

        Assert.True(result.IsValid);
    }
}
