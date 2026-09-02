using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;

namespace Wesal.Tests.Application;

public class AiAssistantRequestValidatorShould
{
    private readonly AiAssistantRequestValidator _validator = new();

    [Fact]
    public async Task ValidMessage_Passes()
    {
        var result = await _validator.ValidateAsync(new AiAssistantRequest("أريد قاعة في غزة"));
        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task ExactlyMaxLength_Passes()
    {
        var result = await _validator.ValidateAsync(new AiAssistantRequest(new string('a', AiAssistantRequestValidator.MaxMessageLength)));
        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task NullMessage_Fails()
    {
        var result = await _validator.ValidateAsync(new AiAssistantRequest(null));
        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task EmptyMessage_Fails()
    {
        var result = await _validator.ValidateAsync(new AiAssistantRequest(string.Empty));
        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task WhitespaceMessage_Fails()
    {
        var result = await _validator.ValidateAsync(new AiAssistantRequest("   "));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Message");
    }

    [Fact]
    public async Task ExcessivelyLargeMessage_Fails()
    {
        var result = await _validator.ValidateAsync(new AiAssistantRequest(new string('a', AiAssistantRequestValidator.MaxMessageLength + 1)));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Message");
    }
}