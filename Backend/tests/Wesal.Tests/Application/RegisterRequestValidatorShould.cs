using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Constants;

namespace Wesal.Tests.Application;

public class RegisterRequestValidatorShould
{
    private readonly RegisterRequestValidator _validator = new();

    private static RegisterRequest CreateValidRequest(
        string? fullName = "Test User",
        string? email = "test@example.com",
        string? phone = "+972599123456",
        string? password = "Password123!",
        string? confirmPassword = "Password123!",
        string? accountType = ApplicationRoles.RegisteredUser)
    {
        return new RegisterRequest(
            fullName!,
            email!,
            phone!,
            password!,
            confirmPassword!,
            accountType!);
    }

    [Fact]
    public async Task Valid_RegularUser_Passes()
    {
        var request = CreateValidRequest(accountType: ApplicationRoles.RegisteredUser);
        var result = await _validator.ValidateAsync(request);
        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Valid_HallOwner_Passes()
    {
        var request = CreateValidRequest(accountType: ApplicationRoles.HallOwner);
        var result = await _validator.ValidateAsync(request);
        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Empty_FullName_Fails(string name)
    {
        var request = CreateValidRequest(fullName: name);
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "FullName");
    }

    [Fact]
    public async Task FullName_TooLong_Fails()
    {
        var longName = new string('a', 151);
        var request = CreateValidRequest(fullName: longName);
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
    }

    [Theory]
    [InlineData("")]
    [InlineData("invalid-email")]
    [InlineData("test@")]
    public async Task Invalid_Email_Fails(string email)
    {
        var request = CreateValidRequest(email: email);
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Email");
    }

    [Theory]
    [InlineData("")]
    [InlineData("123")]
    [InlineData("abc")]
    [InlineData("1234567")] // too short
    public async Task Invalid_Phone_Fails(string phone)
    {
        var request = CreateValidRequest(phone: phone);
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "PhoneNumber");
    }

    [Fact]
    public async Task Empty_Password_Fails()
    {
        var request = CreateValidRequest(password: "", confirmPassword: "");
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Password");
    }

    [Fact]
    public async Task Short_Password_Fails()
    {
        var request = CreateValidRequest(password: "Short1!", confirmPassword: "Short1!");
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Password_Mismatch_Fails()
    {
        var request = CreateValidRequest(password: "Password123!", confirmPassword: "Different123!");
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "ConfirmPassword");
    }

    [Theory]
    [InlineData("")]
    [InlineData("InvalidRole")]
    [InlineData("Guest")]
    [InlineData("Admin")]
    public async Task Invalid_AccountType_Fails(string accountType)
    {
        var request = CreateValidRequest(accountType: accountType);
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "AccountType");
    }
}
