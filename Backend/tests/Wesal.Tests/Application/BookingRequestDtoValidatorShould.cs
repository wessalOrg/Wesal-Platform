using System.Globalization;
using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;

namespace Wesal.Tests.Application;

public class BookingRequestDtoValidatorShould
{
    [Theory]
    [InlineData("10:00:00", true)]
    [InlineData("10:00:30", false)]
    [InlineData("10:00:00.0000001", false)]
    [InlineData("10:30:00", false)]
    public async Task Validate_SlotStart_MustBeExactlyHourAligned(string time, bool expectedValid)
    {
        var start = TimeOnly.Parse(time, CultureInfo.InvariantCulture);
        var request = CreateRequest(slotStarts: [new TimeOnly(9, 0), start]);

        var result = await new HourlyBookingRequestDtoValidator().ValidateAsync(request);

        Assert.Equal(expectedValid, result.IsValid);
        if (!expectedValid)
        {
            Assert.Contains(result.Errors, error => error.PropertyName == "SlotStarts[1]");
        }
        Assert.Equal(start, request.SlotStarts[1]);
    }

    [Fact]
    public async Task Validate_ValidRequest_Passes()
    {
        var validator = new HourlyBookingRequestDtoValidator();

        var result = await validator.ValidateAsync(CreateRequest());

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_MissingHallId_Fails()
    {
        var validator = new HourlyBookingRequestDtoValidator();

        var result = await validator.ValidateAsync(CreateRequest(hallId: Guid.Empty));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_DefaultDate_Fails()
    {
        var validator = new HourlyBookingRequestDtoValidator();

        var result = await validator.ValidateAsync(CreateRequest(defaultDate: true));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_MissingNameOnBooking_Fails()
    {
        var validator = new HourlyBookingRequestDtoValidator();

        var result = await validator.ValidateAsync(CreateRequest(nameOnBooking: string.Empty));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(HourlyBookingRequestDto.NameOnBooking));
    }

    [Fact]
    public async Task Validate_MissingRequesterName_Fails()
    {
        var validator = new HourlyBookingRequestDtoValidator();

        var result = await validator.ValidateAsync(CreateRequest(requesterName: string.Empty));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(HourlyBookingRequestDto.RequesterName));
    }

    [Theory]
    [InlineData(101)]
    [InlineData(200)]
    public async Task Validate_OverlongName_Fails(int length)
    {
        var validator = new HourlyBookingRequestDtoValidator();

        var result = await validator.ValidateAsync(CreateRequest(
            nameOnBooking: new string('a', length),
            requesterName: new string('b', length)));

        Assert.False(result.IsValid);
    }

    private static HourlyBookingRequestDto CreateRequest(
        Guid? hallId = null,
        DateOnly? date = null,
        string nameOnBooking = "Layla Hassan",
        string requesterName = "Layla Hassan",
        bool defaultDate = false,
        IReadOnlyList<TimeOnly>? slotStarts = null)
        => new()
        {
            HallId = hallId ?? Guid.NewGuid(),
            Date = defaultDate ? default : date ?? new DateOnly(2026, 9, 10),
            SlotStarts = slotStarts ?? [new TimeOnly(10, 0)],
            NameOnBooking = nameOnBooking,
            RequesterName = requesterName
        };
}
