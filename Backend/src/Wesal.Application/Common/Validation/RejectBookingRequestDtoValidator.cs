using FluentValidation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.Application.Common.Validation;

/// <summary>
/// WESAL-TASK-12 (Edit 12): a rejection reason must be present and must fit.
/// </summary>
/// <remarks>
/// The service already refused a blank reason; what it could not refuse was an over-long one.
/// The reason is embedded in a localized sentence that is persisted as a conversation message,
/// and both that column and the reason's own column cap at 1000 characters, so a long reason
/// used to fail as an unhandled database error <i>after</i> the booking had already been
/// rejected. Capping the input turns that into a clean 400 before any state changes. The bound
/// comes from <see cref="BookingRejectionReasons"/> so the validator, the service and the
/// schema cannot drift apart.
/// </remarks>
public class RejectBookingRequestDtoValidator : AbstractValidator<RejectBookingRequestDto>
{
    public RejectBookingRequestDtoValidator()
    {
        RuleFor(request => request.Reason)
            .NotEmpty()
            .WithMessage("A rejection reason is required.");

        // The bound is measured on the trimmed reason, because the trimmed value is what the
        // service actually persists and shows the requester. Without this, a reason that fits
        // exactly once trimmed would be refused by the API while the service accepted it.
        RuleFor(request => request.Reason)
            .Must(reason => string.IsNullOrWhiteSpace(reason)
                || (reason?.Trim().Length ?? 0) <= BookingRejectionReasons.MaximumLength)
            .WithMessage(
                $"The rejection reason cannot exceed {BookingRejectionReasons.MaximumLength} characters.");
    }
}
