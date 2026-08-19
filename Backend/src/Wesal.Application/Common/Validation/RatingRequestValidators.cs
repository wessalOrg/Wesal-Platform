using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

public class CreateRatingRequestValidator : AbstractValidator<CreateRatingRequest>
{
    public CreateRatingRequestValidator()
    {
        RuleFor(request => request.HallId).NotEmpty();
        RuleFor(request => request.Value)
            .InclusiveBetween(1, 5)
            .WithMessage("Rating value must be between 1 and 5.");
    }
}

public class UpdateRatingRequestValidator : AbstractValidator<UpdateRatingRequest>
{
    public UpdateRatingRequestValidator()
    {
        RuleFor(request => request.HallId).NotEmpty();
        RuleFor(request => request.Value)
            .InclusiveBetween(1, 5)
            .WithMessage("Rating value must be between 1 and 5.");
    }
}
