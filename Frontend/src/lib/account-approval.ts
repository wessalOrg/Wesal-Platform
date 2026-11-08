import {
  isEventCoordinatorRole,
  isPhotographerRole,
} from "@/lib/account-role";
import type {
  AccountApprovalStatus,
  ProfessionalAccountPhase,
} from "@/types/account-approval";
import type { WesalRole } from "@/types/session";

const STATUS_BY_NUMBER: Record<number, AccountApprovalStatus> = {
  0: "Approved",
  1: "Pending",
  2: "Rejected",
  3: "NeedsChanges",
};

/** Normalize backend string/number approval values. Unknown → null (fail-closed). */
export function normalizeAccountApprovalStatus(
  value: string | number | null | undefined,
): AccountApprovalStatus | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return STATUS_BY_NUMBER[value] ?? null;
  }
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (raw === "approved" || raw === "0") return "Approved";
  if (raw === "pending" || raw === "1") return "Pending";
  if (raw === "rejected" || raw === "2") return "Rejected";
  if (
    raw === "needschanges" ||
    raw === "needs_changes" ||
    raw === "needs-changes" ||
    raw === "3"
  ) {
    return "NeedsChanges";
  }
  return null;
}

export function isProfessionalPublisherRole(
  role: WesalRole | null | undefined,
): boolean {
  return isEventCoordinatorRole(role) || isPhotographerRole(role);
}

export function resolveProfessionalAccountPhase(input: {
  role: WesalRole | null | undefined;
  authenticated: boolean;
  /** Profile/store still loading approval fields for a professional. */
  statusLoading?: boolean;
  isSetupComplete?: boolean | null;
  approvalStatus?: string | number | null;
}): ProfessionalAccountPhase {
  if (!input.authenticated) return "guest";
  if (!isProfessionalPublisherRole(input.role)) return "guest";
  if (input.statusLoading) return "loading";

  if (input.isSetupComplete === false) return "needs_setup";

  const approval = normalizeAccountApprovalStatus(input.approvalStatus);
  if (input.isSetupComplete === true) {
    if (approval === "Approved") return "approved";
    if (approval === "Pending") return "pending_review";
    if (approval === "NeedsChanges") return "needs_changes";
    if (approval === "Rejected") return "rejected";
    return "unknown";
  }

  // Setup flag unknown — do not grant publish rights.
  if (approval === "Approved") return "unknown";
  if (approval === "Pending") return "pending_review";
  if (approval === "NeedsChanges") return "needs_changes";
  if (approval === "Rejected") return "rejected";
  return "unknown";
}

export function isPendingProfessionalReview(
  phase: ProfessionalAccountPhase,
): boolean {
  return (
    phase === "pending_review" ||
    phase === "needs_changes" ||
    phase === "rejected" ||
    phase === "unknown" ||
    phase === "loading"
  );
}
