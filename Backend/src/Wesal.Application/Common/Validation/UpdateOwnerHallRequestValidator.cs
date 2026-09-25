using FluentValidation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Catalogs;
using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Validation;

/// <summary>
/// Validates an owner hall update payload (US-OWNER-07, FR-HALL-02). The rules reuse
/// the Add Hall field constraints defined in FR-HALL-01: mandatory name, address and
/// photos, plus length and value limits aligned with the domain model.
/// </summary>
public class UpdateOwnerHallRequestValidator : AbstractValidator<UpdateOwnerHallRequest>
{
    public UpdateOwnerHallRequestValidator()
    {
        RuleFor(request => request.Name)
            .NotEmpty()
            .WithMessage("Hall name is required.")
            .MaximumLength(200);

        // The address is a dependent selection (US-HALL): it must be one of the
        // selected region's predefined values and can never be free text.
        RuleFor(request => request.Address)
            .NotEmpty()
            .WithMessage("Hall address is required.")
            .MaximumLength(RegionAddressCatalog.AddressMaxLength)
            .WithMessage($"Address must not exceed {RegionAddressCatalog.AddressMaxLength} characters.")
            .Must((request, value) =>
                string.IsNullOrWhiteSpace(value)
                || RegionAddressCatalog.Contains(request.Region, value))
            .WithMessage("The address does not belong to the selected region's address list.");

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

        // A hall with no coherent hourly window is silently unbookable, because the
        // seeker catalog derives its slots from start (inclusive) to end (exclusive).
        RuleFor(request => request.HourlySlotStart)
            .Must(BeWholeHour)
            .When(request => request.HourlySlotStart.HasValue)
            .WithMessage("HourlySlotStart must start on the hour (minutes == 00).");

        RuleFor(request => request.HourlySlotEnd)
            .Must(BeWholeHour)
            .When(request => request.HourlySlotEnd.HasValue)
            .WithMessage("HourlySlotEnd must start on the hour (minutes == 00).");

        RuleFor(request => request)
            .Must(request => !request.HourlySlotStart.HasValue
                || !request.HourlySlotEnd.HasValue
                || request.HourlySlotStart.Value < request.HourlySlotEnd.Value)
            .WithMessage("HourlySlotEnd must be after HourlySlotStart.");

        RuleFor(request => request.Region)
            .IsInEnum()
            .WithMessage("An unknown hall region was provided.");

        // The detailed address is the owner's own extra detail, typed freely and no
        // longer validated against the region's predefined list.
        RuleFor(request => request.DetailedAddress)
            .MaximumLength(RegionAddressCatalog.DetailedAddressMaxLength)
            .WithMessage($"Detailed address must not exceed {RegionAddressCatalog.DetailedAddressMaxLength} characters.");

        RuleFor(request => request.YouTubeVideoUrl)
            .Must(value => string.IsNullOrWhiteSpace(value) || YoutubeUrlValidator.IsValid(value))
            .WithMessage("Enter a valid YouTube link (youtube.com or youtu.be).");

        RuleFor(request => request.Features)
            .Must(features => features.All(HallFeatureCatalog.IsPredefined))
            .WithMessage("One or more selected features are not in the predefined feature list.");

        RuleFor(request => request.OtherFeatures)
            .MaximumLength(HallFeatureCatalog.OtherFeaturesMaxLength)
            .WithMessage($"Additional features must not exceed {HallFeatureCatalog.OtherFeaturesMaxLength} characters.");

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
    }

    private static bool BeWholeHour(TimeOnly? time)
        => time is null || (time.Value.Minute == 0 && time.Value.Second == 0);
}