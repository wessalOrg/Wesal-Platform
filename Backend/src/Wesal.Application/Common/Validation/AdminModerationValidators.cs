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

public sealed class CreatePublishingRestrictionRequestValidator : AbstractValidator<CreatePublishingRestrictionRequest>
{
    public CreatePublishingRestrictionRequestValidator()
    {
        RuleFor(request => request.DurationHours).InclusiveBetween(ModerationLimits.MinimumRestrictionHours, ModerationLimits.MaximumRestrictionHours);
        RuleFor(request => request.Reason).MaximumLength(ModerationLimits.RestrictionReasonMaximumLength);
    }
}

public sealed class DeleteAccountRequestValidator : AbstractValidator<DeleteAccountRequest>
{
    public DeleteAccountRequestValidator() => RuleFor(request => request.Confirm).Equal(true);
}
