export const REJECTION_REASON_MAX = 500;

export type RejectionReasonIssue = "required" | "tooLong";

export function validateRejectionReason(value: string): RejectionReasonIssue | null {
  const trimmed = value.trim();
  if (!trimmed) return "required";
  if (trimmed.length > REJECTION_REASON_MAX) return "tooLong";
  return null;
}

export function rejectionReasonMessageKey(issue: RejectionReasonIssue): string {
  if (issue === "tooLong") return "errors.owner.reject.tooLong";
  return "errors.owner.reject.required";
}
