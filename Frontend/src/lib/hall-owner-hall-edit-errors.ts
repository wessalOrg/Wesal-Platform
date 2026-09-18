import { ApiError } from "@/lib/api-error";
import {
  hallRegistrationSubmitErrorMessage,
  mapHallApiErrorsToFormErrors,
} from "@/lib/hall-registration-errors";

export { mapHallApiErrorsToFormErrors };

export function hallUpdateSubmitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (isHallNotEditableApiError(error)) {
      return "owner.management.hallEdit.errors.notEditable";
    }
  }
  const message = hallRegistrationSubmitErrorMessage(error);
  if (message === "owner.management.addHall.errors.network") {
    return "owner.management.hallEdit.errors.network";
  }
  if (message === "owner.management.addHall.errors.submitFailed") {
    return "owner.management.hallEdit.errors.submitFailed";
  }
  if (message === "owner.management.addHall.errors.validation") {
    return "owner.management.addHall.errors.validation";
  }
  return message;
}

/**
 * wesal-api: BusinessRuleException → HTTP 422 + code HallNotEditable
 * when Status == PendingReview (IsEditable == false).
 */
export function isHallNotEditableApiError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.code === "HallNotEditable") return true;
  if (error.status !== 422) return false;
  const text = `${error.detail ?? ""} ${error.message}`.toLowerCase();
  return text.includes("hallnoteditable") || text.includes("not editable");
}
