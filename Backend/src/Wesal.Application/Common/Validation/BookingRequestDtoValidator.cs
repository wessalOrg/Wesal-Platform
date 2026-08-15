using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

public class BookingRequestDtoValidator : AbstractValidator<BookingRequestDto>
{
    public BookingRequestDtoValidator()
    {
        RuleFor(request => request.HallId)
            .NotEmpty();

        RuleFor(request => request.Date)
            .NotEmpty();

        RuleFor(request => request.Periods)
            .NotEmpty()
            .WithMessage("At least one booking period must be selected.");

        RuleFor(request => request.Periods)
            .Must(periods => periods.Distinct().Count() == periods.Count)
            .WithMessage("Booking periods must not contain duplicates.");

        RuleForEach(request => request.Periods)
            .IsInEnum();
    }
}
