using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

/// <summary>
/// Validates an owner's whole-day block/unblock request (WESAL-TASK-1).
///
/// WESAL-TASK-1 hardening: <see cref="OwnerDayBlockRequest.IsOpen"/> carries no default
/// and must be supplied explicitly. This endpoint sets a state rather than merging a
/// partial update, so treating an omitted field as "true" would silently re-open a day
/// the owner had blocked. Requiring it keeps every day-block transition intentional.
/// </summary>
public class OwnerDayBlockRequestValidator : AbstractValidator<OwnerDayBlockRequest>
{
    public OwnerDayBlockRequestValidator()
    {
        RuleFor(request => request.IsOpen)
            .NotNull()
            .WithMessage("IsOpen is required: send false to block the day or true to re-open it.");
    }
}
