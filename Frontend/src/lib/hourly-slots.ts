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

export function monthDateIsos(year: number, monthIndex: number): string[] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
  });
}
