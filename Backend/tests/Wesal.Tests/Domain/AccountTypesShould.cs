using Wesal.Domain.Constants;

namespace Wesal.Tests.Domain;

public class AccountTypesShould
{
    [Fact]
    public void ContainAllSupportedAccountTypes()
    {
        Assert.Contains(AccountTypes.RegularUser, AccountTypes.All);
        Assert.Contains(AccountTypes.HallOwner, AccountTypes.All);
        Assert.Contains(AccountTypes.EventCoordinator, AccountTypes.All);
        Assert.Contains(AccountTypes.Photographer, AccountTypes.All);
        Assert.Equal(4, AccountTypes.All.Length);
    }

    [Theory]
    [InlineData("RegularUser", true)]
    [InlineData("HallOwner", true)]
    [InlineData("EventCoordinator", true)]
    [InlineData("Photographer", true)]
    [InlineData("regularuser", true)]
    [InlineData("HALLOWNER", true)]
    [InlineData("eventcoordinator", true)]
    [InlineData("PHOTOGRAPHER", true)]
    [InlineData("Admin", false)]
    [InlineData("Guest", false)]
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
    [InlineData("EventCoordinator", ApplicationRoles.EventCoordinator)]
    [InlineData("eventcoordinator", ApplicationRoles.EventCoordinator)]
    [InlineData("Photographer", ApplicationRoles.Photographer)]
    [InlineData("photographer", ApplicationRoles.Photographer)]
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
    [InlineData("EventCoordinator")]
    [InlineData("eventcoordinator")]
    [InlineData("EVENTCOORDINATOR")]
    public void Normalize_ReturnsCanonicalEventCoordinatorSpelling(string accountType)
    {
        Assert.Equal(AccountTypes.EventCoordinator, AccountTypes.Normalize(accountType));
    }

    [Theory]
    [InlineData("Photographer")]
    [InlineData("photographer")]
    [InlineData("PHOTOGRAPHER")]
    public void Normalize_ReturnsCanonicalPhotographerSpelling(string accountType)
    {
        Assert.Equal(AccountTypes.Photographer, AccountTypes.Normalize(accountType));
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

    [Theory]
    [InlineData(ApplicationRoles.RegisteredUser, AccountTypes.RegularUser)]
    [InlineData(ApplicationRoles.HallOwner, AccountTypes.HallOwner)]
    [InlineData(ApplicationRoles.EventCoordinator, AccountTypes.EventCoordinator)]
    [InlineData(ApplicationRoles.Photographer, AccountTypes.Photographer)]
    [InlineData("registereduser", AccountTypes.RegularUser)]
    [InlineData("HALLOWNER", AccountTypes.HallOwner)]
    [InlineData("eventcoordinator", AccountTypes.EventCoordinator)]
    [InlineData("photographer", AccountTypes.Photographer)]
    public void FromRole_MapsAccountRoleToAccountType(string role, string expectedAccountType)
    {
        Assert.Equal(expectedAccountType, AccountTypes.FromRole(role));
    }

    [Theory]
    [InlineData("Admin")]
    [InlineData("Guest")]
    [InlineData("")]
    [InlineData(null)]
    public void FromRole_ReturnsNullForNonAccountRoles(string? role)
    {
        Assert.Null(AccountTypes.FromRole(role));
    }

    [Fact]
    public void FromRole_IsInverseOfToRoleForBothAccountTypes()
    {
        foreach (var accountType in AccountTypes.All)
        {
            Assert.Equal(accountType, AccountTypes.FromRole(AccountTypes.ToRole(accountType)));
        }
    }

    [Theory]
    [InlineData(AccountTypes.EventCoordinator, true)]
    [InlineData(AccountTypes.Photographer, true)]
    [InlineData("eventcoordinator", true)]
    [InlineData("photographer", true)]
    [InlineData(AccountTypes.RegularUser, false)]
    [InlineData(AccountTypes.HallOwner, false)]
    [InlineData("Admin", false)]
    [InlineData(null, false)]
    public void RequiresRoleSetup_OnlyForCoordinatorAndPhotographer(string? accountType, bool expected)
    {
        Assert.Equal(expected, AccountTypes.RequiresRoleSetup(accountType));
    }
}