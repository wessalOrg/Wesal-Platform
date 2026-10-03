import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getStoredAuth } from "@/lib/auth-storage";
import { getAccessToken } from "@/lib/auth-token";
import { addUtcDays, parseDateIso, utcTodayIso } from "@/lib/booking-date";
import {
  isPendingLimitReachedApiError,
  PENDING_LIMIT_MESSAGE_KEY,
} from "@/lib/booking-pending-limit";
import {
  addHourlyBooking,
  getShowBookedSlots,
  isDayBlocked,
  listBlockedDays,
  listHourlyBookings,
  setDayBlocked,
  setShowBookedSlots,
} from "@/lib/hourly-booking-store";
import {
  buildHourlySlots,
  formatHourlyRange,
  normalizeTimeOnly,
} from "@/lib/hourly-slots";
import type {
  BlockDayInput,
  HourlyBookingInput,
  HourlyBookingResult,
  HourlyDay,
  HourlyMonthSnapshot,
  HourlySlot,
} from "@/types/hourly-booking";

const GUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isGuidHallId(hallId: string): boolean {
  return GUID_RE.test(hallId.trim());
}

/** Real halls (GUID) use live hourly APIs. Demo/stub ids stay local. */
export function hourlyUsesLiveApi(hallId: string): boolean {
  const token = getAccessToken();
  if (token?.startsWith("stub-")) return false;
  return isGuidHallId(hallId);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const root = value as Record<string, unknown>;
  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    return root.data as Record<string, unknown>;
  }
  return root;
}

function asList(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const root = asRecord(value);
  for (const key of keys) {
    if (Array.isArray(root[key])) return root[key] as unknown[];
  }
  return [];
}

function isExplicitlyFalse(value: unknown): boolean {
  if (value === false || value === 0) return true;
  const token = String(value ?? "")
    .trim()
    .toLowerCase();
  return token === "false" || token === "0";
}

function mapSlotStatus(value: unknown, isSelectable?: unknown): HourlySlot["status"] {
  const token = String(value ?? "")
    .trim()
    .toLowerCase();
  if (value === 1 || token === "1" || token === "booked") return "booked";
  if (value === 2 || token === "2" || token === "reserved") return "booked";
  if (isExplicitlyFalse(isSelectable)) return "booked";
  return "available";
}

function addOneHour(start: string): string {
  const hour = Number(start.split(":")[0]);
  if (!Number.isFinite(hour)) return start;
  return `${String((hour + 1) % 24).padStart(2, "0")}:00`;
}

function toSlotStartPayload(time: string): string {
  const normalized = normalizeTimeOnly(time);
  return normalized ? `${normalized}:00` : time;
}

function mapApiSlots(slots: unknown[], locale: string): HourlySlot[] {
  return slots.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const data = row as Record<string, unknown>;
    const start = normalizeTimeOnly(data.startTime ?? data.slotStart ?? data.start);
    if (!start) return [];
    const end = normalizeTimeOnly(data.endTime ?? data.end) || addOneHour(start);
    return [
      {
        start,
        end,
        label: formatHourlyRange(start, end, locale),
        status: mapSlotStatus(data.status, data.isSelectable),
      },
    ];
  });
}

function calendarWindow(year: number, monthIndex: number): { from: string; to: string } {
  const from = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  return { from, to: addUtcDays(from, 120) };
}

function daysBetween(fromIso: string, toIso: string): string[] {
  const days: string[] = [];
  for (let iso = fromIso; iso <= toIso; iso = addUtcDays(iso, 1)) {
    days.push(iso);
  }
  return days;
}

function mapCalendarSnapshot(
  payload: unknown,
  hallId: string,
  fallbackFrom: string,
  fallbackTo: string,
): HourlyMonthSnapshot {
  const root = asRecord(payload);
  const from = parseDateIso(String(root.fromDate ?? "")) ?? fallbackFrom;
  const to = parseDateIso(String(root.toDate ?? "")) ?? fallbackTo;
  const openByIso = new Map<string, boolean>();

  for (const row of asList(payload, ["days"])) {
    if (!row || typeof row !== "object") continue;
    const data = row as Record<string, unknown>;
    const iso = parseDateIso(String(data.date ?? data.dateIso ?? ""));
    if (!iso) continue;
    openByIso.set(iso, !isExplicitlyFalse(data.isOpen));
  }

  return {
    hallId,
    showBookedSlots: true,
    days: daysBetween(from, to).map((dateIso) => ({
      dateIso,
      blocked: openByIso.get(dateIso) === false,
      slots: [],
    })),
  };
}

function buildLocalDay(hallId: string, dateIso: string, locale: string): HourlyDay {
  return {
    dateIso,
    blocked: isDayBlocked(hallId, dateIso),
    slots: buildHourlySlots(
      listHourlyBookings(hallId, dateIso).map((item) => item.slotTime),
      locale,
    ),
  };
}

export async function fetchHourlyMonth(
  hallId: string,
  year: number,
  monthIndex: number,
  locale: string,
): Promise<HourlyMonthSnapshot> {
  if (hourlyUsesLiveApi(hallId)) {
    const { from, to } = calendarWindow(year, monthIndex);
    const { data } = await api.get<unknown>(`/halls/${hallId}/availability-calendar`, {
      params: { fromDate: from, toDate: to },
      timeout: 8000,
    });
    return mapCalendarSnapshot(data, hallId, from, to);
  }

  const { from, to } = calendarWindow(year, monthIndex);
  return {
    hallId,
    showBookedSlots: getShowBookedSlots(hallId),
    days: daysBetween(from, to).map((dateIso) => buildLocalDay(hallId, dateIso, locale)),
  };
}

export async function fetchHourlyDay(
  hallId: string,
  dateIso: string,
  locale: string,
): Promise<HourlyDay> {
  if (hourlyUsesLiveApi(hallId)) {
    const { data } = await api.get<unknown>(`/halls/${hallId}/hourly-catalog`, {
      params: { date: dateIso },
      timeout: 8000,
    });
    const root = asRecord(data);
    return {
      dateIso: parseDateIso(String(root.date ?? dateIso)) ?? dateIso,
      blocked: isExplicitlyFalse(root.dayOpen),
      slots: mapApiSlots(asList(data, ["slots"]), locale),
    };
  }

  return buildLocalDay(hallId, dateIso, locale);
}

function mapHourlySubmitError(err: unknown): ApiError {
  if (isPendingLimitReachedApiError(err)) {
    return new ApiError(PENDING_LIMIT_MESSAGE_KEY, err instanceof ApiError ? err.status : 422, {}, {
      code: "PENDING_LIMIT_REACHED",
      details: err instanceof ApiError ? err.details : undefined,
    });
  }
  if (!(err instanceof ApiError)) {
    return new ApiError("errors.hourly.generic");
  }
  if (err.message.startsWith("errors.")) return err;

  const blob = `${err.message} ${err.detail ?? ""}`.toLowerCase();
  if (err.status === 409 && (blob.includes("blocked") || blob.includes("not available on"))) {
    return new ApiError("errors.hourly.dayBlocked", 409);
  }
  if (err.status === 409) {
    return new ApiError("errors.hourly.slotBooked", 409);
  }
  if (err.status === 401) return new ApiError("errors.booking.unauthorized", 401);
  if (err.status === 403) return new ApiError("errors.booking.forbidden", 403);
  return new ApiError("errors.hourly.generic", err.status);
}

export async function submitHourlyBooking(input: HourlyBookingInput): Promise<HourlyBookingResult> {
  const name = input.customerName.trim();
  if (!name) {
    throw new ApiError("errors.hourly.nameRequired", 400);
  }
  const requesterName = (input.requesterName ?? getStoredAuth()?.user.name ?? name).trim();

  if (hourlyUsesLiveApi(input.hallId)) {
    try {
      const starts = (input.slotTimes?.length ? input.slotTimes : [input.slotTime]).filter(Boolean);
      const { data } = await api.post<unknown>(
        `/halls/${input.hallId}/hourly-bookings`,
        {
          hallId: input.hallId,
          date: input.date,
          slotStarts: starts.map(toSlotStartPayload),
          nameOnBooking: name,
          requesterName,
        },
        { timeout: 10000 },
      );
      const root = asRecord(data);
      return {
        hallId: input.hallId,
        date: input.date,
        slotTime: input.slotTime,
        customerName: name,
        requesterName,
        bookingId: String(root.bookingId ?? ""),
      };
    } catch (err) {
      throw mapHourlySubmitError(err);
    }
  }

  const starts = (input.slotTimes?.length ? input.slotTimes : [input.slotTime]).filter(Boolean);
  if (isDayBlocked(input.hallId, input.date)) {
    throw new ApiError("errors.hourly.dayBlocked", 409);
  }
  const taken = listHourlyBookings(input.hallId, input.date).some((item) =>
    starts.includes(item.slotTime),
  );
  if (taken) {
    throw new ApiError("errors.hourly.slotBooked", 409);
  }

  return addHourlyBooking({ ...input, slotTime: starts[0] ?? input.slotTime, customerName: name, requesterName });
}

export async function blockHallDay(input: BlockDayInput): Promise<void> {
  if (hourlyUsesLiveApi(input.hallId)) {
    await api.put(
      `/owner/halls/${input.hallId}/day-block`,
      { date: input.date, isOpen: !input.blocked },
      { timeout: 8000 },
    );
    return;
  }
  setDayBlocked(input.hallId, input.date, input.blocked);
}

export async function saveBookedVisibility(
  hallId: string,
  showBookedSlots: boolean,
): Promise<boolean> {
  if (hourlyUsesLiveApi(hallId)) {
    const { data } = await api.put<unknown>(
      `/owner/halls/${hallId}/hourly-settings`,
      { showBookedSlots },
      { timeout: 8000 },
    );
    const root = asRecord(data);
    const next =
      typeof root.showBookedSlots === "boolean" ? root.showBookedSlots : showBookedSlots;
    setShowBookedSlots(hallId, next);
    return next;
  }

  setShowBookedSlots(hallId, showBookedSlots);
  return showBookedSlots;
}

export async function fetchOwnerHourlyControls(hallId: string): Promise<{
  blockedDays: string[];
  showBookedSlots: boolean;
}> {
  if (hourlyUsesLiveApi(hallId)) {
    const from = utcTodayIso();
    const to = addUtcDays(from, 61);
    const { data } = await api.get<unknown>(`/halls/${hallId}/availability-calendar`, {
      params: { fromDate: from, toDate: to },
      timeout: 8000,
    });
    const blockedDays: string[] = [];
    for (const row of asList(data, ["days"])) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      const iso = parseDateIso(String(rec.date ?? rec.dateIso ?? ""));
      if (!iso || !isExplicitlyFalse(rec.isOpen)) continue;
      blockedDays.push(iso);
    }
    return {
      blockedDays: [...new Set(blockedDays)].sort(),
      showBookedSlots: getShowBookedSlots(hallId),
    };
  }

  return {
    blockedDays: listBlockedDays(hallId),
    showBookedSlots: getShowBookedSlots(hallId),
  };
}
