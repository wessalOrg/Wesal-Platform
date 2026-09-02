using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

public class ForgotPasswordRequestValidator : AbstractValidator<ForgotPasswordRequest>
{
    public ForgotPasswordRequestValidator()
    {
        RuleFor(request => request.Email)
            .NotEmpty()
            .WithMessage("Email is required.")
            .EmailAddress()
            .WithMessage("A valid email address is required.")
            .MaximumLength(RegisterRequestValidator.MaxEmailLength)
            .WithMessage($"Email cannot exceed {RegisterRequestValidator.MaxEmailLength} characters.");
    }
}

public class ResetPasswordRequestValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetPasswordRequestValidator()
    {
        RuleFor(request => request.Email)
            .NotEmpty()
            .WithMessage("Email is required.")
            .EmailAddress()
            .WithMessage("A valid email address is required.")
            .MaximumLength(RegisterRequestValidator.MaxEmailLength)
            .WithMessage($"Email cannot exceed {RegisterRequestValidator.MaxEmailLength} characters.");

        RuleFor(request => request.Token)
            .NotEmpty()
            .WithMessage("Reset token is required.");

        RuleFor(request => request.NewPassword)
            .NotEmpty()
            .WithMessage("New password is required.")
            .MinimumLength(RegisterRequestValidator.MinPasswordLength)
            .WithMessage($"Password must be at least {RegisterRequestValidator.MinPasswordLength} characters.")
            .MaximumLength(RegisterRequestValidator.MaxPasswordLength)
            .WithMessage($"Password cannot exceed {RegisterRequestValidator.MaxPasswordLength} characters.");

        RuleFor(request => request.NewPassword)
            .Must(password => password is not null && password.Any(char.IsUpper))
            .WithMessage("Password must include at least one uppercase letter.");

        RuleFor(request => request.NewPassword)
            .Must(password => password is not null && password.Any(char.IsLower))
            .WithMessage("Password must include at least one lowercase letter.");

        RuleFor(request => request.NewPassword)
            .Must(password => password is not null && password.Any(char.IsDigit))
            .WithMessage("Password must include at least one number.");

        RuleFor(request => request.NewPassword)
            .Must(password => password is not null && password.Any(character => !char.IsLetterOrDigit(character)))
            .WithMessage("Password must include at least one non-alphanumeric character.");

        RuleFor(request => request.ConfirmNewPassword)
            .NotEmpty()
            .WithMessage("Password confirmation is required.")
            .Equal(request => request.NewPassword)
            .WithMessage("Password and confirmation must match.");
    }
}