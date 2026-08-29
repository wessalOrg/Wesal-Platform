using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(request => request.Identifier)
            .NotEmpty()
            .WithMessage("Identifier is required.");

        RuleFor(request => request.Identifier)
            .Must(identifier => !string.IsNullOrWhiteSpace(identifier))
            .WithMessage("Identifier cannot be whitespace only.");

        RuleFor(request => request.Password)
            .NotEmpty()
            .WithMessage("Password is required.");
    }
}