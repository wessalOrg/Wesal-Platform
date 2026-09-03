import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import { toBookingError } from "@/lib/booking-errors";
import { parseBookingPeriodType } from "@/lib/booking-period";
import {
  mockCancelBookingRequest,
  mockFetchMyBookings,
  mockFetchPeriodAvailability,
  mockSubmitBookingRequest,
} from "@/services/bookings-mock";
import {
  loadRememberedBookings,
  patchRememberedBooking,
  rememberBookingsFromResult,
} from "@/lib/user-bookings-store";
import { parseBookingStatus } from "@/lib/booking-status";
import { toCancelBookingError } from "@/lib/booking-cancel-errors";
import { emitBookingCancelled } from "@/lib/booking-events";
import { mapAvailabilityDays } from "@/services/halls";
import type {
  BookingRequestInput,
  BookingRequestResult,
  CancelBookingResult,
  CreatedBooking,
  UserBooking,
} from "@/types/booking";
import type { HallAvailabilityDay, HallDayPeriod } from "@/types/hall";

/** Live JWT talks to POST /bookings. Demo stub login stays on the mock store. */
export function bookingsUseMock(): boolean {
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

type HallAvailabilityPayload = {
  availability?: Array<{
    date?: string;
    periods?: Array<{
      periodType?: number | string;
      periodName?: string;
      startTime?: string;
      endTime?: string;
      status?: number | string;
    }>;
  }>;
  data?: HallAvailabilityPayload;
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

  return loadRememberedBookings();
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
    });
    return result;
  } catch (err) {
    throw toCancelBookingError(err);
  }
}

function unwrapHallAvailability(payload: HallAvailabilityPayload): HallAvailabilityPayload {
  if (payload?.data && typeof payload.data === "object") return payload.data;
  return payload ?? {};
}

/**
 * There is no dedicated per-date availability endpoint. Fresh period state
 * comes from GET /halls/{id} (Availability on hall details).
 */
export async function fetchPeriodAvailability(
  hallId: string,
  dateIso: string,
  seedDays: HallAvailabilityDay[],
): Promise<HallDayPeriod[]> {
  if (bookingsUseMock()) {
    return mockFetchPeriodAvailability(hallId, dateIso, seedDays);
  }

  try {
    const { data } = await api.get<HallAvailabilityPayload>(`/halls/${hallId}`, {
      timeout: 8000,
    });
    const days = mapAvailabilityDays(unwrapHallAvailability(data).availability);
    const day = days.find((item) => item.dateIso === dateIso);
    if (day?.periods?.length) return day.periods;

    const seeded = seedDays.find((item) => item.dateIso === dateIso);
    return seeded?.periods ?? [];
  } catch (err) {
    if (err instanceof ApiError) {
      throw toBookingError(err, "errors.booking.availability");
    }
    throw toBookingError(err, "errors.booking.availability");
  }
}
