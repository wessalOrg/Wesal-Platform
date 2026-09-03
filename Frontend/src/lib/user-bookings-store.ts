import type { BookingRequestResult, BookingStatus, UserBooking } from "@/types/booking";
import { parseBookingPeriodType } from "@/lib/booking-period";
import { parseBookingStatus } from "@/lib/booking-status";

const STORAGE_KEY = "wesal-user-bookings";

function canUseStorage() {
  return typeof window !== "undefined";
}

function readAll(): UserBooking[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => mapStoredBooking(item))
      .filter((item): item is UserBooking => Boolean(item));
  } catch {
    return [];
  }
}

function writeAll(bookings: UserBooking[]) {
  if (!canUseStorage()) return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

function mapStoredBooking(value: unknown): UserBooking | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<UserBooking>;
  const period = parseBookingPeriodType(item.period);
  const bookingId = String(item.bookingId ?? "").trim();
  const hallId = String(item.hallId ?? "").trim();
  if (!bookingId || !hallId || !period) return null;
  return {
    bookingId,
    hallId,
    hallName: String(item.hallName ?? "").trim(),
    date: String(item.date ?? ""),
    period,
    status: parseBookingStatus(item.status),
  };
}

export function loadRememberedBookings(): UserBooking[] {
  return readAll();
}

export function rememberUserBookings(next: UserBooking[]) {
  const current = readAll();
  const merged = [...current];
  for (const booking of next) {
    const index = merged.findIndex((item) => item.bookingId === booking.bookingId);
    if (index >= 0) merged[index] = booking;
    else merged.unshift(booking);
  }
  writeAll(merged);
}

export function rememberBookingsFromResult(result: BookingRequestResult) {
  rememberUserBookings(
    result.periods
      .filter((item) => item.bookingId)
      .map((item) => ({
        bookingId: item.bookingId,
        hallId: result.hallId,
        hallName: result.hallName,
        date: result.date,
        period: item.period,
        status: parseBookingStatus(item.status || result.status),
      })),
  );
}

export function patchRememberedBooking(bookingId: string, status: BookingStatus) {
  writeAll(
    readAll().map((item) => (item.bookingId === bookingId ? { ...item, status } : item)),
  );
}

export function bookingsFromResult(result: BookingRequestResult): UserBooking[] {
  return result.periods
    .filter((item) => item.bookingId)
    .map((item) => ({
      bookingId: item.bookingId,
      hallId: result.hallId,
      hallName: result.hallName,
      date: result.date,
      period: item.period,
      status: parseBookingStatus(item.status || result.status),
    }));
}
