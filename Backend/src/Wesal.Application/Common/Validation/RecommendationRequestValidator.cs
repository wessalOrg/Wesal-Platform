using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

public sealed class RecommendationRequestValidator : AbstractValidator<RecommendationRequest>
{
    public const int MaxMessageLength = 1000;

    public RecommendationRequestValidator()
    {
        RuleFor(request => request.Message)
            .NotEmpty()
            .WithMessage("Message cannot be empty.");

        RuleFor(request => request.Message)
            .Must(message => !string.IsNullOrWhiteSpace(message))
            .WithMessage("Message cannot be whitespace only.");

        RuleFor(request => request.Message)
            .MaximumLength(MaxMessageLength)
            .WithMessage($"Message cannot exceed {MaxMessageLength} characters.");
    }
}
