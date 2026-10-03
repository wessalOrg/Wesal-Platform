import { isFutureBookingDate } from "@/lib/booking-date";
import type { HourlyDay, HourlyDayStatus, HourlySlot } from "@/types/hourly-booking";

export const HOURLY_SLOT_START = 8;
export const HOURLY_SLOT_END = 21;

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

export function formatHourlyRange(start: string, end: string, locale: string): string {
  const [startHour] = start.split(":").map(Number);
  const [endHour] = end.split(":").map(Number);
  const startDate = new Date(2026, 0, 1, startHour, 0);
  const endDate = new Date(2026, 0, 1, endHour, 0);
  const timeLocale = locale.startsWith("ar") ? "en-US" : locale;
  const startLabel = toHourlyClock(startDate, timeLocale);
  const endLabel = toHourlyClock(endDate, timeLocale);
  return `${startLabel} – ${endLabel}`;
}

function toHourlyClock(date: Date, timeLocale: string): string {
  return date
    .toLocaleTimeString(timeLocale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\b(am|pm)\b/gi, (token) => token.toUpperCase());
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
