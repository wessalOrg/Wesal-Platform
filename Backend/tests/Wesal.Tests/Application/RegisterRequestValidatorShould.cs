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
        string? accountType = null)
    {
        // Default to RegularUser if not specified, to satisfy both ApplicationRoles and AccountTypes
        accountType ??= AccountTypes.RegularUser;
        return new RegisterRequest
        {
            FullName = fullName!,
            Email = email!,
            PhoneNumber = phone!,
            Password = password!,
            ConfirmPassword = confirmPassword!,
            AccountType = accountType
        };
    }

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

    [Fact]
    public async Task Validate_ValidRegularUserRequest_Passes()
    {
        var result = await _validator.ValidateAsync(CreateRequest(accountType: AccountTypes.RegularUser));
        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_ValidHallOwnerRequest_Passes()
    {
        var result = await _validator.ValidateAsync(CreateRequest(accountType: AccountTypes.HallOwner));
        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_AccountTypeCaseInsensitive_Passes()
    {
        var result = await _validator.ValidateAsync(CreateRequest(accountType: "hallowner"));
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
    public async Task Validate_MissingFullName_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(fullName: null));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.FullName));
    }

    [Fact]
    public async Task Validate_WhitespaceOnlyFullName_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(fullName: "   "));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.FullName));
    }

    [Fact]
    public async Task FullName_TooLong_Fails()
    {
        var longName = new string('a', 151);
        var request = CreateValidRequest(fullName: longName);
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_OverlongFullName_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(fullName: new string('a', 151)));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.FullName));
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

    [Fact]
    public async Task Validate_InvalidEmail_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(email: "not-an-email"));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.Email));
    }

    [Theory]
    [InlineData("")]
    [InlineData("123")]
    [InlineData("abc")]
    [InlineData("1234567")]
    public async Task Invalid_Phone_Fails(string phone)
    {
        var request = CreateValidRequest(phone: phone);
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "PhoneNumber");
    }

    [Fact]
    public async Task Validate_MissingPhoneNumber_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(phoneNumber: null));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.PhoneNumber));
    }

    [Fact]
    public async Task Validate_InvalidPhoneNumber_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(phoneNumber: "abc"));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.PhoneNumber));
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
    public async Task Validate_PasswordTooShort_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(password: "Ab1!"));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.Password));
    }

    [Fact]
    public async Task Short_Password_Fails()
    {
        var request = CreateValidRequest(password: "Short1!", confirmPassword: "Short1!");
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_PasswordExactlyEightCharactersSatisfyingAllRules_Passes()
    {
        var result = await _validator.ValidateAsync(CreateRequest(password: "P@ssw0rd", confirmPassword: "P@ssw0rd"));
        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_PasswordWithoutUppercase_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(password: "password123!"));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.Password));
    }

    [Fact]
    public async Task Validate_PasswordMissingLowercase_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(password: "PASSWORD123!"));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.ErrorMessage == "Password must include at least one lowercase letter.");
    }

    [Fact]
    public async Task Validate_PasswordWithoutDigit_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(password: "Passwordabc!"));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.Password));
    }

    [Fact]
    public async Task Validate_PasswordMissingNonAlphanumeric_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(password: "Password1234"));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.ErrorMessage == "Password must include at least one non-alphanumeric character.");
    }

    [Fact]
    public async Task Validate_PasswordViolatingMultipleRules_ReturnsAllViolations()
    {
        var result = await _validator.ValidateAsync(CreateRequest(password: "abc", confirmPassword: "abc"));
        Assert.False(result.IsValid);
        var passwordErrors = result.Errors.Where(error => error.PropertyName == nameof(RegisterRequest.Password)).ToList();
        Assert.Contains(passwordErrors, error => error.ErrorMessage == "Password must be at least 8 characters.");
        Assert.Contains(passwordErrors, error => error.ErrorMessage == "Password must include at least one uppercase letter.");
        Assert.Contains(passwordErrors, error => error.ErrorMessage == "Password must include at least one number.");
        Assert.Contains(passwordErrors, error => error.ErrorMessage == "Password must include at least one non-alphanumeric character.");
        Assert.Equal(4, passwordErrors.Count);
    }

    [Fact]
    public async Task Validate_NullPassword_RejectedWithoutThrowing()
    {
        var request = new RegisterRequest
        {
            FullName = "Omar Khaled",
            Email = "omar.khaled@example.com",
            PhoneNumber = "+970599123456",
            Password = null!,
            ConfirmPassword = "Password123!",
            AccountType = AccountTypes.RegularUser
        };
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.Password));
    }

    [Fact]
    public async Task Password_Mismatch_Fails()
    {
        var request = CreateValidRequest(password: "Password123!", confirmPassword: "Different123!");
        var result = await _validator.ValidateAsync(request);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "ConfirmPassword");
    }

    [Fact]
    public async Task Validate_MismatchedConfirmation_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(password: "Password123!", confirmPassword: "Password1234!"));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.ConfirmPassword));
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

    [Fact]
    public async Task Validate_InvalidAccountType_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(accountType: "Admin"));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.AccountType));
    }

    [Fact]
    public async Task Validate_WhitespaceAccountType_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(accountType: "   "));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.AccountType));
    }

    [Fact]
    public async Task Validate_MissingAccountType_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(accountType: null));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.AccountType));
    }

    [Fact]
    public async Task Validate_EmptyAccountType_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(accountType: string.Empty));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.AccountType));
    }
}
