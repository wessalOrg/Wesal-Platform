import { ApiError } from "@/lib/api-error";

/**
 * SystemLocked denial mapping (FR-SUB-03).
 *
 * No OpenAPI/Backend Hall.SystemLocked lock endpoint exists in this repo.
 * Detection uses typed error codes plus explicit payload tokens already
 * referenced by the Frontend lock helpers (`systemlocked`).
 *
 * Generic 403 is NOT assumed to be SystemLocked (may be AdminLocked).
 * HTTP 402 remains payment-required, not system lock.
 * EndDate is never used to infer this state.
 */

const SYSTEM_LOCKED_CODES = new Set([
  "systemlocked",
  "hallsystemlocked",
  "subscriptionexpired",
  "subscriptioncycleended",
  "cycleended",
  "cycleexpired",
]);

const SYSTEM_LOCKED_HINTS = [
  "systemlocked",
  "system locked",
  "subscription cycle ended",
  "subscription expired",
  "cycle ended",
  "cycle expired",
  "انتهت دورة الاشتراك",
  "انتهاء دورة الاشتراك",
];

function blobFromApiError(error: ApiError): string {
  const details =
    error.details && typeof error.details === "object"
      ? JSON.stringify(error.details)
      : typeof error.details === "string"
        ? error.details
        : "";
  return `${error.code ?? ""} ${error.detail ?? ""} ${error.message} ${details}`.toLowerCase();
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

function normalizeCode(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s-]+/g, "");
}

export function isSystemLockedApiError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;

  const code = normalizeCode(error.code ?? "");
  if (code && SYSTEM_LOCKED_CODES.has(code)) return true;

  const nested = extensionCode(error);
  if (nested && SYSTEM_LOCKED_CODES.has(nested)) return true;

  // Backend system-lock denials are BusinessRuleException → 422 (HallSystemLocked).
  // Keep 403 text heuristics for older payloads.
  if (error.status !== 403 && error.status !== 422) return false;

  const blob = blobFromApiError(error);
  return SYSTEM_LOCKED_HINTS.some((hint) => blob.includes(hint));
}
