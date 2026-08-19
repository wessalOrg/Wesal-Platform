using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

public class CreateCommentRequestValidator : AbstractValidator<CreateCommentRequest>
{
    public const int MinLength = 3;
    public const int MaxLength = 1000;

    public CreateCommentRequestValidator()
    {
        RuleFor(request => request.HallId).NotEmpty();
        RuleFor(request => request.Body)
            .Cascade(CascadeMode.Stop)
            .NotEmpty()
            .WithMessage("Comment cannot be empty.")
            .Must(body => !string.IsNullOrWhiteSpace(body))
            .WithMessage("Comment cannot be empty.")
            .Must(body => body.Trim().Length >= MinLength)
            .WithMessage($"Comment must be at least {MinLength} characters.")
            .Must(body => body.Trim().Length <= MaxLength)
            .WithMessage($"Comment cannot exceed {MaxLength} characters.");
    }
}
