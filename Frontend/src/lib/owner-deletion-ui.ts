export type DeletionFeedbackKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "generic";

export type DeletionVisualState = "idle" | "deleting" | "exiting" | "failed" | "conflict";

export const OWNER_DELETION_EXIT_MS = 220;

export function deletionFeedbackKind(
  errorKey: string | null | undefined,
): DeletionFeedbackKind | null {
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
    blob.includes("لا يمكن حذف")
  ) {
    return "conflict";
  }
  return "generic";
}

export function cardDeletionState(options: {
  deleting?: boolean;
  exiting?: boolean;
  errorKey?: string | null;
}): DeletionVisualState {
  if (options.exiting) return "exiting";
  if (options.deleting) return "deleting";
  const kind = deletionFeedbackKind(options.errorKey);
  if (kind === "conflict" || kind === "not_found") return "conflict";
  if (kind) return "failed";
  return "idle";
}

export function deletionLocksAction(state: DeletionVisualState): boolean {
  return state === "deleting" || state === "exiting" || state === "conflict";
}
