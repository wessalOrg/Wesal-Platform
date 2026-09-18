/**
 * UI approval statuses for Hall Owner tracking (US-OWNER-05).
 * Server remains the source of truth — never invent local transitions.
 */
export const HALL_APPROVAL_STATUSES = ["Pending", "Approved", "Rejected"] as const;

export type HallApprovalStatus = (typeof HALL_APPROVAL_STATUSES)[number];

export type HallApprovalStatusPresentation = {
  labelKey: string;
  /**
   * Visual tone aligned with Amal/Jabr dash-badge variants
   * (wait / ok / bad) — not the decorative phone-mockup sizing.
   */
  tone: "wait" | "ok" | "bad" | "unknown";
};

export const HALL_APPROVAL_STATUS_CONFIG: Record<
  HallApprovalStatus,
  HallApprovalStatusPresentation
> = {
  Pending: {
    labelKey: "owner.management.halls.status.pending",
    tone: "wait",
  },
  Approved: {
    labelKey: "owner.management.halls.status.approved",
    tone: "ok",
  },
  Rejected: {
    labelKey: "owner.management.halls.status.rejected",
    tone: "bad",
  },
};

export function getHallApprovalStatusConfig(
  status: HallApprovalStatus | string,
): HallApprovalStatusPresentation {
  if (status === "Pending" || status === "Approved" || status === "Rejected") {
    return HALL_APPROVAL_STATUS_CONFIG[status];
  }
  return {
    labelKey: "owner.management.halls.status.unknown",
    tone: "unknown",
  };
}
