import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { mapOwnerBookingsCalendar } from "@/lib/owner-bookings-calendar";
import type { OwnerBookingsCalendar } from "@/types/owner-bookings-calendar";
import { listExternalBookings } from "@/services/owner-external-bookings";
import { isPaymentRequiredApiError } from "@/lib/payment-required-error";
import { isSystemLockedApiError } from "@/lib/system-locked-error";

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

  let data: unknown;
  try {
    ({ data } = await api.get<unknown>(
    `/owner/halls/${encodeURIComponent(trimmed)}/bookings-calendar`,
    {
      params: { fromDate, toDate },
      signal,
      timeout: 10000,
    },
    ));
  } catch (error) {
    if (!isPaymentRequiredApiError(error) && !isSystemLockedApiError(error)) throw error;
    const external = await listExternalBookings(trimmed, fromDate, toDate, signal);
    const dates: string[] = [];
    for (let day = new Date(fromDate + "T00:00:00Z"); day.toISOString().slice(0, 10) <= toDate; day.setUTCDate(day.getUTCDate() + 1)) dates.push(day.toISOString().slice(0, 10));
    data = { hallId: trimmed, fromDate, toDate, days: dates.map((date) => {
      const bookedHours = [...new Set(external.filter((b) => b.status === "Confirmed" && b.date === date).flatMap((b) => b.slotStarts))].sort();
      return { date, hasBookedHours: bookedHours.length > 0, bookedHours };
    }) };
  }

  const calendar = mapOwnerBookingsCalendar(data);
  if (!calendar) {
    throw new ApiError("owner.calendar.error", 0);
  }
  return calendar;
}
