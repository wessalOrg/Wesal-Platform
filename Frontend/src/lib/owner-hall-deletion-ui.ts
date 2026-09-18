export type HallDeletionFeedbackKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "generic";

export type HallDeletionVisualState =
  | "idle"
  | "deleting"
  | "exiting"
  | "failed"
  | "blocked"
  | "unavailable";

export const HALL_DELETION_EXIT_MS = 220;

export function hallDeletionFeedbackKind(
  errorKey: string | null | undefined,
): HallDeletionFeedbackKind | null {
  if (!errorKey) return null;
  const blob = errorKey.toLowerCase();
  if (blob.includes("unauthorized") || blob.includes("سجّل الدخول")) return "unauthorized";
  if (blob.includes("forbidden") || blob.includes("صاحب القاعة فقط")) return "forbidden";
  if (
    blob.includes("notfound") ||
    blob.includes("not found") ||
    blob.includes("already deleted") ||
    blob.includes("غير موجود") ||
    blob.includes("محذوف")
  ) {
    return "not_found";
  }
  if (
    blob.includes("conflict") ||
    blob.includes("cannot delete") ||
    blob.includes("active booking") ||
    blob.includes("open booking") ||
    blob.includes("حجوزات") ||
    blob.includes("لا يمكن حذف")
  ) {
    return "conflict";
  }
  return "generic";
}

export function hallDeletionVisualState(options: {
  deleting?: boolean;
  exiting?: boolean;
  alreadyGone?: boolean;
  errorKey?: string | null;
}): HallDeletionVisualState {
  if (options.exiting) return "exiting";
  if (options.deleting) return "deleting";
  if (options.alreadyGone) return "unavailable";
  const kind = hallDeletionFeedbackKind(options.errorKey);
  if (kind === "conflict") return "blocked";
  if (kind === "not_found") return "unavailable";
  if (kind) return "failed";
  return "idle";
}

export function hallDeletionLocksAction(state: HallDeletionVisualState): boolean {
  return state === "deleting" || state === "exiting";
}
