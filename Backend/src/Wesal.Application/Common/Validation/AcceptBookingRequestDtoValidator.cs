using FluentValidation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.Application.Common.Validation;

/// <summary>
/// WESAL-TASK-8 (Edit 8): the owner must state a real deposit when approving a booking
/// request. A zero or missing amount is refused rather than defaulted, because an
/// approval that collects nothing is indistinguishable from an unfinished action, and the
/// cap keeps a fat-fingered entry from asking the requester for an absurd sum. The bounds
/// come from <see cref="BookingDeposits"/> so the API and the domain cannot drift apart.
/// </summary>
public class AcceptBookingRequestDtoValidator : AbstractValidator<AcceptBookingRequestDto>
{
    public AcceptBookingRequestDtoValidator()
    {
        RuleFor(request => request.DepositAmount)
            .GreaterThanOrEqualTo(BookingDeposits.MinimumAmount)
            .WithMessage("A deposit amount greater than zero is required to accept a booking request.")
            .LessThanOrEqualTo(BookingDeposits.MaximumAmount)
            .WithMessage($"The deposit amount cannot exceed {BookingDeposits.MaximumAmount}.");
    }
}
