using FluentValidation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.Application.Common.Validation;

public class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public const int MaxFullNameLength = 150;
    public const int MaxEmailLength = 256;
    public const int MaxPhoneLength = 30;
    public const int MinPasswordLength = 8;
    public const int MaxPasswordLength = 128;

    public RegisterRequestValidator()
    {
        RuleFor(request => request.FullName)
            .NotEmpty()
            .WithMessage("Full name is required.");

        RuleFor(request => request.FullName)
            .Must(name => !string.IsNullOrWhiteSpace(name))
            .WithMessage("Full name cannot be whitespace only.");

        RuleFor(request => request.FullName)
            .MaximumLength(MaxFullNameLength)
            .WithMessage($"Full name cannot exceed {MaxFullNameLength} characters.");

        RuleFor(request => request.Email)
            .NotEmpty()
            .WithMessage("Email is required.")
            .EmailAddress()
            .WithMessage("A valid email address is required.")
            .MaximumLength(MaxEmailLength)
            .WithMessage($"Email cannot exceed {MaxEmailLength} characters.");

        RuleFor(request => request.PhoneNumber)
            .NotEmpty()
            .WithMessage("Phone number is required.");

        RuleFor(request => request.PhoneNumber)
            .MaximumLength(MaxPhoneLength)
            .WithMessage($"Phone number cannot exceed {MaxPhoneLength} characters.");

        RuleFor(request => request.PhoneNumber)
            .Matches(@"^\+?[0-9][0-9\s\-]{6,19}$")
            .WithMessage("A valid phone number is required.");

        RuleFor(request => request.PhoneNumber)
            .Matches(@"^\+?[1-9]\d{7,14}$")
            .When(phone => !string.IsNullOrWhiteSpace(phone.PhoneNumber) && !phone.PhoneNumber.Contains(' ') && !phone.PhoneNumber.Contains('-'))
            .WithMessage("Phone number is not valid.");

        RuleFor(request => request.Password)
            .NotEmpty()
            .WithMessage("Password is required.")
            .MinimumLength(MinPasswordLength)
            .WithMessage($"Password must be at least {MinPasswordLength} characters.")
            .MaximumLength(MaxPasswordLength)
            .WithMessage($"Password cannot exceed {MaxPasswordLength} characters.");

        RuleFor(request => request.Password)
            .Must(password => password is not null && password.Any(char.IsUpper))
            .WithMessage("Password must include at least one uppercase letter.");

        RuleFor(request => request.Password)
            .Must(password => password is not null && password.Any(char.IsLower))
            .WithMessage("Password must include at least one lowercase letter.");

        RuleFor(request => request.Password)
            .Must(password => password is not null && password.Any(char.IsDigit))
            .WithMessage("Password must include at least one number.");

        RuleFor(request => request.Password)
            .Must(password => password is not null && password.Any(character => !char.IsLetterOrDigit(character)))
            .WithMessage("Password must include at least one non-alphanumeric character.");

        RuleFor(request => request.ConfirmPassword)
            .NotEmpty()
            .WithMessage("Password confirmation is required.")
            .Equal(request => request.Password)
            .WithMessage("Password and confirmation must match.");

        RuleFor(request => request.AccountType)
            .NotEmpty()
            .WithMessage("Account type is required.");

        RuleFor(request => request.AccountType)
            .Must(IsValidAccountType)
            .WithMessage($"Account type must be one of: {string.Join(", ", AccountTypes.All)} / {ApplicationRoles.RegisteredUser}, {ApplicationRoles.HallOwner}.");

        RuleFor(request => request.AccountType)
            .Must(type => type == ApplicationRoles.RegisteredUser || type == ApplicationRoles.HallOwner || AccountTypes.IsValid(type))
            .WithMessage($"Account type must be either '{ApplicationRoles.RegisteredUser}' or '{ApplicationRoles.HallOwner}' or '{AccountTypes.RegularUser}'.");
    }

    private static bool IsValidAccountType(string? accountType)
    {
        if (string.IsNullOrWhiteSpace(accountType))
            return false;
        // Accept both ApplicationRoles and AccountTypes spellings
        return accountType.Equals(ApplicationRoles.RegisteredUser, StringComparison.OrdinalIgnoreCase)
            || accountType.Equals(ApplicationRoles.HallOwner, StringComparison.OrdinalIgnoreCase)
            || accountType.Equals(AccountTypes.RegularUser, StringComparison.OrdinalIgnoreCase)
            || accountType.Equals(AccountTypes.HallOwner, StringComparison.OrdinalIgnoreCase);
    }
}
