using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

public sealed class HowToRequestValidator : AbstractValidator<HowToRequest>
{
    public const int MaxQuestionLength = 500;

    public HowToRequestValidator()
    {
        RuleFor(request => request.Question)
            .NotEmpty()
            .WithMessage("Question cannot be empty.");

        RuleFor(request => request.Question)
            .Must(question => !string.IsNullOrWhiteSpace(question))
            .WithMessage("Question cannot be whitespace only.");

        RuleFor(request => request.Question)
            .MaximumLength(MaxQuestionLength)
            .WithMessage($"Question cannot exceed {MaxQuestionLength} characters.");
    }
}
