using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Constants;

namespace Wesal.Tests.Application;

public class RegisterRequestValidatorShould
{
    private static RegisterRequest CreateRequest(
        string? fullName = "Omar Khaled",
        string? email = "omar.khaled@example.com",
        string? phoneNumber = "+970599123456",
        string? password = "Password123!",
        string? confirmPassword = "Password123!",
        string? accountType = "RegularUser") => new()
    {
        FullName = fullName ?? string.Empty,
        Email = email ?? string.Empty,
        PhoneNumber = phoneNumber ?? string.Empty,
        Password = password ?? string.Empty,
        ConfirmPassword = confirmPassword ?? string.Empty,
        AccountType = accountType
    };

    [Fact]
    public async Task Validate_ValidRegularUserRequest_Passes()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(accountType: AccountTypes.RegularUser));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_ValidHallOwnerRequest_Passes()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(accountType: AccountTypes.HallOwner));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_AccountTypeCaseInsensitive_Passes()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(accountType: "hallowner"));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_MissingAccountType_Fails()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(accountType: null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.AccountType));
    }

    [Fact]
    public async Task Validate_EmptyAccountType_Fails()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(accountType: string.Empty));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.AccountType));
    }

    [Fact]
    public async Task Validate_InvalidAccountType_Fails()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(accountType: "Admin"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.AccountType));
    }

    [Fact]
    public async Task Validate_WhitespaceAccountType_Fails()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(accountType: "   "));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.AccountType));
    }

    [Fact]
    public async Task Validate_MissingFullName_Fails()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(fullName: null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.FullName));
    }

    [Fact]
    public async Task Validate_WhitespaceOnlyFullName_Fails()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(fullName: "   "));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.FullName));
    }

    [Fact]
    public async Task Validate_InvalidEmail_Fails()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(email: "not-an-email"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.Email));
    }

    [Fact]
    public async Task Validate_MissingPhoneNumber_Fails()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(phoneNumber: null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.PhoneNumber));
    }

    [Fact]
    public async Task Validate_InvalidPhoneNumber_Fails()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(phoneNumber: "abc"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.PhoneNumber));
    }

    [Fact]
    public async Task Validate_PasswordTooShort_Fails()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(password: "Ab1!"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.Password));
        Assert.Contains(result.Errors, error => error.ErrorMessage == "Password must be at least 8 characters.");
    }

    [Fact]
    public async Task Validate_PasswordExactlyEightCharactersSatisfyingAllRules_Passes()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(password: "P@ssw0rd", confirmPassword: "P@ssw0rd"));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_PasswordWithoutUppercase_Fails()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(password: "password123!"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.Password));
        Assert.Contains(result.Errors, error => error.ErrorMessage == "Password must include at least one uppercase letter.");
    }

    [Fact]
    public async Task Validate_PasswordMissingLowercase_Fails()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(password: "PASSWORD123!"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.ErrorMessage == "Password must include at least one lowercase letter.");
    }

    [Fact]
    public async Task Validate_PasswordWithoutDigit_Fails()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(password: "Passwordabc!"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.Password));
        Assert.Contains(result.Errors, error => error.ErrorMessage == "Password must include at least one number.");
    }

    [Fact]
    public async Task Validate_PasswordMissingNonAlphanumeric_Fails()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(password: "Password1234"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.ErrorMessage == "Password must include at least one non-alphanumeric character.");
    }

    [Fact]
    public async Task Validate_PasswordViolatingMultipleRules_ReturnsAllViolations()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(password: "abc", confirmPassword: "abc"));

        Assert.False(result.IsValid);
        var passwordErrors = result.Errors
            .Where(error => error.PropertyName == nameof(RegisterRequest.Password))
            .ToList();
        Assert.Contains(passwordErrors, error => error.ErrorMessage == "Password must be at least 8 characters.");
        Assert.Contains(passwordErrors, error => error.ErrorMessage == "Password must include at least one uppercase letter.");
        Assert.Contains(passwordErrors, error => error.ErrorMessage == "Password must include at least one number.");
        Assert.Contains(passwordErrors, error => error.ErrorMessage == "Password must include at least one non-alphanumeric character.");
        Assert.Equal(4, passwordErrors.Count);
    }

    [Fact]
    public async Task Validate_NullPassword_RejectedWithoutThrowing()
    {
        var validator = new RegisterRequestValidator();
        var request = new RegisterRequest
        {
            FullName = "Omar Khaled",
            Email = "omar.khaled@example.com",
            PhoneNumber = "+970599123456",
            Password = null!,
            ConfirmPassword = "Password123!",
            AccountType = AccountTypes.RegularUser
        };

        var result = await validator.ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.Password));
    }

    [Fact]
    public async Task Validate_MismatchedConfirmation_Fails()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(password: "Password123!", confirmPassword: "Password1234!"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.ConfirmPassword));
    }

    [Fact]
    public async Task Validate_OverlongFullName_Fails()
    {
        var validator = new RegisterRequestValidator();

        var result = await validator.ValidateAsync(CreateRequest(fullName: new string('a', 151)));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.FullName));
    }
}