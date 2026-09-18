import type { OwnerPeriodAvailabilityStatus } from "@/types/owner-availability";

export type OwnerPeriodVisualState =
  | "available"
  | "booked"
  | "blocked"
  | "updating"
  | "error";

export function ownerPeriodVisualState(options: {
  status: OwnerPeriodAvailabilityStatus;
  saving?: boolean;
  error?: string | null;
}): OwnerPeriodVisualState {
  if (options.saving) return "updating";
  if (options.error) return "error";
  if (options.status === "booked") return "booked";
  if (options.status === "unavailable") return "blocked";
  return "available";
}

export function ownerPeriodIsInteractive(state: OwnerPeriodVisualState): boolean {
  return state === "available" || state === "blocked" || state === "booked" || state === "error";
}
