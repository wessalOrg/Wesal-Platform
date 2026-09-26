import { ApiError } from "@/lib/api-error";

/**
 * Admin lock denial mapping (FR-SUB-05 / Edit 16).
 * Backend BusinessRuleException code: HallLocked (HTTP 422).
 */

const HALL_LOCKED_CODES = new Set([
  "halllocked",
  "adminlocked",
  "isadminlocked",
]);

const HALL_LOCKED_HINTS = [
  "halllocked",
  "hall locked",
  "adminlocked",
  "admin locked",
  "locked by an administrator",
  "locked by admin",
  "مقفلة من الإدارة",
  "مقفلة حالياً من الإدارة",
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

export function isHallLockedApiError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;

  const code = normalizeCode(error.code ?? "");
  if (code && HALL_LOCKED_CODES.has(code)) return true;

  const nested = extensionCode(error);
  if (nested && HALL_LOCKED_CODES.has(nested)) return true;

  // Backend lock denials are BusinessRuleException → 422.
  if (error.status !== 422 && error.status !== 403) return false;

  const blob = blobFromApiError(error);
  return HALL_LOCKED_HINTS.some((hint) => blob.includes(hint));
}
