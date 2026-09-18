import { ApiError, isUnauthorizedApiError } from "@/lib/api-error";

const BLOCKED_CODE_HINTS = [
  "subscriptionlocked",
  "subscriptionunpaid",
  "subscriptioninactive",
  "subscriptionrequired",
  "subscription",
  "paymentrequired",
  "unpaid",
  "locked",
];

function blob(error: ApiError): string {
  return `${error.code ?? ""} ${error.detail ?? ""} ${error.message}`.toLowerCase();
}

export function isAddHallSubscriptionBlockedError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 402) return true;
  if (error.status !== 403) return false;
  const text = blob(error);
  return BLOCKED_CODE_HINTS.some((hint) => text.includes(hint));
}

export function addHallInitiationErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const detail = error.detail?.trim();
    if (detail) return detail;
    const message = error.message?.trim();
    if (message && !message.toLowerCase().includes("request failed")) {
      return message;
    }
  }
  return "owner.management.addHall.failed";
}

export function addHallBlockedMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const detail = error.detail?.trim();
    if (detail) return detail;
    const message = error.message?.trim();
    if (message) return message;
  }
  return "owner.management.addHall.blocked";
}

export { isUnauthorizedApiError };
