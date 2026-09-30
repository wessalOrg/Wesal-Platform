import type { BookingPeriodType } from "@/types/booking";

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
