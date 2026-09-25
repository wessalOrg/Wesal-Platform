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

        // WESAL-TASK-1 hardening: the legacy path now requires and persists the name on
        // the booking too, mirroring HourlyBookingRequestDtoValidator so both booking
        // entry points enforce requirement 6 identically.
        RuleFor(request => request.NameOnBooking)
            .NotEmpty()
            .WithMessage("The name on the booking is required.")
            .MaximumLength(100);
    }
}
