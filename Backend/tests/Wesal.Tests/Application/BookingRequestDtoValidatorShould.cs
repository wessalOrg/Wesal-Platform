using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Enums;

namespace Wesal.Tests.Application;

public class BookingRequestDtoValidatorShould
{
    [Fact]
    public async Task Validate_ValidRequest_Passes()
    {
        var validator = new BookingRequestDtoValidator();

        var result = await validator.ValidateAsync(CreateRequest());

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_MissingHallId_Fails()
    {
        var validator = new BookingRequestDtoValidator();

        var result = await validator.ValidateAsync(CreateRequest(hallId: Guid.Empty));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_DefaultDate_Fails()
    {
        var validator = new BookingRequestDtoValidator();
        var request = new BookingRequestDto
        {
            HallId = Guid.NewGuid(),
            Date = default,
            Periods = [BookingPeriodType.FirstPeriod]
        };

        var result = await validator.ValidateAsync(request);

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_EmptyPeriods_Fails()
    {
        var validator = new BookingRequestDtoValidator();

        var result = await validator.ValidateAsync(CreateRequest(periods: []));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_DuplicatePeriods_Fails()
    {
        var validator = new BookingRequestDtoValidator();

        var result = await validator.ValidateAsync(
            CreateRequest(periods: [BookingPeriodType.FirstPeriod, BookingPeriodType.FirstPeriod]));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_InvalidPeriod_Fails()
    {
        var validator = new BookingRequestDtoValidator();

        var result = await validator.ValidateAsync(CreateRequest(periods: [(BookingPeriodType)99]));

        Assert.False(result.IsValid);
    }

    private static BookingRequestDto CreateRequest(
        Guid? hallId = null,
        DateOnly? date = null,
        IReadOnlyList<BookingPeriodType>? periods = null)
        => new()
        {
            HallId = hallId ?? Guid.NewGuid(),
            Date = date ?? new DateOnly(2026, 9, 10),
            Periods = periods ?? [BookingPeriodType.FirstPeriod, BookingPeriodType.SecondPeriod]
        };
}
