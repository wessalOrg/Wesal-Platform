using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

public class UpdateProfileRequestValidator : AbstractValidator<UpdateProfileRequest>
{
    public const int MaxFullNameLength = 150;
    public const int MaxEmailLength = 256;
    public const int MaxPhoneLength = 30;

    public UpdateProfileRequestValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Full name is required.")
            .Must(x => !string.IsNullOrWhiteSpace(x)).WithMessage("Full name cannot be whitespace only.")
            .MaximumLength(MaxFullNameLength).WithMessage($"Full name cannot exceed {MaxFullNameLength} characters.");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("A valid email address is required.")
            .MaximumLength(MaxEmailLength).WithMessage($"Email cannot exceed {MaxEmailLength} characters.");

        RuleFor(x => x.PhoneNumber)
            .NotEmpty().WithMessage("Phone number is required.")
            .MaximumLength(MaxPhoneLength).WithMessage($"Phone number cannot exceed {MaxPhoneLength} characters.")
            .Matches(@"^\+?[0-9][0-9\s\-]{6,19}$").WithMessage("A valid phone number is required.");
    }
}
