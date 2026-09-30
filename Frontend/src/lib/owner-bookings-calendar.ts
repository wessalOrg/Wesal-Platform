import { parseDateIso } from "@/lib/booking-date";
import { normalizeTimeOnly } from "@/lib/hourly-slots";
import type {
  OwnerBookingsCalendar,
  OwnerBookingsCalendarDay,
} from "@/types/owner-bookings-calendar";

export function monthRangeIso(
  year: number,
  monthIndex: number,
): { fromDate: string; toDate: string } {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const month = pad(monthIndex + 1);
  return {
    fromDate: `${year}-${month}-01`,
    toDate: `${year}-${month}-${pad(lastDay)}`,
  };
}

/** Inclusive display ranges for consecutive whole-hour starts. 17,18,19 → 17:00–20:00. */
export function bookedHourRanges(
  starts: readonly string[],
): Array<{ start: string; end: string }> {
  const minutes = [
    ...new Set(
      starts
        .map((value) => {
          const normalized = normalizeTimeOnly(value);
          if (!normalized) return -1;
          const [hour, minute] = normalized.split(":").map(Number);
          if (!Number.isFinite(hour) || !Number.isFinite(minute)) return -1;
          return hour * 60 + minute;
        })
        .filter((value) => value >= 0),
    ),
  ].sort((left, right) => left - right);

  const ranges: Array<{ start: string; end: string }> = [];
  let index = 0;
  while (index < minutes.length) {
    let end = minutes[index] + 60;
    let next = index + 1;
    while (next < minutes.length && minutes[next] === end) {
      end += 60;
      next += 1;
    }
    ranges.push({
      start: minutesToHm(minutes[index]),
      end: minutesToHm(end % (24 * 60)),
    });
    index = next;
  }
  return ranges;
}

export function mapOwnerBookingsCalendar(payload: unknown): OwnerBookingsCalendar | null {
  const root = asRecord(payload);
  if (!root) return null;

  const fromDate = readDate(root.fromDate ?? root.FromDate);
  const toDate = readDate(root.toDate ?? root.ToDate);
  if (!fromDate || !toDate) return null;

  const rawDays = root.days ?? root.Days;
  const days: OwnerBookingsCalendarDay[] = [];
  if (Array.isArray(rawDays)) {
    for (const item of rawDays) {
      const day = mapDay(item);
      if (day) days.push(day);
    }
  }

  return {
    hallId: readId(root.hallId ?? root.HallId),
    fromDate,
    toDate,
    days,
  };
}

function mapDay(value: unknown): OwnerBookingsCalendarDay | null {
  const record = asRecord(value);
  if (!record) return null;
  const date = readDate(record.date ?? record.Date);
  if (!date) return null;

  const bookedHours = readHours(record.bookedHours ?? record.BookedHours);
  const flag = record.hasBookedHours ?? record.HasBookedHours;
  return {
    date,
    hasBookedHours: typeof flag === "boolean" ? flag : bookedHours.length > 0,
    bookedHours,
  };
}

function readHours(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const hours: string[] = [];
  for (const item of value) {
    const normalized = normalizeTimeOnly(item);
    if (normalized) hours.push(normalized);
  }
  return hours;
}

function readDate(value: unknown): string | null {
  return typeof value === "string" ? parseDateIso(value) : null;
}

function readId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function minutesToHm(total: number): string {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${pad(hour)}:${pad(minute)}`;
}
