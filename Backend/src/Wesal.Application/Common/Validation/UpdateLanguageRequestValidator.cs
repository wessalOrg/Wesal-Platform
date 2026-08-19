using FluentValidation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.Application.Common.Validation;

public class UpdateLanguageRequestValidator : AbstractValidator<UpdateLanguageRequest>
{
    public UpdateLanguageRequestValidator()
    {
        RuleFor(request => request.Language)
            .NotEmpty()
            .WithMessage("Language code is required. Supported languages are 'ar' and 'en'.");

        RuleFor(request => request.Language)
            .Must(SupportedLanguages.IsSupported)
            .WithMessage("Unsupported language code. Supported languages are 'ar' and 'en'.");
    }
}