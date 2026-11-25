import api from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { parseBookingPeriodType } from "@/lib/booking-period";
import {
  mockCancelBookingRequest,
  mockFetchMyBookings,
} from "@/services/bookings-mock";
import {
  loadRememberedBookings,
  patchRememberedBooking,
  replaceRememberedBookings,
} from "@/lib/user-bookings-store";
import { parseBookingStatus } from "@/lib/booking-status";
import { normalizeTimeOnly } from "@/lib/hourly-slots";
import { toCancelBookingError } from "@/lib/booking-cancel-errors";
import { emitBookingCancelled } from "@/lib/booking-events";
import { getStoredAuth } from "@/lib/auth-storage";
import { isCurrentAuthenticatedAccount, readAuthenticatedAccount } from "@/lib/authenticated-account";
import type {
  CancelBookingResult,
  UserBooking,
} from "@/types/booking";

/** Real sessions use the booking APIs; local demo sessions use the mock store. */
export function bookingsUseMock(): boolean {
  if (!isDemoModeEnabled()) return false;
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

export async function fetchMyBookings(): Promise<UserBooking[]> {
  const account = readAuthenticatedAccount();
  if (bookingsUseMock()) {
    const mocked = await mockFetchMyBookings();
    if (!isCurrentAuthenticatedAccount(account)) return [];
    const remembered = loadRememberedBookings();
    const merged = [...remembered];
    for (const item of mocked) {
      if (!merged.some((booking) => booking.bookingId === item.bookingId)) {
        merged.push(item);
      }
    }
    return merged;
  }

  try {
    const { data } = await api.get<ApiUserBooking[]>("/bookings", { timeout: 10000 });
    const mapped = (Array.isArray(data) ? data : [])
      .map(mapUserBooking)
      .filter((item): item is UserBooking => Boolean(item));
    if (isCurrentAuthenticatedAccount(account)) replaceRememberedBookings(mapped);
    return mapped;
  } catch {
    // Keep the seeker's list usable offline / on a transient failure: fall back to the
    // bookings already remembered from their own creates and cancels this session.
    return isCurrentAuthenticatedAccount(account) ? loadRememberedBookings() : [];
  }
}

type ApiUserBooking = {
  bookingId?: string;
  hallId?: string;
  hallName?: string;
  date?: string;
  slotStarts?: Array<string | null> | null;
  timeRange?: string | null;
  status?: string | number | null;
  depositAmount?: number | null;
  depositPaymentConfirmedAt?: string | null;
  rejectionReason?: string | null;
  requestedAt?: string | null;
};

function mapUserBooking(item: ApiUserBooking): UserBooking | null {
  const bookingId = String(item.bookingId ?? "").trim();
  const hallId = String(item.hallId ?? "").trim();
  if (!bookingId || !hallId) return null;

  const slotStarts = (item.slotStarts ?? [])
    .map((start) => (typeof start === "string" ? normalizeTimeOnly(start) || start.trim() : ""))
    .filter(Boolean);
  const timeRange = typeof item.timeRange === "string" ? item.timeRange.trim() : "";
  const depositAmount =
    typeof item.depositAmount === "number" && Number.isFinite(item.depositAmount)
      ? item.depositAmount
      : null;

  return {
    bookingId,
    hallId,
    hallName: String(item.hallName ?? "").trim(),
    date: String(item.date ?? ""),
    slotStart: slotStarts[0],
    timeRange: timeRange || undefined,
    status: parseBookingStatus(item.status ?? "Pending"),
    depositAmount,
    rejectionReason:
      typeof item.rejectionReason === "string" && item.rejectionReason.trim()
        ? item.rejectionReason.trim()
        : undefined,
  };
}

type ApiCancelResult = {
  bookingId?: string;
  hallId?: string;
  hallName?: string;
  date?: string;
  period?: number | string;
  status?: string | number;
};

export async function cancelBookingRequest(
  hallId: string,
  bookingId: string,
): Promise<CancelBookingResult> {
  const account = readAuthenticatedAccount();
  if (bookingsUseMock()) {
    const result = await mockCancelBookingRequest(hallId, bookingId);
    if (!isCurrentAuthenticatedAccount(account)) return result;
    patchRememberedBooking(result.bookingId, result.status);
    emitBookingCancelled({
      bookingId: result.bookingId,
      hallId: result.hallId,
      date: result.date,
      period: result.period,
      hallName: result.hallName,
      requesterName: getStoredAuth()?.user?.name?.trim() || "",
    });
    return result;
  }

  try {
    const { data } = await api.post<ApiCancelResult>(
      `/halls/${hallId}/bookings/${bookingId}/cancel`,
      undefined,
      { timeout: 10000 },
    );
    const period = parseBookingPeriodType(data?.period) ?? "FirstPeriod";
    const result: CancelBookingResult = {
      bookingId: String(data?.bookingId ?? bookingId),
      hallId: String(data?.hallId ?? hallId),
      hallName: data?.hallName?.trim() || "",
      date: data?.date ?? "",
      period,
      status: parseBookingStatus(data?.status ?? "Cancelled"),
    };
    if (!isCurrentAuthenticatedAccount(account)) return result;
    patchRememberedBooking(result.bookingId, result.status);
    emitBookingCancelled({
      bookingId: result.bookingId,
      hallId: result.hallId,
      date: result.date,
      period: result.period,
      hallName: result.hallName,
      requesterName: getStoredAuth()?.user?.name?.trim() || "",
    });
    return result;
  } catch (err) {
    throw toCancelBookingError(err);
  }
}
