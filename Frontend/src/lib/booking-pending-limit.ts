import { ApiError } from "@/lib/api-error";

/**
 * Pending booking-request cap (US-BOOK-03 / FR-BOOK-03).
 *
 * Backend contract (E10-ABD-01) is expected to reject a 4th concurrent pending
 * request with BusinessRuleException → HTTP 422 (or 400) and code
 * `PENDING_LIMIT_REACHED`. Generic 400/422 validation payloads are not this.
 */

export const MAX_PENDING_BOOKING_REQUESTS = 3;

export const PENDING_LIMIT_ERROR_CODE = "PENDING_LIMIT_REACHED";

export const PENDING_LIMIT_MESSAGE_KEY = "errors.booking.pendingLimit";

const PENDING_LIMIT_CODES = new Set([
  "pendinglimitreached",
  "pending_limit_reached",
  "pendinglimit",
]);

const PENDING_LIMIT_HINTS = [
  "pendinglimitreached",
  "pending limit reached",
  "maximum of 3 pending",
  "already have 3 pending",
  "3 pending booking",
  "3 طلبات حجز معلّقة",
];

function normalizeCode(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s-]+/g, "");
}

function extensionCode(error: ApiError): string {
  if (!error.details || typeof error.details !== "object") return "";
  const root = error.details as Record<string, unknown>;
  const extensions =
    root.extensions && typeof root.extensions === "object"
      ? (root.extensions as Record<string, unknown>)
      : null;
  const raw = extensions?.code ?? root.code;
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");
}

function blobFromApiError(error: ApiError): string {
  const details =
    error.details && typeof error.details === "object"
      ? JSON.stringify(error.details)
      : typeof error.details === "string"
        ? error.details
        : "";
  return `${error.code ?? ""} ${error.detail ?? ""} ${error.message} ${details}`.toLowerCase();
}

function matchesPendingLimitCode(code: string): boolean {
  const normalized = normalizeCode(code);
  return Boolean(normalized) && PENDING_LIMIT_CODES.has(normalized);
}

export function isPendingLimitErrorKey(key: string | null | undefined): boolean {
  return key === PENDING_LIMIT_MESSAGE_KEY;
}

export function isPendingLimitReachedApiError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;

  const code = error.code ?? "";
  if (code && matchesPendingLimitCode(code)) return true;

  const nested = extensionCode(error);
  if (nested && matchesPendingLimitCode(nested)) return true;

  if (error.status !== 400 && error.status !== 422) return false;

  const blob = blobFromApiError(error);
  return PENDING_LIMIT_HINTS.some((hint) => blob.includes(hint.toLowerCase()));
}
