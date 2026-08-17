using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

public class CreateCommentRequestValidator : AbstractValidator<CreateCommentRequest>
{
    public const int MaxContentLength = 1000;

    public CreateCommentRequestValidator()
    {
        RuleFor(request => request.HallId)
            .NotEmpty();

        RuleFor(request => request.Content)
            .NotEmpty()
            .WithMessage("Comment content cannot be empty.");

        RuleFor(request => request.Content)
            .MaximumLength(MaxContentLength)
            .WithMessage($"Comment content cannot exceed {MaxContentLength} characters.");

        RuleFor(request => request.Content)
            .Must(content => !string.IsNullOrWhiteSpace(content))
            .WithMessage("Comment content cannot be whitespace only.");
    }
}
