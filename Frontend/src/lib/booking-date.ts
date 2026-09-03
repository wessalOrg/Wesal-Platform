import type { HallAvailabilityDay, HallDayPeriod } from "@/types/hall";
import { inferBookingPeriodType } from "@/lib/booking-period";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function utcTodayIso(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}

export function addUtcDays(iso: string, amount: number): string {
  const parsed = parseDateIso(iso);
  if (!parsed) return iso;
  const [year, month, day] = parsed.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

export function parseDateIso(value?: string | null): string | null {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

/** Backend rejects today and earlier (UTC). */
export function isFutureBookingDate(iso: string): boolean {
  const parsed = parseDateIso(iso);
  if (!parsed) return false;
  return parsed > utcTodayIso();
}

export function formatBookingDateLabel(iso: string, locale: string): string {
  const parsed = parseDateIso(iso);
  if (!parsed) return iso;
  const [year, month, day] = parsed.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

export function formatBookingDateChip(iso: string, locale: string): string {
  const parsed = parseDateIso(iso);
  if (!parsed) return iso;
  const [year, month, day] = parsed.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function withPeriodTypes(periods: HallDayPeriod[]): HallDayPeriod[] {
  return periods.map((period) => ({
    ...period,
    periodType: period.periodType ?? inferBookingPeriodType(period) ?? undefined,
  }));
}

/**
 * Demo fallback days often omit `dateIso`. Assign consecutive future dates
 * so the booking form can still submit yyyy-MM-dd values.
 */
export function ensureAvailabilityDateIso(
  days: HallAvailabilityDay[],
): HallAvailabilityDay[] {
  let nextIso = addUtcDays(utcTodayIso(), 1);

  return days.map((day) => {
    const iso = parseDateIso(day.dateIso) ?? nextIso;
    if (!parseDateIso(day.dateIso)) {
      nextIso = addUtcDays(iso, 1);
    }
    return {
      ...day,
      dateIso: iso,
      periods: withPeriodTypes(day.periods),
    };
  });
}

export function futureAvailabilityDays(
  days: HallAvailabilityDay[],
): HallAvailabilityDay[] {
  return ensureAvailabilityDateIso(days).filter(
    (day) => day.dateIso && isFutureBookingDate(day.dateIso),
  );
}
