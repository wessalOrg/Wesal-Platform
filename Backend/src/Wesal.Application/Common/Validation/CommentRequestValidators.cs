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
    }
}

/// <summary>
/// Validates an author-owned comment edit (Edit 22). The content rules are identical
/// to creation by construction: both validators share
/// <see cref="CreateCommentRequestValidator.MaxContentLength"/> and the same messages,
/// so an edit can never accept content that creation would reject.
/// </summary>
public class UpdateCommentRequestValidator : AbstractValidator<UpdateCommentRequest>
{
    public UpdateCommentRequestValidator()
    {
        RuleFor(request => request.Content)
            .NotEmpty()
            .WithMessage("Comment content cannot be empty.");

        RuleFor(request => request.Content)
            .MaximumLength(CreateCommentRequestValidator.MaxContentLength)
            .WithMessage($"Comment content cannot exceed {CreateCommentRequestValidator.MaxContentLength} characters.");
    }
}
