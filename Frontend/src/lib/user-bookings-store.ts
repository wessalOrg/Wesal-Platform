import type { BookingRequestResult, BookingStatus, UserBooking } from "@/types/booking";
import { parseBookingPeriodType } from "@/lib/booking-period";
import { parseBookingStatus } from "@/lib/booking-status";

const STORAGE_KEY = "wesal-user-bookings";
export const USER_BOOKINGS_CHANGED_EVENT = "wesal-user-bookings-changed";

function notifyBookingsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(USER_BOOKINGS_CHANGED_EVENT));
}

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
  const slotStart = typeof item.slotStart === "string" ? item.slotStart.trim() : "";
  const timeRange = typeof item.timeRange === "string" ? item.timeRange.trim() : "";
  if (!bookingId || !hallId) return null;
  if (!period && !slotStart && !timeRange) return null;
  const depositAmount =
    typeof item.depositAmount === "number" && Number.isFinite(item.depositAmount)
      ? item.depositAmount
      : null;
  return {
    bookingId,
    hallId,
    hallName: String(item.hallName ?? "").trim(),
    date: String(item.date ?? ""),
    period: period ?? undefined,
    slotStart: slotStart || undefined,
    timeRange: timeRange || undefined,
    status: parseBookingStatus(item.status),
    depositAmount,
    rejectionReason:
      typeof item.rejectionReason === "string" && item.rejectionReason.trim()
        ? item.rejectionReason.trim()
        : undefined,
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
  notifyBookingsChanged();
}

/** Replace the remembered list after a full API fetch. */
export function replaceRememberedBookings(next: UserBooking[]) {
  writeAll(next);
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

export function patchRememberedBooking(
  bookingId: string,
  status: BookingStatus,
  extra?: { rejectionReason?: string | null; depositAmount?: number | null },
) {
  const reason = extra?.rejectionReason?.trim();
  writeAll(
    readAll().map((item) =>
      item.bookingId === bookingId
        ? {
            ...item,
            status,
            ...(reason ? { rejectionReason: reason } : {}),
            ...(extra && "depositAmount" in extra ? { depositAmount: extra.depositAmount } : {}),
          }
        : item,
    ),
  );
  notifyBookingsChanged();
}

export function rememberBookingRejection(match: {
  hallName?: string | null;
  date?: string | null;
  period?: string | null;
  reason: string;
}): void {
  const reason = match.reason.trim();
  const date = match.date?.trim() ?? "";
  if (!reason || !date) return;
  const period = parseBookingPeriodType(match.period);

  writeAll(
    readAll().map((item) => {
      if (item.date !== date) return item;
      if (period && item.period !== period) return item;
      return { ...item, status: "Rejected", rejectionReason: reason };
    }),
  );
  notifyBookingsChanged();
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
