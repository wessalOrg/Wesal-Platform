using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

public sealed class ExternalBookingRequestValidator : AbstractValidator<ExternalBookingRequest>
{
    public ExternalBookingRequestValidator()
    {
        RuleFor(x => x.CustomerName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(30).Matches(@"^[+\d\s()\-]{5,30}$");
        RuleFor(x => x.EventType).Must(x => new[] { "wedding", "engagement", "graduation", "birthday", "other" }.Contains(x));
        RuleFor(x => x.Notes).NotNull().MaximumLength(2000);
        RuleFor(x => x.Guests).InclusiveBetween(1, 100000).When(x => x.Guests.HasValue);
        RuleFor(x => x.SlotStarts).NotNull().NotEmpty().Must(x => x is not null && x.Count <= 23);
        RuleForEach(x => x.SlotStarts).Must(x => x.Ticks % TimeSpan.TicksPerHour == 0);
        RuleFor(x => x.TotalAmount).InclusiveBetween(0m, 9999999999.99m).PrecisionScale(12, 2, true).When(x => x.TotalAmount.HasValue);
        RuleFor(x => x.AmountReceivedExternally).InclusiveBetween(0m, 9999999999.99m).PrecisionScale(12, 2, true).When(x => x.AmountReceivedExternally.HasValue);
        RuleFor(x => x).Must(x => !x.TotalAmount.HasValue || !x.AmountReceivedExternally.HasValue || x.AmountReceivedExternally <= x.TotalAmount)
            .WithMessage("Amount received cannot exceed the total amount.");
    }
}
