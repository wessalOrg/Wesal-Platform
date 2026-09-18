using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;

namespace Wesal.Tests.Application;

public class LoginRequestValidatorShould
{
    private static LoginRequest CreateRequest(string? email = "omar.khaled@example.com", string? password = "Password123!")
        => new()
        {
            Email = email ?? string.Empty,
            Password = password ?? string.Empty
        };

    [Theory]
    [InlineData("omar.khaled@example.com", "Password123!")]
    [InlineData("owner@example.com", "Pass@123")]
    public async Task Validate_ValidEmailAndPassword_Passes(string email, string password)
    {
        var validator = new LoginRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(email, password));

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("test@")]
    [InlineData("+970599123456")]
    public async Task Validate_InvalidEmail_Fails(string email)
    {
        var validator = new LoginRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(email: email));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(LoginRequest.Email));
    }

    [Fact]
    public async Task Validate_EmptyEmail_Fails()
    {
        var validator = new LoginRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(email: string.Empty));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(LoginRequest.Email));
    }

    [Fact]
    public async Task Validate_NullEmail_Fails()
    {
        var validator = new LoginRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(email: null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(LoginRequest.Email));
    }

    [Fact]
    public async Task Validate_WhitespaceOnlyEmail_Fails()
    {
        var validator = new LoginRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(email: "   "));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(LoginRequest.Email));
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