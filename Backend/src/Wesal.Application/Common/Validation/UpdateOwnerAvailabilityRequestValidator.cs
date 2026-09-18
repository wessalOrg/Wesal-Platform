using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

public class UpdateOwnerAvailabilityRequestValidator : AbstractValidator<UpdateOwnerAvailabilityRequest>
{
    public UpdateOwnerAvailabilityRequestValidator()
    {
        RuleFor(x => x.Date).NotEmpty().WithMessage("Date is required.");
        RuleFor(x => x.PeriodType).IsInEnum().WithMessage("Invalid booking period.");
        RuleFor(x => x.Status).IsInEnum().WithMessage("Invalid availability status.");
    }
}
