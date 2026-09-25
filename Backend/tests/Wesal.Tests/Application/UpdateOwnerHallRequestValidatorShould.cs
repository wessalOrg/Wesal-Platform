using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Enums;

namespace Wesal.Tests.Application;

public class UpdateOwnerHallRequestValidatorShould
{
    private readonly UpdateOwnerHallRequestValidator _validator = new();

    private static UpdateOwnerHallRequest CreateRequest(
        string name = "Grand Hall",
        string address = "حي الشجاعية",
        HallRegion region = HallRegion.Gaza,
        int capacity = 200,
        decimal? price = 1500,
        bool showPrice = true,
        string? detailedAddress = null,
        string? youtubeUrl = null,
        IReadOnlyList<string>? features = null,
        string? otherFeatures = null,
        IReadOnlyList<UpdateOwnerHallPhotoDto>? photos = null)
        => new()
        {
            Name = name,
            Address = address,
            Region = region,
            Capacity = capacity,
            Price = price,
            ShowPrice = showPrice,
            DetailedAddress = detailedAddress,
            YouTubeVideoUrl = youtubeUrl,
            Features = features ?? [],
            OtherFeatures = otherFeatures,
            Photos = photos ??
            [
                new UpdateOwnerHallPhotoDto { Url = "https://cdn.example.com/hall-1.jpg", DisplayOrder = 0 },
                new UpdateOwnerHallPhotoDto { Url = "https://cdn.example.com/hall-2.jpg", DisplayOrder = 1 }
            ]
        };

    private static IReadOnlyList<UpdateOwnerHallPhotoDto> Photos(params (string Url, int Order)[] items)
        => items.Select(item => new UpdateOwnerHallPhotoDto { Url = item.Url, DisplayOrder = item.Order }).ToList();

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
    public async Task Validate_UnknownRegion_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(region: (HallRegion)99));

        Assert.False(result.IsValid);
    }

    // --- US-HALL: dependent Region -> Address selection (WESAL-TASK-2 field-role swap) ---
    //
    // Before the swap the list-backed field was DetailedAddress and Address was free
    // text. These tests pin the swapped roles in both directions: the exact inputs that
    // were legal under the old mapping are now rejected, and the inputs that were
    // rejected under the old mapping are now accepted.

    [Fact]
    public async Task Validate_AddressOutsideRegion_Fails()
    {
        var result = await _validator.ValidateAsync(
            CreateRequest(region: HallRegion.Gaza, address: "جباليا")); // North Gaza area

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(UpdateOwnerHallRequest.Address));
    }

    [Fact]
    public async Task Validate_AddressInsideRegion_Passes()
    {
        var result = await _validator.ValidateAsync(
            CreateRequest(region: HallRegion.Gaza, address: "حي الرمال"));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_AddressFreeText_Fails()
    {
        // This exact value was valid before the swap, when Address was free text.
        var result = await _validator.ValidateAsync(
            CreateRequest(region: HallRegion.Gaza, address: "Al-Rashid Street, Gaza"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(UpdateOwnerHallRequest.Address));
    }

    [Fact]
    public async Task Validate_AddressEmpty_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(address: string.Empty));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(UpdateOwnerHallRequest.Address));
    }

    [Fact]
    public async Task Validate_AddressTooLong_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(address: new string('x', 101)));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(UpdateOwnerHallRequest.Address));
    }

    [Fact]
    public async Task Validate_AddressFromAnotherRegionList_Fails()
    {
        // The list is region-dependent: a Gaza value is illegal for a North Gaza hall.
        var result = await _validator.ValidateAsync(
            CreateRequest(region: HallRegion.NorthGaza, address: "حي الرمال"));

        Assert.False(result.IsValid);
    }

    [Theory]
    [InlineData("جباليا")]                                              // a North Gaza list value
    [InlineData("Al-Rashid Street, Gaza")]                              // arbitrary free text
    [InlineData("مول الرحاب، شارع ٨، بجوار مسجد النور")]                  // free text with a landmark
    public async Task Validate_DetailedAddressAnyText_Passes(string detailedAddress)
    {
        // DetailedAddress is now the owner's own free-text detail. Every one of these
        // used to be validated against the region's list; the first one was outright
        // rejected before the swap.
        var result = await _validator.ValidateAsync(
            CreateRequest(region: HallRegion.Gaza, detailedAddress: detailedAddress));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_DetailedAddressEmpty_Passes()
    {
        var result = await _validator.ValidateAsync(CreateRequest(detailedAddress: null));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_DetailedAddressTooLong_Fails()
    {
        var result = await _validator.ValidateAsync(CreateRequest(detailedAddress: new string('x', 151)));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(UpdateOwnerHallRequest.DetailedAddress));
    }

    // --- US-HALL: YouTube link + feature catalog ---

    [Fact]
    public async Task Validate_InvalidYouTubeUrl_Fails()
    {
        var result = await _validator.ValidateAsync(
            CreateRequest(youtubeUrl: "https://example.com/not-youtube"));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_ValidYouTubeUrl_Passes()
    {
        var result = await _validator.ValidateAsync(
            CreateRequest(youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_FeatureOutsideCatalog_Fails()
    {
        var result = await _validator.ValidateAsync(
            CreateRequest(features: new[] { "مطبخ مجهز" }));

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Validate_FeatureInsideCatalog_Passes()
    {
        var result = await _validator.ValidateAsync(
            CreateRequest(features: new[] { "مولد كهرباء", "تكييف" }));

        Assert.True(result.IsValid);
    }
}