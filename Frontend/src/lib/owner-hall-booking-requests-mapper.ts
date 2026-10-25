import { parseDateIso } from "@/lib/booking-date";
import { parseDepositAmount } from "@/lib/booking-deposits";
import { parseBookingStatus } from "@/lib/booking-status";
import { normalizeTimeOnly } from "@/lib/hourly-slots";
import { parseNameOnBooking } from "@/lib/name-on-booking";
import type { BookingPeriodType } from "@/types/booking";
import type { OwnerHallBookingRequest } from "@/types/owner-hall-booking-requests";

/**
 * Assumed owner booking-request list contract (US-OWNER-09) until OpenAPI lands.
 *
 * GET /api/v1/owner/halls/{hallId}/bookings (wesal-api US-OWNER-09)
 * Auth: Bearer (Hall Owner + owns hall)
 *
 * 200: OwnerBookingRequestDto[] | { items?: ... } | { requests?: ... }
 * 401 unauthorized · 403 forbidden · 404 hall not found / inaccessible
 */
export const OWNER_HALL_BOOKING_REQUESTS_PATH = (hallId: string) =>
  `/owner/halls/${encodeURIComponent(hallId)}/bookings`;

export type OwnerHallBookingRequestDto = {
  source?: string | number;
  externalEventType?: string;
  id?: string | null;
  bookingId?: string | null;
  bookingRequestId?: string | null;
  hallId?: string | null;
  requesterName?: string | null;
  requesterFullName?: string | null;
  customerName?: string | null;
  fullName?: string | null;
  nameOnBooking?: string | null;
  requesterPhone?: string | null;
  date?: string | null;
  requestedDate?: string | null;
  period?: string | number | null;
  requestedPeriod?: string | number | null;
  periods?: Array<string | number | null> | null;
  bookingPeriods?: Array<string | number | null> | null;
  slotStarts?: Array<string | null> | null;
  timeRange?: string | null;
  requesterUserId?: string | null;
  depositAmount?: unknown;
  depositPaymentConfirmedAt?: unknown;
  status?: string | number | null;
  createdAt?: string | null;
  requestedAt?: string | null;
};

function depositWasConfirmed(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return Boolean(trimmed) && trimmed !== "0001-01-01T00:00:00+00:00";
}

function readId(dto: OwnerHallBookingRequestDto): string | null {
  const value = String(
    dto.bookingRequestId ?? dto.bookingId ?? dto.id ?? "",
  ).trim();
  return value || null;
}

function readRequesterName(dto: OwnerHallBookingRequestDto): string {
  const packed = parseNameOnBooking(String(dto.nameOnBooking ?? "").trim());
  if (packed.displayName) return packed.displayName;
  return (
    String(
      dto.requesterName ??
        dto.requesterFullName ??
        dto.customerName ??
        dto.fullName ??
        "",
    ).trim() || "—"
  );
}

function parsePeriod(raw: string | number | null | undefined): BookingPeriodType | null {
  if (raw === 0 || raw === "0") return "FirstPeriod";
  if (raw === 1 || raw === "1") return "SecondPeriod";
  const normalized = String(raw ?? "")
    .replace(/[\s_-]/g, "")
    .toLowerCase();
  if (
    normalized === "firstperiod" ||
    normalized === "first" ||
    normalized === "morning"
  ) {
    return "FirstPeriod";
  }
  if (
    normalized === "secondperiod" ||
    normalized === "second" ||
    normalized === "evening"
  ) {
    return "SecondPeriod";
  }
  return null;
}

function readPeriods(dto: OwnerHallBookingRequestDto): BookingPeriodType[] {
  const list = dto.periods ?? dto.bookingPeriods;
  if (Array.isArray(list) && list.length > 0) {
    const periods: BookingPeriodType[] = [];
    for (const item of list) {
      const parsed = parsePeriod(item);
      if (parsed && !periods.includes(parsed)) periods.push(parsed);
    }
    if (periods.length > 0) return periods;
  }
  const single = parsePeriod(dto.requestedPeriod ?? dto.period);
  return single ? [single] : [];
}

function readSlotStarts(dto: OwnerHallBookingRequestDto): string[] {
  if (!Array.isArray(dto.slotStarts)) return [];
  const starts: string[] = [];
  for (const item of dto.slotStarts) {
    const normalized = normalizeTimeOnly(item);
    if (normalized && !starts.includes(normalized)) starts.push(normalized);
  }
  return starts;
}

export function mapOwnerHallBookingRequestDto(
  dto: OwnerHallBookingRequestDto,
  fallbackHallId: string,
): OwnerHallBookingRequest | null {
  const id = readId(dto);
  if (!id) return null;
  if ((dto.source === "ExternalManual" || dto.source === 1) &&
      !["Confirmed", "Cancelled", "4", "3"].includes(String(dto.status))) return null;
  const date = parseDateIso(dto.date ?? dto.requestedDate);
  if (!date) return null;
  const periods = readPeriods(dto);
  const slotStarts = readSlotStarts(dto);
  const timeRange = String(dto.timeRange ?? "").trim();
  if (periods.length === 0 && slotStarts.length === 0 && !timeRange) return null;

  const packed = parseNameOnBooking(String(dto.nameOnBooking ?? "").trim());
  const phone =
    packed.phone ||
    String(dto.requesterPhone ?? "").trim() ||
    undefined;

  return {
    id,
    hallId: String(dto.hallId ?? "").trim() || fallbackHallId,
    requesterName: readRequesterName(dto),
    requesterUserId: String(dto.requesterUserId ?? "").trim() || undefined,
    requesterPhone: phone,
    eventTypeLabel: dto.source === "ExternalManual" || dto.source === 1 ? dto.externalEventType : packed.eventTypeLabel,
    date,
    periods,
    slotStarts,
    timeRange: timeRange || undefined,
    status: dto.source === "ExternalManual" || dto.source === 1 ? (["Cancelled", "3"].includes(String(dto.status)) ? "Cancelled" : "Confirmed") : depositWasConfirmed(dto.depositPaymentConfirmedAt)
      ? "Confirmed"
      : parseBookingStatus(dto.status),
    depositAmount: parseDepositAmount(dto.depositAmount),
    createdAt: dto.createdAt ?? dto.requestedAt ?? null,
  };
}

export function mapOwnerHallBookingRequestsResponse(
  data: unknown,
  hallId: string,
): OwnerHallBookingRequest[] {
  const list: OwnerHallBookingRequestDto[] = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? Array.isArray((data as { items?: unknown }).items)
        ? ((data as { items: OwnerHallBookingRequestDto[] }).items)
        : Array.isArray((data as { requests?: unknown }).requests)
          ? ((data as { requests: OwnerHallBookingRequestDto[] }).requests)
          : Array.isArray((data as { bookings?: unknown }).bookings)
            ? ((data as { bookings: OwnerHallBookingRequestDto[] }).bookings)
            : []
      : [];

  const requests: OwnerHallBookingRequest[] = [];
  for (const item of list) {
    const mapped = mapOwnerHallBookingRequestDto(item, hallId);
    if (mapped) {
      // Never drop competing same-date/period requests — server list is authoritative.
      requests.push(mapped);
    }
  }
  return requests;
}
