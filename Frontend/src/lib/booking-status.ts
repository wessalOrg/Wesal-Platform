import type { BookingStatus } from "@/types/booking";

export function parseBookingStatus(value: string | number | null | undefined): BookingStatus {
  if (value === 0 || value === "0") return "Pending";
  if (value === 1 || value === "1") return "Rejected";
  if (value === 2 || value === "2") return "Accepted";
  if (value === 3 || value === "3") return "Cancelled";
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "rejected") return "Rejected";
  if (normalized === "accepted" || normalized === "approved") {
    return "Accepted";
  }
  if (
    normalized === "confirmed" ||
    normalized === "fullybooked" ||
    normalized === "fully_booked" ||
    normalized === "published"
  ) {
    return "Confirmed";
  }
  if (normalized === "cancelled" || normalized === "canceled") return "Cancelled";
  return "Pending";
}

export function canCancelBooking(status: BookingStatus | string): boolean {
  return parseBookingStatus(status) === "Pending";
}

export function bookingStatusMessageKey(status: BookingStatus): string {
  if (status === "Confirmed") return "bookings.status.confirmed";
  if (status === "Accepted") return "bookings.status.accepted";
  if (status === "Rejected") return "bookings.status.rejected";
  if (status === "Cancelled") return "bookings.status.cancelled";
  return "bookings.status.pending";
}
