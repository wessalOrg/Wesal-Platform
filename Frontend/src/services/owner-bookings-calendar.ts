import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { mapOwnerBookingsCalendar } from "@/lib/owner-bookings-calendar";
import type { OwnerBookingsCalendar } from "@/types/owner-bookings-calendar";

/**
 * GET /api/v1/owner/halls/{hallId}/bookings-calendar?fromDate=&toDate=
 * Auth: Hall Owner session. Ownership and locked-hall checks stay on the backend.
 */
export async function fetchOwnerBookingsCalendar(
  hallId: string,
  fromDate: string,
  toDate: string,
  signal?: AbortSignal,
): Promise<OwnerBookingsCalendar> {
  const trimmed = hallId.trim();
  if (!trimmed) {
    throw new ApiError("owner.calendar.error", 404);
  }

  const { data } = await api.get<unknown>(
    `/owner/halls/${encodeURIComponent(trimmed)}/bookings-calendar`,
    {
      params: { fromDate, toDate },
      signal,
      timeout: 10000,
    },
  );

  const calendar = mapOwnerBookingsCalendar(data);
  if (!calendar) {
    throw new ApiError("owner.calendar.error", 0);
  }
  return calendar;
}
