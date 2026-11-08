/**
 * Mirrors backend AccountApprovalStatus enum names (ProfileResponse uses strings).
 * Numeric values may appear from other endpoints.
 */
export type AccountApprovalStatus =
  | "Approved"
  | "Pending"
  | "Rejected"
  | "NeedsChanges";

export type ProfessionalAccountPhase =
  | "guest"
  | "loading"
  | "needs_setup"
  | "pending_review"
  | "needs_changes"
  | "rejected"
  | "approved"
  | "unknown";
