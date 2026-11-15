using FluentValidation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Validation;

public sealed class EventRequestCreateRequestValidator : AbstractValidator<EventRequestCreateRequest>
{
    public EventRequestCreateRequestValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().Must(x => !string.IsNullOrWhiteSpace(x?.Trim())).WithMessage("الاسم مطلوب.")
            .Must(x => x?.Trim().Length <= 120).WithMessage("الاسم طويل جداً.");
        RuleFor(x => x.EventDate).NotNull().Must(x => x >= DateOnly.FromDateTime(DateTime.UtcNow)).WithMessage("تاريخ المناسبة لا يمكن أن يكون في الماضي.");
        RuleFor(x => x.EventType).NotNull().IsInEnum();
        RuleFor(x => x.NeedsHall).NotNull(); RuleFor(x => x.NeedsDecorationAndGifts).NotNull(); RuleFor(x => x.NeedsPhotographers).NotNull();
        RuleFor(x => x).Must(x => x.NeedsHall == true || x.NeedsDecorationAndGifts == true || x.NeedsPhotographers == true)
            .WithMessage("اختر خدمة واحدة على الأقل.");
    }
}
