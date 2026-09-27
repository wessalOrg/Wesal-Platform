export type BookingRequestRealtimeKind = "received" | "cancelled";

export type BookingRequestRealtimeEvent = {
  id: string;
  hallId: string;
  hallName?: string;
  replay: boolean;
  kind: BookingRequestRealtimeKind;
  date?: string;
  period?: string;
  timeRange?: string;
  requesterName?: string;
};

type RealtimeDto = {
  bookingRequestId?: unknown;
  BookingRequestId?: unknown;
  bookingId?: unknown;
  BookingId?: unknown;
  requestId?: unknown;
  notificationId?: unknown;
  id?: unknown;
  Id?: unknown;
  hallId?: unknown;
  HallId?: unknown;
  hallName?: unknown;
  HallName?: unknown;
  requestedDate?: unknown;
  RequestedDate?: unknown;
  date?: unknown;
  Date?: unknown;
  requestedPeriod?: unknown;
  period?: unknown;
  timeRange?: unknown;
  TimeRange?: unknown;
  requesterName?: unknown;
  RequesterName?: unknown;
  eventType?: unknown;
  EventType?: unknown;
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
  const eventType = asText(data.eventType ?? data.EventType).toLowerCase();
  const kind: BookingRequestRealtimeKind = eventType.includes("cancel")
    ? "cancelled"
    : "received";
  const id =
    asText(data.bookingRequestId) ||
    asText(data.BookingRequestId) ||
    asText(data.bookingId) ||
    asText(data.BookingId) ||
    asText(data.requestId) ||
    asText(data.notificationId) ||
    asText(data.id) ||
    asText(data.Id);
  if (!id) return null;

  return {
    id,
    hallId: asText(data.hallId ?? data.HallId),
    hallName: asText(data.hallName ?? data.HallName) || undefined,
    date:
      asText(data.requestedDate ?? data.RequestedDate ?? data.date ?? data.Date) ||
      undefined,
    period: asText(data.requestedPeriod ?? data.period) || undefined,
    timeRange: asText(data.timeRange ?? data.TimeRange) || undefined,
    requesterName: asText(data.requesterName ?? data.RequesterName) || undefined,
    kind,
    replay:
      asFlag(data.replay) ||
      asFlag(data.isReplay) ||
      asFlag(data.historical) ||
      asFlag(data.isHistorical) ||
      asFlag(data.snapshot),
  };
}
