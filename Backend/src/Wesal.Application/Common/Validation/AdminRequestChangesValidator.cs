using FluentValidation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.Application.Common.Validation;

/// <summary>
/// WESAL Task 6 (requirement 6.5): request-changes notes are mandatory — the whole point
/// of the action is telling the photographer WHAT to edit — and must fit the conversation
/// message they are posted into.
/// </summary>
public class AdminRequestChangesValidator : AbstractValidator<AdminRequestChangesDto>
{
    public AdminRequestChangesValidator()
    {
        RuleFor(request => request.Notes)
            .NotEmpty()
            .WithMessage("Notes describing what must be edited are required.");

        RuleFor(request => request.Notes)
            .Must(notes => string.IsNullOrWhiteSpace(notes)
                || (notes?.Trim().Length ?? 0) <= AccountRequestReviewLimits.MaximumNotesLength)
            .WithMessage(
                $"The notes cannot exceed {AccountRequestReviewLimits.MaximumNotesLength} characters.");
    }
}
