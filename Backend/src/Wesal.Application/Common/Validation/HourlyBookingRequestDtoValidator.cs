using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

/// <summary>
/// Validates a seeker's hourly-slot booking request (WESAL-TASK-1, seeker flow).
/// Mirrors the conventions of <see cref="BookingRequestDtoValidator"/> (same rule
/// shapes and message style). Slot-start alignment and the hall-window boundary are
/// validated here as a first gate; day-open and already-booked rejection are enforced
/// atomically in the service/repository so a collision can never be silent.
/// </summary>
public class HourlyBookingRequestDtoValidator : AbstractValidator<HourlyBookingRequestDto>
{
    public HourlyBookingRequestDtoValidator()
    {
        RuleFor(request => request.HallId)
            .NotEmpty();

        RuleFor(request => request.Date)
            .NotEmpty();

        RuleFor(request => request.SlotStart)
            .NotEmpty()
            .WithMessage("An hourly slot start time is required.");

        RuleFor(request => request.SlotStart.Minute)
            .Equal(0)
            .WithMessage("Hourly slots are 60 minutes and must start on the hour (minutes == 00), e.g. 10:00.");

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
