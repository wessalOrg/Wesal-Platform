using System.Linq.Expressions;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;

namespace Wesal.Domain.Common;

public static class BookingActivity
{
    public static Expression<Func<Booking, bool>> Active => booking =>
        (booking.Source == BookingSource.Online &&
         (booking.Status == BookingStatus.Pending || booking.Status == BookingStatus.Accepted)) ||
        (booking.Source == BookingSource.ExternalManual && booking.Status == BookingStatus.Confirmed);
}
