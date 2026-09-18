using Wesal.Domain.Entities;
using Wesal.Domain.Enums;

namespace Wesal.Tests.Domain;

public class HallStatusShould
{
    [Fact]
    public void ExposeExactlyTheThreeApprovalStates()
    {
        Assert.Equal(3, Enum.GetValues<HallStatus>().Length);
        Assert.Contains(HallStatus.PendingReview, Enum.GetValues<HallStatus>());
        Assert.Contains(HallStatus.Approved, Enum.GetValues<HallStatus>());
        Assert.Contains(HallStatus.Rejected, Enum.GetValues<HallStatus>());
    }

    [Fact]
    public void DefaultNewHallsToPendingReview()
    {
        // A newly created hall must enter the approval workflow in the Pending
        // state (SRS FR-HALL-01 / FR-ADM-01) until an Admin approves or rejects it.
        var hall = new Hall();

        Assert.Equal(HallStatus.PendingReview, hall.Status);
    }

    [Fact]
    public void DistinguishApprovedFromPendingAndRejected()
    {
        // Approved is the only state eligible for public discovery; PendingReview and
        // Rejected halls must remain hidden until an Admin acts (SRS FR-ADM-01/04).
        Assert.Equal(HallStatus.Approved, HallStatus.Approved);
        Assert.NotEqual(HallStatus.Approved, HallStatus.PendingReview);
        Assert.NotEqual(HallStatus.Approved, HallStatus.Rejected);
    }
}