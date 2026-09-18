export type BookingRequestRealtimeEvent = {
  id: string;
  hallId: string;
  replay: boolean;
  date?: string;
  period?: string;
  requesterName?: string;
};

type RealtimeDto = {
  bookingRequestId?: unknown;
  bookingId?: unknown;
  requestId?: unknown;
  notificationId?: unknown;
  id?: unknown;
  hallId?: unknown;
  requestedDate?: unknown;
  date?: unknown;
  requestedPeriod?: unknown;
  period?: unknown;
  requesterName?: unknown;
  replay?: unknown;
  isReplay?: unknown;
  historical?: unknown;
  isHistorical?: unknown;
  snapshot?: unknown;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asFlag(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

export function parseBookingRequestRealtimeEvent(
  raw: unknown,
): BookingRequestRealtimeEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as RealtimeDto;
  const id =
    asText(data.bookingRequestId) ||
    asText(data.bookingId) ||
    asText(data.requestId) ||
    asText(data.notificationId) ||
    asText(data.id);
  if (!id) return null;

  return {
    id,
    hallId: asText(data.hallId),
    date: asText(data.requestedDate) || asText(data.date) || undefined,
    period: asText(data.requestedPeriod) || asText(data.period) || undefined,
    requesterName: asText(data.requesterName) || undefined,
    replay:
      asFlag(data.replay) ||
      asFlag(data.isReplay) ||
      asFlag(data.historical) ||
      asFlag(data.isHistorical) ||
      asFlag(data.snapshot),
  };
}
