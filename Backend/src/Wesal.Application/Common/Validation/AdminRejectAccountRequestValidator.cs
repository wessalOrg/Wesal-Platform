using FluentValidation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.Application.Common.Validation;

/// <summary>
/// WESAL Task 5 (requirement 5.5) and Task 6 (requirement 6.4): a rejection reason is
/// mandatory and must fit the localized sentence it is embedded in.
/// </summary>
public class AdminRejectAccountRequestValidator : AbstractValidator<AdminRejectAccountRequestDto>
{
    public AdminRejectAccountRequestValidator()
    {
        RuleFor(request => request.Reason)
            .NotEmpty()
            .WithMessage("A rejection reason is required.");

        // The bound is measured on the trimmed reason, because the trimmed value is what the
        // review service persists and shows the requester.
        RuleFor(request => request.Reason)
            .Must(reason => string.IsNullOrWhiteSpace(reason)
                || (reason?.Trim().Length ?? 0) <= AccountRequestReviewLimits.MaximumReasonLength)
            .WithMessage(
                $"The rejection reason cannot exceed {AccountRequestReviewLimits.MaximumReasonLength} characters.");
    }
}
