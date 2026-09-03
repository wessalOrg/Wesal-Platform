import type { BookingPeriodType } from "@/types/booking";
import type { HallDayPeriod } from "@/types/hall";

const FIRST_LABEL = /first|أول|اول|صباح|morning/i;
const SECOND_LABEL = /second|ثان|مساء|evening/i;

export function parseBookingPeriodType(
  value: number | string | null | undefined,
): BookingPeriodType | null {
  if (value == null) return null;
  if (value === 0 || value === "0") return "FirstPeriod";
  if (value === 1 || value === "1") return "SecondPeriod";
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "firstperiod" || normalized === "first") return "FirstPeriod";
  if (normalized === "secondperiod" || normalized === "second") return "SecondPeriod";
  return null;
}

export function inferBookingPeriodType(
  period: Pick<HallDayPeriod, "periodType" | "label">,
): BookingPeriodType | null {
  if (period.periodType) return period.periodType;
  if (FIRST_LABEL.test(period.label)) return "FirstPeriod";
  if (SECOND_LABEL.test(period.label)) return "SecondPeriod";
  return null;
}

export function uniquePeriods(periods: BookingPeriodType[]): BookingPeriodType[] {
  return Array.from(new Set(periods));
}
