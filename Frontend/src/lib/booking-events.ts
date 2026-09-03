export const BOOKING_CANCELLED_EVENT = "wesal-booking-cancelled";

export type BookingCancelledDetail = {
  bookingId: string;
  hallId: string;
  date: string;
  period: string;
};

export function emitBookingCancelled(detail: BookingCancelledDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BOOKING_CANCELLED_EVENT, { detail }));
}
