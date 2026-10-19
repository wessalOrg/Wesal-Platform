using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

/// <summary>
/// Validates the text fields of the Photographer setup submission (WESAL photographer
/// setup). Branch-exclusive rules are conditional on the mandatory studio answer:
/// studio-only fields are never required for a no-studio submission and the no-studio
/// full name is never required for a studio submission. The required personal ID
/// document is validated by the setup service, which receives the buffered file
/// content.
///
/// The phone rule is the platform's existing phone convention (the same regex the
/// coordinator setup and profile endpoint enforce), and the length caps mirror the
/// established hall/user field limits rather than inventing new ones.
/// </summary>
public class PhotographerSetupRequestValidator : AbstractValidator<PhotographerSetupRequest>
{
    public const int MaxStudioNameLength = 200;
    public const int MaxStudioLocationLength = 500;
    public const int MaxDetailedStudioLocationLength = 500;
    public const int MaxFullNameLength = 150;
    public const int MaxPhoneNumberLength = 30;

    /// <summary>The platform's existing phone-number convention (see profile update).</summary>
    public const string PhoneNumberPattern = @"^\+?[0-9][0-9\s\-]{6,19}$";

    public PhotographerSetupRequestValidator()
    {
        RuleFor(request => request.HasStudio)
            .NotNull()
            .WithMessage("You must answer whether you have a studio or a place for photography.");

        When(request => request.HasStudio == true, () =>
        {
            RuleFor(request => request.StudioName)
                .NotEmpty()
                .WithMessage("Studio name is required.")
                .MaximumLength(MaxStudioNameLength)
                .WithMessage($"Studio name cannot exceed {MaxStudioNameLength} characters.");

            RuleFor(request => request.StudioLocation)
                .NotEmpty()
                .WithMessage("Studio location is required.")
                .MaximumLength(MaxStudioLocationLength)
                .WithMessage($"Studio location cannot exceed {MaxStudioLocationLength} characters.");

            RuleFor(request => request.DetailedStudioLocation)
                .NotEmpty()
                .WithMessage("Detailed studio location is required.")
                .MaximumLength(MaxDetailedStudioLocationLength)
                .WithMessage($"Detailed studio location cannot exceed {MaxDetailedStudioLocationLength} characters.");
        });

        When(request => request.HasStudio == false, () =>
        {
            RuleFor(request => request.FullName)
                .NotEmpty()
                .WithMessage("Full name is required.")
                .MaximumLength(MaxFullNameLength)
                .WithMessage($"Full name cannot exceed {MaxFullNameLength} characters.");
        });

        RuleFor(request => request.PhoneNumber)
            .NotEmpty()
            .WithMessage("Phone number is required.")
            .MaximumLength(MaxPhoneNumberLength)
            .WithMessage($"Phone number cannot exceed {MaxPhoneNumberLength} characters.")
            .Matches(PhoneNumberPattern)
            .WithMessage("A valid phone number is required.");
    }
}
