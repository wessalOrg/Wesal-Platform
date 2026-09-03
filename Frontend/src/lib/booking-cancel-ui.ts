import { canCancelBooking } from "@/lib/booking-status";
import type { BookingStatus } from "@/types/booking";

export type CancelUiPhase =
  | "pending"
  | "cancelling"
  | "cancelled"
  | "finalized"
  | "failed";

export type CancelUiSnapshot = {
  status: BookingStatus;
  cancelling: boolean;
  locked: boolean;
  isFeedbackTarget: boolean;
  errorKey: string | null;
  successId: string | null;
};

export type CancelUiView = {
  phase: CancelUiPhase;
  showCancel: boolean;
  cancelDisabled: boolean;
  showRaceAlert: boolean;
  showFailedAlert: boolean;
  showCancelledNotice: boolean;
  errorKey: string | null;
};

export function isCancelConflictMessage(key: string | null | undefined): boolean {
  if (!key) return false;
  return (
    key === "errors.booking.cancel.accepted" ||
    key === "errors.booking.cancel.rejected" ||
    key === "errors.booking.cancel.cancelled" ||
    key === "errors.booking.cancel.finalized"
  );
}

export function resolveCancelUiPhase(snapshot: CancelUiSnapshot): CancelUiPhase {
  if (snapshot.cancelling) return "cancelling";

  if (snapshot.isFeedbackTarget && snapshot.errorKey) {
    if (snapshot.locked || isCancelConflictMessage(snapshot.errorKey)) return "finalized";
    return "failed";
  }

  if (snapshot.status === "Cancelled") return "cancelled";
  if (canCancelBooking(snapshot.status) && !snapshot.locked) return "pending";
  return "finalized";
}

export function isPendingCancelGroup(status: BookingStatus, locked: boolean): boolean {
  return status === "Pending" && !locked;
}

export function describeCancelUi(snapshot: CancelUiSnapshot): CancelUiView {
  const phase = resolveCancelUiPhase(snapshot);
  const isFailed = phase === "failed";
  const isRace =
    phase === "finalized" && snapshot.isFeedbackTarget && Boolean(snapshot.errorKey);

  return {
    phase,
    showCancel: phase === "pending" || phase === "cancelling" || isFailed,
    cancelDisabled: phase === "cancelling",
    showRaceAlert: isRace,
    showFailedAlert: isFailed,
    showCancelledNotice:
      phase === "cancelled" && snapshot.isFeedbackTarget && Boolean(snapshot.successId),
    errorKey: snapshot.isFeedbackTarget ? snapshot.errorKey : null,
  };
}
