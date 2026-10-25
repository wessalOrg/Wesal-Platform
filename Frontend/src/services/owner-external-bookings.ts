import api from "@/lib/api";
import { notifyPublicHallsChanged } from "@/lib/public-halls-events";
import type { ExternalBooking, ExternalBookingInput } from "@/types/external-booking";
import type { HallBookingNotification } from "@/types/hall-notifications";

export const EXTERNAL_BOOKINGS_CHANGED = "wesal:external-bookings-changed";
const base = (hallId: string) => `/owner/halls/${encodeURIComponent(hallId)}/external-bookings`;

export async function getExternalBooking(hallId: string, bookingId: string): Promise<ExternalBooking> {
  const { data } = await api.get<ExternalBooking>(`${base(hallId)}/${encodeURIComponent(bookingId)}`, { timeout: 10000 });
  return data;
}

export function externalToNotification(b: ExternalBooking): HallBookingNotification {
  return { id: b.bookingId, hallId: b.hallId, source: b.source, revision: b.revision,
    status: b.status, date: b.date, slotStarts: b.slotStarts, timeRange: b.timeRange,
    requesterName: b.customerName, requesterPhone: b.phone, requesterUserId: "", eventTypeLabel: b.eventType,
    periods: [], canPublish: false, canDelete: false, isPublished: false };
}

export function externalBookingsChanged(hallId: string) {
  window.dispatchEvent(new CustomEvent(EXTERNAL_BOOKINGS_CHANGED, { detail: { hallId } }));
  notifyPublicHallsChanged();
}

export async function listExternalBookings(hallId: string, fromDate: string, toDate: string, signal?: AbortSignal): Promise<ExternalBooking[]> {
  const result: ExternalBooking[] = [];
  for (let page = 1; page <= 10000; page++) {
    const { data } = await api.get<{ items: ExternalBooking[] }>(base(hallId), {
      params: { fromDate, toDate, page, pageSize: 100 }, signal, timeout: 10000,
    });
    result.push(...data.items);
    if (data.items.length < 100) return result;
  }
  throw new Error("Too many external bookings; select a shorter date range.");
}

export async function saveExternalBooking(hallId: string, input: ExternalBookingInput, key: string, existing?: ExternalBooking): Promise<ExternalBooking> {
  const config = { timeout: 15000, headers: { "Idempotency-Key": key, ...(existing ? { "If-Match": `"${existing.revision}"` } : {}) } };
  const { data } = existing
    ? await api.put<ExternalBooking>(`${base(hallId)}/${existing.bookingId}`, input, config)
    : await api.post<ExternalBooking>(base(hallId), input, config);
  externalBookingsChanged(hallId);
  return data;
}

export async function cancelExternalBooking(booking: ExternalBooking, reason: string, key: string): Promise<ExternalBooking> {
  const { data } = await api.post<ExternalBooking>(`${base(booking.hallId)}/${booking.bookingId}/cancel`, { reason }, {
    timeout: 15000, headers: { "Idempotency-Key": key, "If-Match": `"${booking.revision}"` },
  });
  externalBookingsChanged(booking.hallId);
  return data;
}
