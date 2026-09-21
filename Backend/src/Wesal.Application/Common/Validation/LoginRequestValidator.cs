using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public const int MaxEmailLength = 256;

    public LoginRequestValidator()
    {
        RuleFor(request => request.Email)
            .NotEmpty()
            .WithMessage("Email is required.");

        RuleFor(request => request.Email)
            .EmailAddress()
            .WithMessage("A valid email address is required.")
            .MaximumLength(MaxEmailLength)
            .WithMessage($"Email cannot exceed {MaxEmailLength} characters.");

        RuleFor(request => request.Password)
            .NotEmpty()
            .WithMessage("Password is required.");
    }
}