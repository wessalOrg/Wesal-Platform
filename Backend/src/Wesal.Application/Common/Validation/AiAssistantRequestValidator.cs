using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

public sealed class AiAssistantRequestValidator : AbstractValidator<AiAssistantRequest>
{
    public const int MaxMessageLength = 2000;

    public AiAssistantRequestValidator()
    {
        RuleFor(x => x.Message)
            .NotEmpty().WithMessage("Message is required.")
            .MaximumLength(MaxMessageLength).WithMessage($"Message must not exceed {MaxMessageLength} characters.");
    }
}