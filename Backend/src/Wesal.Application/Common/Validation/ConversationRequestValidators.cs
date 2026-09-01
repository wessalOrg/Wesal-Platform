using FluentValidation;
using Wesal.Application.Common.Models;

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

        RuleFor(request => request.ClientRequestId)
            .MaximumLength(450)
            .When(request => !string.IsNullOrWhiteSpace(request.ClientRequestId))
            .WithMessage("Client request identifier must not exceed 450 characters.");
    }
}
