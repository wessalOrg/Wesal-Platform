using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

public static class PublishingContentLimits
{
    public const int MaxImages = 10;
    public const int MaxTextLength = 2000;
    public const decimal MaxMoney = 9_999_999_999.99m;
}

public sealed class CreatePostRequestValidator : AbstractValidator<CreatePostRequest>
{
    public CreatePostRequestValidator()
    {
        RuleFor(request => request.Content).MaximumLength(PublishingContentLimits.MaxTextLength);
        RuleFor(request => request.Price).Must(IsMoney).WithMessage("Price must be non-negative and use at most two decimal places.");
        RuleFor(request => request.Images).Must(images => images.Count <= PublishingContentLimits.MaxImages)
            .WithMessage($"A post may contain at most {PublishingContentLimits.MaxImages} images.");
        RuleFor(request => request).Must(request => request.Images.Count > 0 || !string.IsNullOrWhiteSpace(request.Content))
            .WithMessage("A post must include an image or non-empty text.");
    }

    internal static bool IsMoney(decimal? value)
        => value is null || (value >= 0 && value <= PublishingContentLimits.MaxMoney && decimal.Round(value.Value, 2) == value.Value);
}

public sealed class UpdatePostRequestValidator : AbstractValidator<UpdatePostRequest>
{
    public UpdatePostRequestValidator()
    {
        RuleFor(request => request.Content).MaximumLength(PublishingContentLimits.MaxTextLength);
        RuleFor(request => request.Price).Must(CreatePostRequestValidator.IsMoney)
            .WithMessage("Price must be non-negative and use at most two decimal places.");
        RuleFor(request => request.Images).Must(images => images.Count <= PublishingContentLimits.MaxImages)
            .WithMessage($"A post may contain at most {PublishingContentLimits.MaxImages} images.");
        RuleFor(request => request.KeepImageIds).Must(images => images.Count <= PublishingContentLimits.MaxImages)
            .WithMessage($"A post may contain at most {PublishingContentLimits.MaxImages} images.");
    }
}

public abstract class ProfessionalOfferRequestValidator<T> : AbstractValidator<T> where T : CreateProfessionalOfferRequest
{
    protected ProfessionalOfferRequestValidator(TimeProvider timeProvider)
    {
        RuleFor(request => request.Content).MaximumLength(PublishingContentLimits.MaxTextLength);
        RuleFor(request => request.OldPrice).GreaterThan(0).LessThanOrEqualTo(PublishingContentLimits.MaxMoney)
            .Must(value => decimal.Round(value, 2) == value).WithMessage("Old price must be positive and use at most two decimal places.");
        RuleFor(request => request.OfferPrice).GreaterThan(0).LessThanOrEqualTo(PublishingContentLimits.MaxMoney)
            .Must(value => decimal.Round(value, 2) == value).WithMessage("Offer price must be positive and use at most two decimal places.");
        RuleFor(request => request).Must(request => request.OfferPrice < request.OldPrice)
            .WithMessage("Offer price must be lower than old price.");
        RuleFor(request => request.PriceBox).Must(CreatePostRequestValidator.IsMoney)
            .WithMessage("Price box must be non-negative and use at most two decimal places.");
        RuleFor(request => request.EndsAt).GreaterThan(request => request.StartsAt)
            .WithMessage("Offer end must be later than its start.");
        RuleFor(request => request.EndsAt).Must(end => end > timeProvider.GetUtcNow())
            .WithMessage("Offer end must be in the future.");
        RuleFor(request => request.Images).Must(images => images.Count <= PublishingContentLimits.MaxImages)
            .WithMessage($"An offer may contain at most {PublishingContentLimits.MaxImages} images.");
    }
}

public sealed class CreateProfessionalOfferRequestValidator : ProfessionalOfferRequestValidator<CreateProfessionalOfferRequest>
{
    public CreateProfessionalOfferRequestValidator(TimeProvider clock) : base(clock)
    {
        RuleFor(request => request).Must(request => request.Images.Count > 0 || !string.IsNullOrWhiteSpace(request.Content))
            .WithMessage("An offer must include an image or non-empty text.");
    }

    public CreateProfessionalOfferRequestValidator() : this(TimeProvider.System) { }
}

public sealed class UpdateProfessionalOfferRequestValidator : ProfessionalOfferRequestValidator<UpdateProfessionalOfferRequest>
{
    public UpdateProfessionalOfferRequestValidator(TimeProvider clock) : base(clock)
    {
        RuleFor(request => request.KeepImageIds).Must(images => images.Count <= PublishingContentLimits.MaxImages)
            .WithMessage($"An offer may contain at most {PublishingContentLimits.MaxImages} images.");
    }

    public UpdateProfessionalOfferRequestValidator() : this(TimeProvider.System) { }
}

public abstract class HallOfferRequestValidator<T> : AbstractValidator<T> where T : CreateHallOfferRequest
{
    protected HallOfferRequestValidator(TimeProvider timeProvider)
    {
        RuleFor(request => request.OldBookingPrice).GreaterThan(0).LessThanOrEqualTo(PublishingContentLimits.MaxMoney)
            .Must(value => decimal.Round(value, 2) == value).WithMessage("Old booking price must be positive and use at most two decimal places.");
        RuleFor(request => request.OfferPrice).GreaterThan(0).LessThanOrEqualTo(PublishingContentLimits.MaxMoney)
            .Must(value => decimal.Round(value, 2) == value).WithMessage("Offer price must be positive and use at most two decimal places.");
        RuleFor(request => request).Must(request => request.OfferPrice < request.OldBookingPrice)
            .WithMessage("Offer price must be lower than old booking price.");
        RuleFor(request => request.EndsAt).GreaterThan(request => request.StartsAt)
            .WithMessage("Offer end must be later than its start.");
        RuleFor(request => request.EndsAt).Must(end => end > timeProvider.GetUtcNow())
            .WithMessage("Offer end must be in the future.");
    }
}

public sealed class CreateHallOfferRequestValidator : HallOfferRequestValidator<CreateHallOfferRequest>
{
    public CreateHallOfferRequestValidator(TimeProvider clock) : base(clock) { }
    public CreateHallOfferRequestValidator() : this(TimeProvider.System) { }
}

public sealed class UpdateHallOfferRequestValidator : HallOfferRequestValidator<UpdateHallOfferRequest>
{
    public UpdateHallOfferRequestValidator(TimeProvider clock) : base(clock) { }
    public UpdateHallOfferRequestValidator() : this(TimeProvider.System) { }
}
