using FluentValidation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Validation;

/// <summary>
/// Validates the text fields of the Event Coordinator setup submission (WESAL
/// coordinator setup). Branch-exclusive rules are conditional on the mandatory
/// shop-vs-freelance answer: shop-only fields are never required for a freelance
/// submission and vice versa. The required attachments (shop photo / exactly two work
/// photos / personal ID document) are validated by the setup service, which receives
/// the buffered file content.
///
/// The phone rule is the platform's existing phone convention (the same regex the
/// profile endpoint enforces), and the length caps mirror the established hall/user
/// field limits rather than inventing new ones.
/// </summary>
public class CoordinatorSetupRequestValidator : AbstractValidator<CoordinatorSetupRequest>
{
    public const int MaxShopNameLength = 200;
    public const int MaxOnlineStoreNameLength = 200;
    public const int MaxShopLocationLength = 500;
    public const int MaxPhoneNumberLength = 30;

    /// <summary>The platform's existing phone-number convention (see profile update).</summary>
    public const string PhoneNumberPattern = @"^\+?[0-9][0-9\s\-]{6,19}$";

    public CoordinatorSetupRequestValidator()
    {
        RuleFor(request => request.BusinessType)
            .NotNull()
            .WithMessage("You must answer whether you have a shop or work freelance.")
            .IsInEnum()
            .WithMessage("Business type must be either 'Shop' or 'Freelance'.");

        When(request => request.BusinessType == CoordinatorBusinessType.Shop, () =>
        {
            RuleFor(request => request.ShopName)
                .NotEmpty()
                .WithMessage("Shop name is required.")
                .MaximumLength(MaxShopNameLength)
                .WithMessage($"Shop name cannot exceed {MaxShopNameLength} characters.");

            RuleFor(request => request.ShopLocation)
                .NotEmpty()
                .WithMessage("Shop location is required.")
                .MaximumLength(MaxShopLocationLength)
                .WithMessage($"Shop location cannot exceed {MaxShopLocationLength} characters.");
        });

        When(request => request.BusinessType == CoordinatorBusinessType.Freelance, () =>
        {
            RuleFor(request => request.OnlineStoreName)
                .NotEmpty()
                .WithMessage("Online store name is required.")
                .MaximumLength(MaxOnlineStoreNameLength)
                .WithMessage($"Online store name cannot exceed {MaxOnlineStoreNameLength} characters.");
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
