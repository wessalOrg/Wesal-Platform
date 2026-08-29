using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;

namespace Wesal.Tests.Application;

public class LoginRequestValidatorShould
{
    private static LoginRequest CreateRequest(string? identifier = "omar.khaled@example.com", string? password = "Password123!")
        => new()
        {
            Identifier = identifier ?? string.Empty,
            Password = password ?? string.Empty
        };

    [Theory]
    [InlineData("omar.khaled@example.com", "Password123!")]
    [InlineData("+970599123456", "Password123!")]
    [InlineData("970599123456", "Pass@123")]
    public async Task Validate_ValidIdentifierAndPassword_Passes(string identifier, string password)
    {
        var validator = new LoginRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(identifier, password));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_EmptyIdentifier_Fails()
    {
        var validator = new LoginRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(identifier: string.Empty));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(LoginRequest.Identifier));
    }

    [Fact]
    public async Task Validate_NullIdentifier_Fails()
    {
        var validator = new LoginRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(identifier: null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(LoginRequest.Identifier));
    }

    [Fact]
    public async Task Validate_WhitespaceOnlyIdentifier_Fails()
    {
        var validator = new LoginRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(identifier: "   "));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(LoginRequest.Identifier));
    }

    [Fact]
    public async Task Validate_EmptyPassword_Fails()
    {
        var validator = new LoginRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(password: string.Empty));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(LoginRequest.Password));
    }

    [Fact]
    public async Task Validate_NullPassword_Fails()
    {
        var validator = new LoginRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(password: null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(LoginRequest.Password));
    }
}