using FluentValidation;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Validation;

/// <summary>
/// Validates an owner's hourly-slot settings change (WESAL-TASK-1). Only the window
/// needs field validation: the day gate carries a single date the service validates
/// against "today", and ShowBookedSlots is a plain display toggle with no constraints.
/// A null property means "leave unchanged", so cross-field window rules are enforced
/// against the *effective* (merged) values in the service, where the current persisted
/// window is known.
/// </summary>
public class UpdateOwnerHourlySettingsRequestValidator : AbstractValidator<UpdateOwnerHourlySettingsRequest>
{
    public UpdateOwnerHourlySettingsRequestValidator()
    {
        RuleFor(request => request)
            .Must(request => request.ShowBookedSlots.HasValue
                || request.HourlySlotStart.HasValue
                || request.HourlySlotEnd.HasValue)
            .WithMessage("Provide at least one of ShowBookedSlots, HourlySlotStart or HourlySlotEnd.");

        // A sane bookable day: slots may only be offered between 00:00 and 23:59, and
        // the window must be a whole number of 60-minute slots. The start < end rule is
        // checked in the service against the effective merged window.
        RuleFor(request => request.HourlySlotStart)
            .Must(BeWholeHour)
            .When(request => request.HourlySlotStart.HasValue)
            .WithMessage("HourlySlotStart must start on the hour (minutes == 00).");

        RuleFor(request => request.HourlySlotEnd)
            .Must(BeWholeHour)
            .When(request => request.HourlySlotEnd.HasValue)
            .WithMessage("HourlySlotEnd must start on the hour (minutes == 00).");
    }

    private static bool BeWholeHour(TimeOnly? time)
        => time is null || (time.Value.Minute == 0 && time.Value.Second == 0);
}
