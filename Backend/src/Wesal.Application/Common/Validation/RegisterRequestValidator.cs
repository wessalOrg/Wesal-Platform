using FluentValidation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.Application.Common.Validation;

public class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public const int MaxFullNameLength = 150;
    public const int MaxEmailLength = 256;
    public const int MinPasswordLength = 8;
    public const int MaxPasswordLength = 128;

    public RegisterRequestValidator()
    {
        RuleFor(request => request.FullName)
            .NotEmpty()
            .WithMessage("Full name is required.");

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
            .WithMessage($"Account type must be one of: {AccountTypes.RegularUser}, {AccountTypes.HallOwner}, {AccountTypes.EventCoordinator}, {AccountTypes.Photographer}, {ApplicationRoles.RegisteredUser}, or {ApplicationRoles.HallOwner}.");
    }

    private static bool IsValidAccountType(string? accountType)
    {
        if (string.IsNullOrWhiteSpace(accountType))
            return false;
        // Accept every registrable account type (case-insensitive), plus the legacy
        // RegisteredUser role-name spelling kept for backward compatibility.
        return AccountTypes.IsValid(accountType)
            || accountType.Equals(ApplicationRoles.RegisteredUser, StringComparison.OrdinalIgnoreCase);
    }
}
