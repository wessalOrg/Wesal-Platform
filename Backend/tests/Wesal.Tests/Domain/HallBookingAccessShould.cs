using Wesal.Domain.Common;
using Wesal.Domain.Constants;

namespace Wesal.Tests.Domain;

/// <summary>
/// The seeker/booking role rule is shared by the booking and cancellation services.
/// Approval status deliberately plays no part: a Pending, Rejected, or Needs Changes
/// Event Coordinator or Photographer is still a seeker for hall browsing and booking.
/// </summary>
public class HallBookingAccessShould
{
    [Theory]
    [InlineData(ApplicationRoles.RegisteredUser)]
    [InlineData(ApplicationRoles.EventCoordinator)]
    [InlineData(ApplicationRoles.Photographer)]
    public void AllowEverySeekerRoleRegardlessOfApproval(string role)
    {
        Assert.True(HallBookingAccess.IsSeeker([role]));
        Assert.True(HallBookingAccess.IsSeeker([role.ToUpperInvariant()]));
    }

    [Theory]
    [InlineData(ApplicationRoles.Guest)]
    [InlineData(ApplicationRoles.Admin)]
    [InlineData(ApplicationRoles.HallOwner)]
    [InlineData("UnknownRole")]
    public void RejectRolesThatAreNotSeekers(string role)
    {
        Assert.False(HallBookingAccess.IsSeeker([role]));
    }

    [Fact]
    public void RejectEmptyRoleList()
    {
        Assert.False(HallBookingAccess.IsSeeker([]));
    }

    [Fact]
    public void KeepHallOwnerPrecedenceEvenWhenAnotherSeekerRoleIsPresent()
    {
        // A multi-role principal that includes Hall Owner must not start using the
        // seeker booking flow; the historical owner restriction is preserved.
        Assert.False(HallBookingAccess.IsSeeker(
            [ApplicationRoles.RegisteredUser, ApplicationRoles.HallOwner]));
    }
}
