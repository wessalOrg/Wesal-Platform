using Wesal.Domain.Constants;

namespace Wesal.Tests.Domain;

public class AccountTypesShould
{
    [Fact]
    public void ContainBothSupportedAccountTypes()
    {
        Assert.Contains(AccountTypes.RegularUser, AccountTypes.All);
        Assert.Contains(AccountTypes.HallOwner, AccountTypes.All);
        Assert.Equal(2, AccountTypes.All.Length);
    }

    [Theory]
    [InlineData("RegularUser", true)]
    [InlineData("HallOwner", true)]
    [InlineData("regularuser", true)]
    [InlineData("HALLOWNER", true)]
    [InlineData("Admin", false)]
    [InlineData("Hall User", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void ValidateAccountTypes(string? accountType, bool expected)
    {
        Assert.Equal(expected, AccountTypes.IsValid(accountType));
    }

    [Theory]
    [InlineData("RegularUser", ApplicationRoles.RegisteredUser)]
    [InlineData("regularuser", ApplicationRoles.RegisteredUser)]
    [InlineData("HallOwner", ApplicationRoles.HallOwner)]
    [InlineData("hallowner", ApplicationRoles.HallOwner)]
    public void MapValidAccountTypeToExistingRole(string accountType, string expectedRole)
    {
        Assert.Equal(expectedRole, AccountTypes.ToRole(accountType));
    }

    [Theory]
    [InlineData("RegularUser")]
    [InlineData("regularuser")]
    [InlineData("REGULARUSER")]
    public void Normalize_ReturnsCanonicalRegularUserSpelling(string accountType)
    {
        Assert.Equal(AccountTypes.RegularUser, AccountTypes.Normalize(accountType));
    }

    [Theory]
    [InlineData("HallOwner")]
    [InlineData("hallowner")]
    [InlineData("HALLOWNER")]
    public void Normalize_ReturnsCanonicalHallOwnerSpelling(string accountType)
    {
        Assert.Equal(AccountTypes.HallOwner, AccountTypes.Normalize(accountType));
    }

    [Theory]
    [InlineData("Admin")]
    [InlineData("")]
    [InlineData(null)]
    public void ToRole_ThrowsForInvalidAccountType(string? accountType)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => AccountTypes.ToRole(accountType));
    }

    [Fact]
    public void Normalize_ThrowsForNullAccountType()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => AccountTypes.Normalize(null));
    }
}