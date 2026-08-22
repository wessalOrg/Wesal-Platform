using FluentValidation;

namespace Wesal.Application.Common.Validation;

public sealed class InitializeAiSessionRequestValidator : AbstractValidator<Models.InitializeAiSessionRequest>
{
    public InitializeAiSessionRequestValidator()
    {
        RuleFor(x => x.Language)
            .Must(lang => lang is null || lang == "ar" || lang == "en")
            .WithMessage("Language must be 'ar' or 'en'.");
    }
}
