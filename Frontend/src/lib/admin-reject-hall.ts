export const ADMIN_REJECT_REASON_MAX = 1000;

export type AdminRejectReasonIssue = "tooLong";

export function validateAdminRejectReason(reason: string): AdminRejectReasonIssue | null {
  if (reason.trim().length > ADMIN_REJECT_REASON_MAX) return "tooLong";
  return null;
}

export function adminRejectReasonMessageKey(issue: AdminRejectReasonIssue): string {
  return "admin.reject.tooLong";
}

/** Builds the PUT /admin/halls/{id}/reject body. Omits empty reason. */
export function toRejectAdminHallPayload(input: {
  reason?: string;
  confirmLiveApproved?: boolean;
}): { reason?: string; confirmLiveApproved?: boolean } {
  const trimmed = (input.reason ?? "").trim();
  const body: { reason?: string; confirmLiveApproved?: boolean } = {};
  if (trimmed) body.reason = trimmed;
  if (input.confirmLiveApproved) body.confirmLiveApproved = true;
  return body;
}
