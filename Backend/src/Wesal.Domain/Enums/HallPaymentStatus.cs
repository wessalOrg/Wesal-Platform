namespace Wesal.Domain.Enums;

/// <summary>
/// Payment state of a hall subscription (FR-SUB-01, US-ADMIN-07). Independent of
/// <see cref="HallStatus"/>: a hall can be Approved but Unpaid, or Paid while
/// suspended/Rejected. The Admin confirms a payment (US-ADMIN-10) which marks the
/// hall Paid and seeds <c>Hall.SubscriptionCycleStart</c>/<c>SubscriptionCycleEnd</c>.
/// Defaults to <see cref="Unpaid"/> for a newly created hall.
/// </summary>
public enum HallPaymentStatus
{
    Unpaid = 0,
    Paid = 1
}