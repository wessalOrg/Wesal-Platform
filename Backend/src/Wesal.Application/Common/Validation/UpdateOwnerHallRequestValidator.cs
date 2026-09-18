using FluentValidation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Validation;

/// <summary>
/// Validates an owner hall update payload (US-OWNER-07, FR-HALL-02). The rules reuse
/// the Add Hall field constraints defined in FR-HALL-01: mandatory name, address and
/// photos, the two predefined daily booking periods (each with an end time strictly
/// later than its start time), and length/value limits aligned with the domain model.
/// </summary>
public class UpdateOwnerHallRequestValidator : AbstractValidator<UpdateOwnerHallRequest>
{
    public UpdateOwnerHallRequestValidator()
    {
        RuleFor(request => request.Name)
            .NotEmpty()
            .WithMessage("Hall name is required.")
            .MaximumLength(200);

        RuleFor(request => request.Address)
            .NotEmpty()
            .WithMessage("Hall address is required.")
            .MaximumLength(500);

        RuleFor(request => request.ContactPhone)
            .MaximumLength(30);

        RuleFor(request => request.Description)
            .MaximumLength(2000);

        RuleFor(request => request.MainImageUrl)
            .MaximumLength(500);

        RuleFor(request => request.Capacity)
            .GreaterThanOrEqualTo(1)
            .WithMessage("Capacity must be at least 1 guest.");

        RuleFor(request => request.Price)
            .GreaterThan(0)
            .WithMessage("Price must be greater than zero.")
            .When(request => request.Price.HasValue);

        RuleFor(request => request)
            .Must(request => !request.ShowPrice || request.Price.HasValue)
            .WithName("Price")
            .WithMessage("A price must be provided when the price is shown.");

        RuleFor(request => request.Region)
            .IsInEnum()
            .WithMessage("An unknown hall region was provided.");

        RuleFor(request => request.Photos)
            .NotEmpty()
            .WithMessage("At least one photo is required.");

        RuleFor(request => request.Photos)
            .Must(photos => photos.Select(photo => photo.DisplayOrder).Distinct().Count() == photos.Count)
            .WithMessage("Photo display orders must not contain duplicates.");

        RuleForEach(request => request.Photos)
            .ChildRules(photo =>
            {
                photo.RuleFor(item => item.Url)
                    .NotEmpty()
                    .WithMessage("Photo URL is required.")
                    .MaximumLength(500);

                photo.RuleFor(item => item.DisplayOrder)
                    .GreaterThanOrEqualTo(0)
                    .WithMessage("Photo display order must be zero or greater.");
            });

        RuleFor(request => request.BookingPeriods)
            .Must(periods => periods.Count(period => period.Type == BookingPeriodType.FirstPeriod) == 1
                && periods.Count(period => period.Type == BookingPeriodType.SecondPeriod) == 1)
            .WithMessage("Each of the two daily booking periods must be configured exactly once.");

        RuleForEach(request => request.BookingPeriods)
            .ChildRules(period =>
            {
                period.RuleFor(item => item.Type)
                    .IsInEnum()
                    .WithMessage("An unknown booking period type was provided.");

                period.RuleFor(item => item.EndTime)
                    .GreaterThan(item => item.StartTime)
                    .WithMessage("The booking period end time must be later than its start time.");
            });
    }
}