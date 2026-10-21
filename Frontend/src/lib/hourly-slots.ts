import { isFutureBookingDate } from "@/lib/booking-date";
import type { HourlyDay, HourlyDayStatus, HourlySlot } from "@/types/hourly-booking";

export const HOURLY_SLOT_START = 8;
/** Exclusive end of the last slot. 24 is midnight, shown as 12 at night. */
export const HOURLY_SLOT_END = 24;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function hourToTime(hour: number): string {
  return `${pad(hour)}:00`;
}

export function hourFromTime(value: string): number {
  const hour = Number(String(value).split(":")[0]);
  return Number.isFinite(hour) ? hour : NaN;
}

/** Inclusive start hour, exclusive end hour — e.g. 14:00→16:00 is 14:00 and 15:00. */
export function slotStartsBetween(from: string, to: string): string[] {
  const startHour = hourFromTime(from);
  const endHour = hourFromTime(to);
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour <= startHour) {
    return [];
  }
  const starts: string[] = [];
  for (let hour = startHour; hour < endHour; hour += 1) {
    starts.push(hourToTime(hour));
  }
  return starts;
}

export function defaultHourChoices(): { fromHours: string[]; toHours: string[] } {
  const fromHours: string[] = [];
  const toHours: string[] = [];
  for (let hour = HOURLY_SLOT_START; hour < HOURLY_SLOT_END; hour += 1) {
    fromHours.push(hourToTime(hour));
  }
  for (let hour = HOURLY_SLOT_START + 1; hour <= HOURLY_SLOT_END; hour += 1) {
    toHours.push(hourToTime(hour));
  }
  return { fromHours, toHours };
}

export function hourChoicesFromSlots(slots: HourlySlot[]): { fromHours: string[]; toHours: string[] } {
  if (slots.length === 0) return defaultHourChoices();
  // Booked hours may be omitted by the API (owner hides them), so build the full
  // hour grid between the earliest start and latest end instead of listing slots.
  const startHours = slots.map((slot) => hourFromTime(slot.start)).filter(Number.isFinite);
  const endHours = slots.map((slot) => hourFromTime(slot.end)).filter(Number.isFinite);
  if (startHours.length === 0 || endHours.length === 0) return defaultHourChoices();
  const first = Math.min(...startHours);
  const last = Math.max(...endHours);
  const fromHours: string[] = [];
  const toHours: string[] = [];
  for (let hour = first; hour < last; hour += 1) fromHours.push(hourToTime(hour));
  for (let hour = first + 1; hour <= last; hour += 1) toHours.push(hourToTime(hour));
  return { fromHours, toHours };
}

export function toHoursAfterFrom(from: string, toHours: string[]): string[] {
  if (!from) return toHours;
  const startHour = hourFromTime(from);
  if (!Number.isFinite(startHour)) return toHours;
  return toHours.filter((hour) => hourFromTime(hour) > startHour);
}

/** TimeOnly JSON is usually "HH:mm:ss"; UI slots use "HH:mm". */
export function normalizeTimeOnly(value: unknown): string {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${pad(Number(match[1]))}:${match[2]}`;
}

/** 13:00 → "13:00", 9:00 → "09:00" (24h, zero-padded). */
export function formatClockHHmm(value: string): string {
  const parts = String(value).split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1] ?? "0");
  if (!Number.isFinite(hour)) return value;
  const displayHour = hour >= 24 ? 24 : hour;
  const mins = Number.isFinite(minute) ? String(minute).padStart(2, "0") : "00";
  return `${String(displayHour).padStart(2, "0")}:${mins}`;
}

/** 13:00 → "1:00" (12h face without meridian). */
export function formatClockFace(value: string): string {
  const parts = String(value).split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1] ?? "0");
  if (!Number.isFinite(hour)) return value;
  const face = String(hour % 12 || 12);
  const mins = Number.isFinite(minute) ? String(minute).padStart(2, "0") : "00";
  return `${face}:${mins}`;
}

/** 13:00 → "1:00 م", 24:00 → "12:00 ص". Noon stays "12:00 م". */
export function formatClockHour(value: string, locale: string): string {
  const hour = Number(String(value).split(":")[0]);
  if (!Number.isFinite(hour)) return value;
  const face = formatClockFace(value);
  const morning = hour >= 24 || hour < 12;
  if (locale.startsWith("ar")) return `${face} ${morning ? "ص" : "م"}`;
  return `${face} ${morning ? "AM" : "PM"}`;
}

export function formatClockRange(from: string, to: string, _locale?: string): string {
  // Design: "12:00 - 15:00" — 24h digits, LTR-isolated for RTL UIs.
  return `\u200E${formatClockHHmm(from)} - ${formatClockHHmm(to)}\u200E`;
}

export function formatHourlyRange(start: string, end: string, locale?: string): string {
  return formatClockRange(start, end, locale);
}

export function buildHourlySlots(
  bookedStarts: Iterable<string>,
  locale: string,
): HourlySlot[] {
  const booked = new Set(bookedStarts);
  const slots: HourlySlot[] = [];
  for (let hour = HOURLY_SLOT_START; hour < HOURLY_SLOT_END; hour += 1) {
    const start = hourToTime(hour);
    const end = hourToTime(hour + 1);
    slots.push({
      start,
      end,
      label: formatHourlyRange(start, end, locale),
      status: booked.has(start) ? "booked" : "available",
    });
  }
  return slots;
}

export function visibleHourlySlots(slots: HourlySlot[], showBookedSlots: boolean): HourlySlot[] {
  if (showBookedSlots) return slots;
  return slots.filter((slot) => slot.status === "available");
}

export function resolveHourlyDayStatus(day: HourlyDay | undefined, dateIso: string): HourlyDayStatus {
  if (!isFutureBookingDate(dateIso)) return "past";
  if (day?.blocked) return "blocked";
  return "available";
}
