using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Constants;

namespace Wesal.Tests.Application;

/// <summary>
/// WESAL-TASK-12 (Edit 12): rejecting a booking is an explanation, so the reason has to exist
/// and has to fit. The length bound is the important half: the reason is embedded in a
/// localized sentence that is persisted as a conversation message, and both that column and
/// the reason's own column cap at 1000 characters. Leaving the bound to a soft client-side
/// <c>maxlength</c> meant a direct API caller could still overflow the message column, which
/// surfaced as an unhandled database error after the rejection had already been applied.
/// </summary>
public class RejectBookingRequestDtoValidatorShould
{
    [Fact]
    public async Task Validate_TypicalReason_Passes()
    {
        var validator = new RejectBookingRequestDtoValidator();

        var result = await validator.ValidateAsync(Request("Not available on that date"));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_ReasonAtTheLimit_Passes()
    {
        var validator = new RejectBookingRequestDtoValidator();

        var result = await validator.ValidateAsync(Request(new string('a', BookingRejectionReasons.MaximumLength)));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_ReasonOverTheLimit_Fails()
    {
        var validator = new RejectBookingRequestDtoValidator();

        var result = await validator.ValidateAsync(Request(new string('a', BookingRejectionReasons.MaximumLength + 1)));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RejectBookingRequestDto.Reason));
        Assert.Contains(
            result.Errors.Select(error => error.ErrorMessage),
            message => message.Contains(
                $"{BookingRejectionReasons.MaximumLength}",
                StringComparison.Ordinal));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Validate_MissingReason_Fails(string? reason)
    {
        // A rejection with no explanation is the case this whole edit exists to prevent.
        var validator = new RejectBookingRequestDtoValidator();

        var result = await validator.ValidateAsync(new RejectBookingRequestDto { Reason = reason! });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RejectBookingRequestDto.Reason));
    }

    [Fact]
    public async Task Validate_LimitLeavesRoomForTheLocalizedWrapper()
    {
        // Guards the reason the limit is 500 and not 1000: the reason is only ever stored
        // inside a longer sentence, so it must not be able to fill the message column alone.
        var validator = new RejectBookingRequestDtoValidator();

        var result = await validator.ValidateAsync(Request(new string('a', BookingRejectionReasons.MaximumLength)));

        Assert.True(result.IsValid);
        Assert.True(BookingRejectionReasons.MaximumLength < 1000);
    }

    [Fact]
    public async Task Validate_ReasonAtTheLimitWithPadding_Passes()
    {
        // The bound is measured after trimming, matching the service, so padding cannot turn a
        // valid reason into a rejection at the API boundary.
        var validator = new RejectBookingRequestDtoValidator();
        var reason = new string('a', BookingRejectionReasons.MaximumLength);

        var result = await validator.ValidateAsync(Request($"   {reason}   "));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_ReasonOverTheLimitWithPadding_Fails()
    {
        // ...and padding cannot smuggle extra content past the bound either.
        var validator = new RejectBookingRequestDtoValidator();
        var reason = new string('a', BookingRejectionReasons.MaximumLength + 1);

        var result = await validator.ValidateAsync(Request($"   {reason}   "));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RejectBookingRequestDto.Reason));
    }

    private static RejectBookingRequestDto Request(string reason)
        => new() { Reason = reason };
}
