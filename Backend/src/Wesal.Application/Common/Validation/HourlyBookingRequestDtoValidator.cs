using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

/// <summary>
/// Validates a seeker's multi-slot hourly booking requests (WESAL-TASK-1,
/// seeker flow). Slot ordering, the hall-window boundary, day availability, and booking
/// collisions are enforced atomically in the service and repository.
/// </summary>
public class HourlyBookingRequestDtoValidator : AbstractValidator<HourlyBookingRequestDto>
{
    public HourlyBookingRequestDtoValidator()
    {
        RuleFor(request => request.HallId)
            .NotEmpty();

        // DateOnly is a non-nullable struct, so NotEmpty() can never fail here and would
        // let default (0001-01-01) through. Compare against default explicitly.
        RuleFor(request => request.Date)
            .Must(date => date != default)
            .WithMessage("The booking date is required.");

        RuleFor(request => request.SlotStarts)
            .NotNull()
            .Must(slots => slots is { Count: > 0 })
            .WithMessage("Select at least one hourly slot to book.");

        RuleFor(request => request.NameOnBooking)
            .NotEmpty()
            .WithMessage("The name on the booking is required.")
            .MaximumLength(100);

        RuleFor(request => request.RequesterName)
            .NotEmpty()
            .WithMessage("The requester name is required.")
            .MaximumLength(100);
    }
}
