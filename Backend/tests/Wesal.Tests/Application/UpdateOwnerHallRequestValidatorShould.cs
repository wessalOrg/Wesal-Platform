using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Enums;

namespace Wesal.Tests.Application;

public class UpdateOwnerHallRequestValidatorShould
{
    private static readonly TimeOnly MorningStart = new(9, 0);
    private static readonly TimeOnly MorningEnd = new(15, 0);
    private static readonly TimeOnly EveningStart = new(16, 0);
    private static readonly TimeOnly EveningEnd = new(23, 0);

    private readonly UpdateOwnerHallRequestValidator _validator = new();

    private static UpdateOwnerHallRequest CreateRequest(
        string name = "Grand Hall",
        string address = "Al-Rashid Street, Gaza",
        HallRegion region = HallRegion.Gaza,
        int capacity = 200,
        decimal? price = 1500,
        bool showPrice = true,
        IReadOnlyList<UpdateOwnerHallPhotoDto>? photos = null,
        IReadOnlyList<UpdateOwnerHallBookingPeriodDto>? periods = null)
        => new()
        {
            Name = name,
            Address = address,
            Region = region,
            Capacity = capacity,
            Price = price,
            ShowPrice = showPrice,
            Photos = photos ??
            [
                new UpdateOwnerHallPhotoDto { Url = "https://cdn.example.com/hall-1.jpg", DisplayOrder = 0 },
                new UpdateOwnerHallPhotoDto { Url = "https://cdn.example.com/hall-2.jpg", DisplayOrder = 1 }
            ],
            BookingPeriods = periods ??
            [
                new UpdateOwnerHallBookingPeriodDto { Type = BookingPeriodType.FirstPeriod, StartTime = MorningStart, EndTime = MorningEnd },
                new UpdateOwnerHallBookingPeriodDto { Type = BookingPeriodType.SecondPeriod, StartTime = EveningStart, EndTime = EveningEnd }
            ]
        };

    private static IReadOnlyList<UpdateOwnerHallPhotoDto> Photos(params (string Url, int Order)[] items)
        => items.Select(item => new UpdateOwnerHallPhotoDto { Url = item.Url, DisplayOrder = item.Order }).ToList();

    private static IReadOnlyList<UpdateOwnerHallBookingPeriodDto> Periods(params (BookingPeriodType Type, int StartHour, int EndHour)[] items)
        => items.Select(item => new UpdateOwnerHallBookingPeriodDto
        {
            Type = item.Type,
            StartTime = new TimeOnly(item.StartHour, 0),
            EndTime = new TimeOnly(item.EndHour, 0)
        }).ToList();

    [Fact]
    public async Task Validate_ValidRequest_Passes()
    {
        var result = await _validator.ValidateAsync(CreateRequest());

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_MissingName_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(name: string.Empty));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(UpdateOwnerHallRequest.Name));
    }

    [Fact]
    public async Task Validate_OverlongName_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(name: new string('a', 201)));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_MissingAddress_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(address: string.Empty));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(UpdateOwnerHallRequest.Address));
    }

    [Fact]
    public async Task Validate_ZeroCapacity_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(capacity: 0));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_NegativePrice_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(price: -5));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_ShowPriceWithoutPrice_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(price: null, showPrice: true));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == "Price");
    }

    [Fact]
    public async Task Validate_HiddenPriceWithoutPrice_Passes()
    {
        var result = await _validator.ValidateAsync(CreateRequest(price: null, showPrice: false));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_NoPhotos_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(photos: []));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(UpdateOwnerHallRequest.Photos));
    }

    [Fact]
    public async Task Validate_EmptyPhotoUrl_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(photos: Photos(("", 0))));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_DuplicatePhotoDisplayOrders_Fail()
    {
        var result = await _validator.ValidateAsync(
            CreateRequest(photos: Photos(("https://cdn.example.com/a.jpg", 0), ("https://cdn.example.com/b.jpg", 0))));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_MissingDailyPeriods_Fails()
    {
        var result = await _validator.ValidateAsync(
            CreateRequest(periods: Periods((BookingPeriodType.FirstPeriod, 9, 15))));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(UpdateOwnerHallRequest.BookingPeriods));
    }

    [Fact]
    public async Task Validate_DuplicateDailyPeriods_Fail()
    {
        var result = await _validator.ValidateAsync(
            CreateRequest(periods: Periods((BookingPeriodType.FirstPeriod, 9, 15), (BookingPeriodType.FirstPeriod, 9, 15))));

        Assert.False(result.IsValid);
    }

    [Theory]
    [InlineData(0, 0)]
    [InlineData(15, 9)]
    [InlineData(23, 23)]
    public async Task Validate_PeriodEndNotStrictlyAfterStart_Fails(int startHour, int endHour)
    {
        var result = await _validator.ValidateAsync(
            CreateRequest(periods: Periods(
                (BookingPeriodType.FirstPeriod, startHour, endHour),
                (BookingPeriodType.SecondPeriod, 16, 23))));

        Assert.False(result.IsValid);
        var periodError = Assert.Single(result.Errors, error => error.PropertyName.Contains("EndTime"));
        Assert.Contains("later than", periodError.ErrorMessage, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Validate_PeriodEndAfterStart_Passes()
    {
        var result = await _validator.ValidateAsync(
            CreateRequest(periods: Periods(
                (BookingPeriodType.FirstPeriod, 9, 15),
                (BookingPeriodType.SecondPeriod, 16, 23))));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_UnknownRegion_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(region: (HallRegion)99));

        Assert.False(result.IsValid);
    }
}