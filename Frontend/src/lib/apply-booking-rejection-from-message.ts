import { emitBookingRejected } from "@/lib/booking-events";
import { parseBookingPeriodType } from "@/lib/booking-period";
import { parseBookingRejectionMessage } from "@/lib/booking-rejection-message";
import { loadRememberedBookings, rememberBookingRejection } from "@/lib/user-bookings-store";

/** Maps an owner rejection chat message onto the seeker's remembered bookings. */
export function applyBookingRejectionFromMessage(
  content: string,
  fallbackHallName = "",
): void {
  const parsed = parseBookingRejectionMessage(content, fallbackHallName);
  if (parsed.kind !== "booking_rejection") return;
  const { hallName, date, period, reason } = parsed.details;
  if (!reason.trim()) return;
  rememberBookingRejection({
    hallName: hallName || fallbackHallName,
    date,
    period,
    reason,
  });

  const periodType = parseBookingPeriodType(period);
  const match = loadRememberedBookings().find((item) => {
    if (item.date !== date) return false;
    if (periodType && item.period !== periodType) return false;
    return true;
  });
  if (!match?.bookingId) return;
  emitBookingRejected({
    bookingId: match.bookingId,
    hallId: match.hallId,
    date: match.date,
    periods: match.period ? [match.period] : [],
    rejectionReason: reason,
    hallName: match.hallName || hallName || fallbackHallName,
  });
}
