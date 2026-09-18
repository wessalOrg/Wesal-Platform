using FluentValidation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Validation;

public class CreateHallRequestValidator : AbstractValidator<CreateHallRequest>
{
    public CreateHallRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Hall name is required.")
            .MaximumLength(200).WithMessage("Hall name must not exceed 200 characters.");

        RuleFor(x => x.ContactPhone)
            .NotEmpty().WithMessage("Contact phone is required.")
            .MaximumLength(30).WithMessage("Contact phone must not exceed 30 characters.")
            .Matches(@"^\+?[0-9][0-9\s\-]{6,19}$").WithMessage("A valid phone number is required.");

        RuleFor(x => x.Region)
            .NotEmpty().WithMessage("Region is required.")
            .Must(region => Enum.TryParse<HallRegion>(region.Replace(" ", ""), true, out _ ) || IsValidRegionString(region))
            .WithMessage("Region must be one of: North Gaza, Gaza, Middle Area, South Gaza.");

        RuleFor(x => x.Address)
            .NotEmpty().WithMessage("Address is required.")
            .MaximumLength(500).WithMessage("Address must not exceed 500 characters.");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required.")
            .MaximumLength(2000).WithMessage("Description must not exceed 2000 characters.");

        RuleFor(x => x.Capacity)
            .GreaterThan(0).WithMessage("Capacity must be greater than 0.")
            .LessThanOrEqualTo(10000).WithMessage("Capacity must not exceed 10000.");

        RuleFor(x => x.Price)
            .GreaterThanOrEqualTo(0).When(x => x.Price.HasValue).WithMessage("Price must be non-negative.")
            .Must(price => !price.HasValue || decimal.TryParse(price.Value.ToString(), out _)).WithMessage("Invalid price.");

        RuleFor(x => x.FirstPeriodStart)
            .NotEmpty().WithMessage("First period start time is required.");
        RuleFor(x => x.FirstPeriodEnd)
            .NotEmpty().WithMessage("First period end time is required.");
        RuleFor(x => x.SecondPeriodStart)
            .NotEmpty().WithMessage("Second period start time is required.");
        RuleFor(x => x.SecondPeriodEnd)
            .NotEmpty().WithMessage("Second period end time is required.");

        RuleFor(x => x)
            .Must(x => x.FirstPeriodEnd > x.FirstPeriodStart)
            .WithMessage("First period end time must be after start time.")
            .WithName("FirstPeriodEnd");

        RuleFor(x => x)
            .Must(x => x.SecondPeriodEnd > x.SecondPeriodStart)
            .WithMessage("Second period end time must be after start time.")
            .WithName("SecondPeriodEnd");

        RuleFor(x => x.Photos)
            .Must(photos => photos == null || photos.Count <= 10).WithMessage("Cannot upload more than 10 photos.")
            .When(x => x.Photos != null);
    }

    private static bool IsValidRegionString(string region)
    {
        var normalized = region.Trim().ToLowerInvariant();
        return normalized == "north gaza" || normalized == "gaza" || normalized == "middle area" || normalized == "south gaza";
    }
}
