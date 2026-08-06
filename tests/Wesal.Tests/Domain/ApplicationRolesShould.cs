using Wesal.Domain.Constants;

namespace Wesal.Tests.Domain;

public class ApplicationRolesShould
{
    [Fact]
    public void ContainAllSrsRoles()
    {
        Assert.Contains(ApplicationRoles.Guest, ApplicationRoles.All);
        Assert.Contains(ApplicationRoles.RegisteredUser, ApplicationRoles.All);
        Assert.Contains(ApplicationRoles.HallOwner, ApplicationRoles.All);
        Assert.Contains(ApplicationRoles.Admin, ApplicationRoles.All);
        Assert.Equal(4, ApplicationRoles.All.Length);
    }

    [Theory]
    [InlineData("Guest", true)]
    [InlineData("RegisteredUser", true)]
    [InlineData("HallOwner", true)]
    [InlineData("Admin", true)]
    [InlineData("guest", true)]
    [InlineData("SuperAdmin", false)]
    [InlineData("", false)]
    public void ValidateRoleNames(string role, bool expected)
    {
        Assert.Equal(expected, ApplicationRoles.IsValid(role));
    }
}
