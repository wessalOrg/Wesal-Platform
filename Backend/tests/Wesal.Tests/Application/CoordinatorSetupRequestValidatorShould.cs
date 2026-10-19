using FluentValidation.TestHelper;
using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Enums;

namespace Wesal.Tests.Application;

public class CoordinatorSetupRequestValidatorShould
{
    private readonly CoordinatorSetupRequestValidator _validator = new();

    private static CoordinatorSetupRequest ShopRequest(
        string shopName = "Gift Shop",
        string shopLocation = "Ramallah, Main Street",
        string phoneNumber = "+970599111111")
        => new()
        {
            BusinessType = CoordinatorBusinessType.Shop,
            ShopName = shopName,
            ShopLocation = shopLocation,
            PhoneNumber = phoneNumber
        };

    private static CoordinatorSetupRequest FreelanceRequest(
        string onlineStoreName = "Online Store",
        string phoneNumber = "+970599111111")
        => new()
        {
            BusinessType = CoordinatorBusinessType.Freelance,
            OnlineStoreName = onlineStoreName,
            PhoneNumber = phoneNumber
        };

    [Fact]
    public void ValidShopSubmission_Passes()
    {
        var result = _validator.Validate(ShopRequest());
        Assert.True(result.IsValid);
    }

    [Fact]
    public void ValidFreelanceSubmission_Passes()
    {
        var result = _validator.Validate(FreelanceRequest());
        Assert.True(result.IsValid);
    }

    [Fact]
    public void MissingBusinessType_Fails()
    {
        var result = _validator.Validate(new CoordinatorSetupRequest
        {
            BusinessType = null,
            PhoneNumber = "+970599111111"
        });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CoordinatorSetupRequest.BusinessType));
    }

    [Fact]
    public void BusinessType_OutOfEnumRange_Fails()
    {
        var result = _validator.Validate(new CoordinatorSetupRequest
        {
            BusinessType = (CoordinatorBusinessType)99,
            PhoneNumber = "+970599111111"
        });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CoordinatorSetupRequest.BusinessType));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void ShopSubmission_MissingShopName_Fails(string shopName)
    {
        var result = _validator.Validate(ShopRequest(shopName: shopName));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CoordinatorSetupRequest.ShopName));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void ShopSubmission_MissingShopLocation_Fails(string shopLocation)
    {
        var result = _validator.Validate(ShopRequest(shopLocation: shopLocation));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CoordinatorSetupRequest.ShopLocation));
    }

    [Fact]
    public void ShopSubmission_ShopNameOverMaxLength_Fails()
    {
        var result = _validator.Validate(ShopRequest(shopName: new string('a', CoordinatorSetupRequestValidator.MaxShopNameLength + 1)));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CoordinatorSetupRequest.ShopName));
    }

    [Fact]
    public void ShopSubmission_ShopLocationOverMaxLength_Fails()
    {
        var result = _validator.Validate(ShopRequest(shopLocation: new string('a', CoordinatorSetupRequestValidator.MaxShopLocationLength + 1)));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CoordinatorSetupRequest.ShopLocation));
    }

    [Fact]
    public void FreelanceSubmission_MissingOnlineStoreName_Fails()
    {
        var result = _validator.Validate(FreelanceRequest(onlineStoreName: ""));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CoordinatorSetupRequest.OnlineStoreName));
    }

    [Fact]
    public void FreelanceSubmission_OnlineStoreNameOverMaxLength_Fails()
    {
        var result = _validator.Validate(FreelanceRequest(onlineStoreName: new string('a', CoordinatorSetupRequestValidator.MaxOnlineStoreNameLength + 1)));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CoordinatorSetupRequest.OnlineStoreName));
    }

    [Fact]
    public void ShopSubmission_DoesNotRequireOnlineStoreName()
    {
        var result = _validator.Validate(ShopRequest());

        Assert.DoesNotContain(result.Errors, e => e.PropertyName == nameof(CoordinatorSetupRequest.OnlineStoreName));
    }

    [Fact]
    public void FreelanceSubmission_DoesNotRequireShopFields()
    {
        var result = _validator.Validate(FreelanceRequest());

        Assert.DoesNotContain(result.Errors, e => e.PropertyName == nameof(CoordinatorSetupRequest.ShopName));
        Assert.DoesNotContain(result.Errors, e => e.PropertyName == nameof(CoordinatorSetupRequest.ShopLocation));
    }

    [Fact]
    public void MissingPhoneNumber_Fails()
    {
        var result = _validator.Validate(ShopRequest(phoneNumber: ""));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CoordinatorSetupRequest.PhoneNumber));
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("+9705")]
    [InlineData("+97059x111111")]
    [InlineData(" ")]
    public void InvalidPhoneNumber_Fails(string phoneNumber)
    {
        var result = _validator.Validate(ShopRequest(phoneNumber: phoneNumber));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CoordinatorSetupRequest.PhoneNumber));
    }

    [Theory]
    [InlineData("+970599111111")]
    [InlineData("0599111111")]
    [InlineData("+966 55 123 4567")]
    public void ValidPhoneNumber_Passes(string phoneNumber)
    {
        var result = _validator.Validate(ShopRequest(phoneNumber: phoneNumber));

        Assert.True(result.IsValid, string.Join("; ", result.Errors.Select(e => e.ErrorMessage)));
    }

    [Fact]
    public void PhoneNumberOverMaxLength_Fails()
    {
        var result = _validator.Validate(ShopRequest(phoneNumber: "+123456789012345678901"));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CoordinatorSetupRequest.PhoneNumber));
    }
}
