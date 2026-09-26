namespace Wesal.Domain.Enums;

/// <summary>
/// Availability of one 60-minute hourly slot (WESAL-TASK-1). Stored as an integer, so
/// adding a value does not require a schema migration.
/// </summary>
public enum HallSlotStatus
{
    /// <summary>Free. Any seeker may claim it.</summary>
    Available = 0,

    /// <summary>
    /// Officially booked and paid for. The only state reported to seekers as "booked",
    /// and the only state a confirmed booking ends in.
    /// </summary>
    Booked = 1,

    /// <summary>
    /// WESAL-TASK-8 (Edit 8): held by a live booking request that has not been paid for
    /// yet, either because the request is still Pending or because the owner approved it
    /// with a deposit and the payment has not been confirmed.
    /// <para>
    /// A Reserved slot is protected exactly like a Booked one: no second request can claim
    /// it, and the owner's day-block and hourly-window guards still see the booking as
    /// active. It is deliberately NOT reported as "booked" to seekers, because nothing has
    /// been paid for yet; it becomes <see cref="Booked"/> only when the owner confirms the
    /// deposit. A rejected or cancelled request releases it back to
    /// <see cref="Available"/>.
    /// </para>
    /// </summary>
    Reserved = 2
}
