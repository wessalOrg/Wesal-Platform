import { inferBookingPeriodType } from "@/lib/booking-period";
import type { HallDayPeriod } from "@/types/hall";

export type BookingUiPhase =
  | "restricted"
  | "idle"
  | "loading_periods"
  | "period_selection"
  | "all_unavailable"
  | "empty"
  | "submitting"
  | "success"
  | "conflict"
  | "validation_error";

export type PeriodAvailabilityKind = "empty" | "none" | "one" | "both";

export type BookingUiSnapshot = {
  canSubmit: boolean;
  dateIso: string | null;
  periodsLoading: boolean;
  periodsError: string | null;
  periodCount: number;
  availableCount: number;
  submitting: boolean;
  success: boolean;
  errorKey: string | null;
};

export function isPeriodSelectable(period: HallDayPeriod): boolean {
  if (period.status === "booked") return false;
  return Boolean(period.periodType ?? inferBookingPeriodType(period));
}

export function countAvailablePeriods(periods: HallDayPeriod[]): number {
  return periods.filter(isPeriodSelectable).length;
}

export function periodAvailabilityKind(periods: HallDayPeriod[]): PeriodAvailabilityKind {
  if (periods.length === 0) return "empty";
  const available = countAvailablePeriods(periods);
  if (available === 0) return "none";
  if (available === 1) return "one";
  return "both";
}

export function resolveBookingUiPhase(snapshot: BookingUiSnapshot): BookingUiPhase {
  if (!snapshot.canSubmit) return "restricted";
  if (snapshot.success) return "success";
  if (snapshot.submitting) return "submitting";
  if (!snapshot.dateIso) return "idle";
  if (snapshot.periodsLoading && snapshot.periodCount === 0) return "loading_periods";
  if (snapshot.periodsError) return "validation_error";
  if (snapshot.periodCount === 0) return "empty";
  if (snapshot.availableCount === 0) return "all_unavailable";
  if (snapshot.errorKey === "errors.booking.conflict") return "conflict";
  if (snapshot.errorKey) return "validation_error";
  return "period_selection";
}

export function bookingPhaseShowsForm(phase: BookingUiPhase): boolean {
  return phase !== "restricted" && phase !== "success";
}
