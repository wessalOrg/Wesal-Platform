/** Backend AccountRequestReviewLimits.MaximumReasonLength */
export const ADMIN_COORDINATOR_REJECT_REASON_MAX = 500;

export type AdminCoordinatorRejectReasonIssue = "required" | "tooLong";

export function validateAdminCoordinatorRejectReason(
  reason: string,
): AdminCoordinatorRejectReasonIssue | null {
  const trimmed = reason.trim();
  if (!trimmed) return "required";
  if (trimmed.length > ADMIN_COORDINATOR_REJECT_REASON_MAX) return "tooLong";
  return null;
}

export function adminCoordinatorRejectReasonMessageKey(
  issue: AdminCoordinatorRejectReasonIssue,
): string {
  switch (issue) {
    case "required":
      return "admin.coordinators.reject.reasonRequired";
    case "tooLong":
      return "admin.coordinators.reject.reasonTooLong";
  }
}

export function toRejectAdminCoordinatorPayload(reason: string): { reason: string } {
  return { reason: reason.trim() };
}
