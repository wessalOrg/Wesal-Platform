import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import {
  mapOwnerAvailabilityDays,
  mapOwnerPeriodUpdate,
  monthDateRange,
  toOwnerAvailabilityApiStatus,
} from "@/lib/owner-availability";
import { toOwnerAvailabilityError } from "@/lib/owner-availability-errors";
import type { BookingPeriodType } from "@/types/booking";
import type {
  OwnerAvailabilityDay,
  OwnerAvailabilityPeriodUpdate,
  OwnerPeriodAvailabilityStatus,
} from "@/types/owner-availability";

/**
 * wesal-api US-OWNER-18: GET /owner/halls/{hallId}/availability?fromDate=&toDate=
 */
export async function fetchHallAvailability(
  hallId: string,
  month: string,
  locale: string,
  signal?: AbortSignal,
): Promise<OwnerAvailabilityDay[]> {
  const id = hallId.trim();
  if (!id) {
    throw toOwnerAvailabilityError(new ApiError("errors.owner.availability.notFound", 404));
  }

  const range = monthDateRange(month);
  try {
    const { data } = await api.get<unknown>(`/owner/halls/${id}/availability`, {
      params: { fromDate: range.from, toDate: range.to },
      timeout: 8000,
      signal,
    });
    return mapOwnerAvailabilityDays(data, locale);
  } catch (err) {
    throw toOwnerAvailabilityError(err);
  }
}

/**
 * wesal-api US-OWNER-18: PUT /owner/halls/{hallId}/availability
 * Body: { date, periodType, status: Available | Booked }
 */
export async function updateHallPeriodAvailability(
  hallId: string,
  input: {
    date: string;
    periodType: BookingPeriodType;
    status: OwnerPeriodAvailabilityStatus;
  },
): Promise<OwnerAvailabilityPeriodUpdate> {
  const id = hallId.trim();
  if (!id) {
    throw toOwnerAvailabilityError(new ApiError("errors.owner.availability.notFound", 404));
  }

  const fallback: OwnerAvailabilityPeriodUpdate = {
    hallId: id,
    dateIso: input.date,
    periodType: input.periodType,
    status: input.status,
  };

  try {
    const { data } = await api.put<unknown>(
      `/owner/halls/${id}/availability`,
      {
        date: input.date,
        periodType: input.periodType,
        status: toOwnerAvailabilityApiStatus(input.status),
      },
      { timeout: 10000 },
    );
    return mapOwnerPeriodUpdate(data, fallback);
  } catch (err) {
    throw toOwnerAvailabilityError(err);
  }
}
