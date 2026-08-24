using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

public sealed class AiHowToQuestionValidator : AbstractValidator<AiHowToRequest>
{
    private const int MaxQuestionLength = 2000;

    public AiHowToQuestionValidator()
    {
        RuleFor(x => x.Question)
            .NotEmpty().WithMessage("Question is required.")
            .Must(q => !string.IsNullOrWhiteSpace(q)).WithMessage("Question cannot be empty or whitespace.")
            .MaximumLength(MaxQuestionLength).WithMessage($"Question must not exceed {MaxQuestionLength} characters.");

        RuleFor(x => x.Language)
            .Must(lang => lang is null || lang == "ar" || lang == "en")
            .WithMessage("Language must be 'ar' or 'en'.")
            .When(x => x.Language is not null);
    }
}
