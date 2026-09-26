using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Constants;

namespace Wesal.Tests.Application;

/// <summary>
/// WESAL-TASK-8 (Edit 8): approval is no longer a bare "yes" - it names the deposit the owner
/// is asking for, so the amount is validated. The bounds matter because a zero deposit would
/// make the later payment step meaningless, and an absurd one would let a typo look like a
/// real quote to the requester.
/// </summary>
public class AcceptBookingRequestDtoValidatorShould
{
    [Fact]
    public async Task Validate_MinimumDeposit_Passes()
    {
        var validator = new AcceptBookingRequestDtoValidator();

        var result = await validator.ValidateAsync(Request(BookingDeposits.MinimumAmount));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_MaximumDeposit_Passes()
    {
        var validator = new AcceptBookingRequestDtoValidator();

        var result = await validator.ValidateAsync(Request(BookingDeposits.MaximumAmount));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_TypicalDeposit_Passes()
    {
        var validator = new AcceptBookingRequestDtoValidator();

        var result = await validator.ValidateAsync(Request(500m));

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(0.009)]
    [InlineData(1000000.01)]
    [InlineData(2500000)]
    public async Task Validate_DepositOutsideAllowedRange_Fails(decimal depositAmount)
    {
        var validator = new AcceptBookingRequestDtoValidator();

        var result = await validator.ValidateAsync(Request(depositAmount));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(AcceptBookingRequestDto.DepositAmount));
    }

    [Fact]
    public async Task Validate_MissingDeposit_Fails()
    {
        // The body is required now, so a request that never states an amount cannot slip
        // through as an approval with no deposit attached.
        var validator = new AcceptBookingRequestDtoValidator();

        var result = await validator.ValidateAsync(new AcceptBookingRequestDto());

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(AcceptBookingRequestDto.DepositAmount));
    }

    private static AcceptBookingRequestDto Request(decimal depositAmount)
        => new() { DepositAmount = depositAmount };
}
