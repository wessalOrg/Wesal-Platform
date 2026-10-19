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
        Assert.Contains(ApplicationRoles.EventCoordinator, ApplicationRoles.All);
        Assert.Contains(ApplicationRoles.Photographer, ApplicationRoles.All);
        Assert.Equal(6, ApplicationRoles.All.Length);
    }

    [Theory]
    [InlineData("Guest", true)]
    [InlineData("RegisteredUser", true)]
    [InlineData("HallOwner", true)]
    [InlineData("Admin", true)]
    [InlineData("EventCoordinator", true)]
    [InlineData("Photographer", true)]
    [InlineData("eventcoordinator", true)]
    [InlineData("PHOTOGRAPHER", true)]
    [InlineData("guest", true)]
    [InlineData("SuperAdmin", false)]
    [InlineData("", false)]
    public void ValidateRoleNames(string role, bool expected)
    {
        Assert.Equal(expected, ApplicationRoles.IsValid(role));
    }
}
