/**
 * Backend HallStatus enum (Wesal.Domain.Enums.HallStatus).
 * JSON uses JsonStringEnumConverter: PendingReview | Approved | Rejected.
 */
export const HALL_STATUS = {
  PendingReview: "PendingReview",
  Approved: "Approved",
  Rejected: "Rejected",
} as const;

export type HallStatus = (typeof HALL_STATUS)[keyof typeof HALL_STATUS];

export function parseHallStatus(raw: unknown): HallStatus | null {
  if (typeof raw === "number" && Number.isInteger(raw)) {
    if (raw === 0) return HALL_STATUS.PendingReview;
    if (raw === 1) return HALL_STATUS.Approved;
    if (raw === 2) return HALL_STATUS.Rejected;
    return null;
  }

  if (typeof raw !== "string") return null;

  const normalized = raw.replace(/[\s_-]/g, "").toLowerCase();
  if (normalized === "pendingreview" || normalized === "pending") {
    return HALL_STATUS.PendingReview;
  }
  if (normalized === "approved") return HALL_STATUS.Approved;
  if (normalized === "rejected") return HALL_STATUS.Rejected;
  return null;
}
