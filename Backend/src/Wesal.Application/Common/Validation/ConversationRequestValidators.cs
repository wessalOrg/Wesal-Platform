using FluentValidation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.Application.Common.Validation;

public class CreateConversationRequestValidator : AbstractValidator<CreateConversationRequest>
{
    public CreateConversationRequestValidator()
    {
        RuleFor(request => request.HallId).NotEmpty();
    }
}

public class SendMessageRequestValidator : AbstractValidator<SendMessageRequest>
{
    public SendMessageRequestValidator()
    {
        RuleFor(request => request.Content)
            .NotEmpty()
            .WithMessage("Message content is required.")
            .MaximumLength(1000)
            .WithMessage("Message content must not exceed 1000 characters.");

        // WESAL-TASK-10 (Edit 10): the bound now comes from MessageLimits, which the send
        // service also enforces. That service-side check is the load-bearing one: this rule
        // only runs for a non-null body over HTTP, and the attachment endpoint's equivalent
        // form field is not covered by any validator at all.
        RuleFor(request => request.ClientRequestId)
            .MaximumLength(MessageLimits.MaximumClientRequestIdLength)
            .When(request => !string.IsNullOrWhiteSpace(request.ClientRequestId))
            .WithMessage(
                $"Client request identifier must not exceed {MessageLimits.MaximumClientRequestIdLength} characters.");
    }
}
