using FluentValidation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.Application.Common.Validation;

public sealed class DeleteContentRequestValidator : AbstractValidator<DeleteContentRequest>
{
    public DeleteContentRequestValidator()
    {
        RuleFor(request => request.Reason).NotEmpty().MaximumLength(ModerationLimits.DeletionReasonMaximumLength);
    }
}

public sealed class CreateAccountLockRequestValidator : AbstractValidator<CreateAccountLockRequest>
{
    public CreateAccountLockRequestValidator()
    {
        RuleFor(request => request.DurationHours).InclusiveBetween(ModerationLimits.MinimumRestrictionHours, ModerationLimits.MaximumRestrictionHours);
        RuleFor(request => request.Reason).MaximumLength(ModerationLimits.RestrictionReasonMaximumLength);
    }
}
