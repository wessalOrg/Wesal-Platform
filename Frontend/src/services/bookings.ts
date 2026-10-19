import api from "@/lib/api";
import { getAccessToken } from "@/lib/auth-token";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { toBookingError } from "@/lib/booking-errors";
import { parseBookingPeriodType } from "@/lib/booking-period";
import {
  mockCancelBookingRequest,
  mockFetchMyBookings,
  mockSubmitBookingRequest,
} from "@/services/bookings-mock";
import {
  loadRememberedBookings,
  patchRememberedBooking,
  rememberBookingsFromResult,
  replaceRememberedBookings,
} from "@/lib/user-bookings-store";
import { parseBookingStatus } from "@/lib/booking-status";
import { normalizeTimeOnly } from "@/lib/hourly-slots";
import { toCancelBookingError } from "@/lib/booking-cancel-errors";
import { emitBookingCancelled, emitBookingSubmitted } from "@/lib/booking-events";
import { getStoredAuth } from "@/lib/auth-storage";
import type {
  BookingRequestInput,
  BookingRequestResult,
  CancelBookingResult,
  CreatedBooking,
  UserBooking,
} from "@/types/booking";

/** Live JWT talks to POST /bookings. Demo stub login stays on the mock store (demo mode only). */
export function bookingsUseMock(): boolean {
  if (!isDemoModeEnabled()) return false;
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

type ApiCreatedBooking = {
  bookingId?: string;
  period?: number | string;
  status?: string;
};

type ApiBookingResult = {
  hallId?: string;
  hallName?: string;
  date?: string;
  requesterUserId?: string;
  status?: string;
  periods?: ApiCreatedBooking[];
};

function mapCreatedPeriod(item: ApiCreatedBooking): CreatedBooking | null {
  const period = parseBookingPeriodType(item.period);
  if (!period) return null;
  return {
    bookingId: String(item.bookingId ?? ""),
    period,
    status: item.status ?? "Pending",
  };
}

function mapResult(data: ApiBookingResult, fallback: BookingRequestInput): BookingRequestResult {
  const periods = (data.periods ?? [])
    .map(mapCreatedPeriod)
    .filter((item): item is CreatedBooking => Boolean(item));

  return {
    hallId: String(data.hallId ?? fallback.hallId),
    hallName: data.hallName?.trim() || "",
    date: data.date ?? fallback.date,
    requesterUserId: data.requesterUserId ?? "",
    status: data.status ?? "Pending",
    periods:
      periods.length > 0
        ? periods
        : fallback.periods.map((period) => ({
            bookingId: "",
            period,
            status: "Pending",
          })),
  };
}

export async function submitBookingRequest(
  input: BookingRequestInput,
): Promise<BookingRequestResult> {
  if (bookingsUseMock()) {
    const result = await mockSubmitBookingRequest(input);
    rememberBookingsFromResult(result);
    emitBookingSubmitted({
      hallId: result.hallId,
      hallName: result.hallName,
      date: result.date,
      bookingId: result.periods[0]?.bookingId,
      periods: result.periods.map((item) => item.period),
    });
    return result;
  }

  try {
    const { data } = await api.post<ApiBookingResult>(
      "/bookings",
      {
        hallId: input.hallId,
        date: input.date,
        periods: input.periods,
      },
      { timeout: 10000 },
    );
    const result = mapResult(data ?? {}, input);
    rememberBookingsFromResult(result);
    emitBookingSubmitted({
      hallId: result.hallId,
      hallName: result.hallName,
      date: result.date,
      bookingId: result.periods[0]?.bookingId,
      periods: result.periods.map((item) => item.period),
    });
    return result;
  } catch (err) {
    throw toBookingError(err);
  }
}

export async function fetchMyBookings(): Promise<UserBooking[]> {
  if (bookingsUseMock()) {
    const mocked = await mockFetchMyBookings();
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
    replaceRememberedBookings(mapped);
    return mapped;
  } catch {
    // Keep the seeker's list usable offline / on a transient failure: fall back to the
    // bookings already remembered from their own creates and cancels this session.
    return loadRememberedBookings();
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
  if (bookingsUseMock()) {
    const result = await mockCancelBookingRequest(hallId, bookingId);
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
