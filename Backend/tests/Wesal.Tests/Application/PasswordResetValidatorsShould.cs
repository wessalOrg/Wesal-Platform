using FluentValidation.TestHelper;
using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;

namespace Wesal.Tests.Application;

public class ForgotPasswordRequestValidatorShould
{
    private readonly ForgotPasswordRequestValidator _validator = new();

    [Fact]
    public void Validate_EmptyEmail_IsInvalid()
    {
        var request = new ForgotPasswordRequest { Email = string.Empty };

        var result = _validator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.Email);
    }

    [Fact]
    public void Validate_InvalidEmail_IsInvalid()
    {
        var request = new ForgotPasswordRequest { Email = "not-an-email" };

        var result = _validator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.Email);
    }

    [Fact]
    public void Validate_OverlongEmail_IsInvalid()
    {
        var longEmail = $"{new string('a', 250)}@example.com";
        var request = new ForgotPasswordRequest { Email = longEmail };

        var result = _validator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.Email);
    }

    [Fact]
    public void Validate_ValidEmail_IsValid()
    {
        var request = new ForgotPasswordRequest { Email = "user@example.com" };

        var result = _validator.TestValidate(request);

        result.ShouldNotHaveAnyValidationErrors();
    }
}

public class ResetPasswordRequestValidatorShould
{
    private readonly ResetPasswordRequestValidator _validator = new();

    [Fact]
    public void Validate_ValidRequest_IsValid()
    {
        var request = new ResetPasswordRequest
        {
            Email = "user@example.com",
            Token = "reset-token",
            NewPassword = "NewPassword123!",
            ConfirmNewPassword = "NewPassword123!"
        };

        var result = _validator.TestValidate(request);

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_MissingToken_IsInvalid()
    {
        var request = new ResetPasswordRequest
        {
            Email = "user@example.com",
            Token = string.Empty,
            NewPassword = "NewPassword123!",
            ConfirmNewPassword = "NewPassword123!"
        };

        var result = _validator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.Token);
    }

    [Fact]
    public void Validate_WeakPassword_IsInvalid()
    {
        var request = new ResetPasswordRequest
        {
            Email = "user@example.com",
            Token = "reset-token",
            NewPassword = "weak",
            ConfirmNewPassword = "weak"
        };

        var result = _validator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.NewPassword);
    }

    [Fact]
    public void Validate_ConfirmationMismatch_IsInvalid()
    {
        var request = new ResetPasswordRequest
        {
            Email = "user@example.com",
            Token = "reset-token",
            NewPassword = "NewPassword123!",
            ConfirmNewPassword = "DifferentPassword123!"
        };

        var result = _validator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.ConfirmNewPassword);
    }

    [Fact]
    public void Validate_InvalidEmail_IsInvalid()
    {
        var request = new ResetPasswordRequest
        {
            Email = "not-an-email",
            Token = "reset-token",
            NewPassword = "NewPassword123!",
            ConfirmNewPassword = "NewPassword123!"
        };

        var result = _validator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.Email);
    }
}