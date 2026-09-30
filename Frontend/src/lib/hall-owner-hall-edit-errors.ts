import { ApiError } from "@/lib/api-error";
import {
  hallRegistrationSubmitErrorMessage,
  mapHallApiErrorsToFormErrors,
} from "@/lib/hall-registration-errors";

export { mapHallApiErrorsToFormErrors };

export function hallUpdateSubmitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.code === "Unauthorized") {
      return "owner.management.hallEdit.errors.unauthorized";
    }
    if (error.status === 403 || error.code === "Forbidden") {
      return "owner.management.hallEdit.errors.forbidden";
    }
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
    const detail =
      error instanceof ApiError ? (error.detail ?? error.message).trim() : "";
    if (detail && !detail.startsWith("owner.") && !detail.startsWith("errors.")) {
      return detail;
    }
    return "owner.management.hallEdit.errors.submitFailed";
  }
  return message;
}

/**
 * wesal-api: BusinessRuleException → HTTP 422 + code HallNotEditable
 * when the hall is admin/system locked (approval status is not a lock).
 */
export function isHallNotEditableApiError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.code === "HallNotEditable") return true;
  if (error.status !== 422) return false;
  const text = `${error.detail ?? ""} ${error.message}`.toLowerCase();
  return text.includes("hallnoteditable") || text.includes("not editable");
}
