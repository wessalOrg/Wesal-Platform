/** Backend AccountRequestReviewLimits.MaximumReasonLength */
export const ADMIN_PHOTOGRAPHER_REJECT_REASON_MAX = 500;

export type AdminPhotographerRejectReasonIssue = "required" | "tooLong";

export function validateAdminPhotographerRejectReason(
  reason: string,
): AdminPhotographerRejectReasonIssue | null {
  const trimmed = reason.trim();
  if (!trimmed) return "required";
  if (trimmed.length > ADMIN_PHOTOGRAPHER_REJECT_REASON_MAX) return "tooLong";
  return null;
}

export function adminPhotographerRejectReasonMessageKey(
  issue: AdminPhotographerRejectReasonIssue,
): string {
  switch (issue) {
    case "required":
      return "admin.photographers.reject.reasonRequired";
    case "tooLong":
      return "admin.photographers.reject.reasonTooLong";
  }
}

export function toRejectAdminPhotographerPayload(reason: string): { reason: string } {
  return { reason: reason.trim() };
}
