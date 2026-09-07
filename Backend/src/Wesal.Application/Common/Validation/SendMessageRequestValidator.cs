using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

public sealed class SendMessageRequestValidator : AbstractValidator<SendMessageRequest>
{
    public const int MaxContentLength = 1000;

    public SendMessageRequestValidator()
    {
        RuleFor(x => x.Content)
            .NotEmpty().WithMessage("Message content is required.")
            .Must(content => !string.IsNullOrWhiteSpace(content)).WithMessage("Message content cannot be whitespace only.")
            .MaximumLength(MaxContentLength).WithMessage($"Message content cannot exceed {MaxContentLength} characters.");

        RuleFor(x => x.IdempotencyKey)
            .MaximumLength(100).WithMessage("Idempotency key cannot exceed 100 characters.")
            .When(x => x.IdempotencyKey is not null);
    }
}
