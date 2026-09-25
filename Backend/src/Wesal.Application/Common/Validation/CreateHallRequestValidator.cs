using FluentValidation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Catalogs;
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

        RuleFor(x => x.DetailedAddress)
            .MaximumLength(RegionAddressCatalog.DetailedAddressMaxLength)
            .WithMessage($"Detailed address must not exceed {RegionAddressCatalog.DetailedAddressMaxLength} characters.")
            .Must((request, value) => string.IsNullOrWhiteSpace(value) || RegionAddressCatalog.Contains(ParseRegion(request.Region), value))
            .WithMessage("The detailed address does not belong to the selected region's address list.");

        RuleFor(x => x.Description)
            .MaximumLength(2000).WithMessage("Description must not exceed 2000 characters.");

        RuleFor(x => x.Capacity)
            .GreaterThan(0).WithMessage("Capacity must be greater than 0.")
            .LessThanOrEqualTo(10000).WithMessage("Capacity must not exceed 10000.");

        RuleFor(x => x.Price)
            .GreaterThanOrEqualTo(0).When(x => x.Price.HasValue).WithMessage("Price must be non-negative.")
            .Must(price => !price.HasValue || decimal.TryParse(price.Value.ToString(), out _)).WithMessage("Invalid price.");

        RuleFor(x => x.YouTubeVideoUrl)
            .Must(value => string.IsNullOrWhiteSpace(value) || YoutubeUrlValidator.IsValid(value))
            .WithMessage("Enter a valid YouTube link (youtube.com or youtu.be).");

        // A hall with no coherent hourly window is silently unbookable, because the
        // seeker catalog derives its slots from start (inclusive) to end (exclusive).
        RuleFor(x => x.HourlySlotStart)
            .Must(BeWholeHour)
            .When(x => x.HourlySlotStart.HasValue)
            .WithMessage("HourlySlotStart must start on the hour (minutes == 00).");

        RuleFor(x => x.HourlySlotEnd)
            .Must(BeWholeHour)
            .When(x => x.HourlySlotEnd.HasValue)
            .WithMessage("HourlySlotEnd must start on the hour (minutes == 00).");

        RuleFor(x => x)
            .Must(x => !x.HourlySlotStart.HasValue
                || !x.HourlySlotEnd.HasValue
                || x.HourlySlotStart.Value < x.HourlySlotEnd.Value)
            .WithMessage("HourlySlotEnd must be after HourlySlotStart.");

        RuleFor(x => x.Features)
            .Must(features => features == null || features.All(HallFeatureCatalog.IsPredefined))
            .WithMessage("One or more selected features are not in the predefined feature list.");

        RuleFor(x => x.OtherFeatures)
            .MaximumLength(HallFeatureCatalog.OtherFeaturesMaxLength)
            .WithMessage($"Additional features must not exceed {HallFeatureCatalog.OtherFeaturesMaxLength} characters.");

        RuleFor(x => x.Photos)
            .Must(photos => photos == null || photos.Count <= 10).WithMessage("Cannot upload more than 10 photos.")
            .When(x => x.Photos != null);
    }

    private static bool BeWholeHour(TimeOnly? time)
        => time is null || (time.Value.Minute == 0 && time.Value.Second == 0);

    private static HallRegion ParseRegion(string region)
    {
        var normalized = (region ?? string.Empty).Trim().ToLowerInvariant().Replace(" ", "");
        return normalized switch
        {
            "northgaza" => HallRegion.NorthGaza,
            "gaza" => HallRegion.Gaza,
            "middlearea" => HallRegion.MiddleArea,
            "southgaza" => HallRegion.SouthGaza,
            _ => default
        };
    }

    private static bool IsValidRegionString(string region)
    {
        var normalized = region.Trim().ToLowerInvariant();
        return normalized == "north gaza" || normalized == "gaza" || normalized == "middle area" || normalized == "south gaza";
    }
}
