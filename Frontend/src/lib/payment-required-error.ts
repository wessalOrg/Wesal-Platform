import { ApiError } from "@/lib/api-error";

/**
 * Payment-required denial mapping.
 *
 * No OpenAPI/Backend Hall.PaymentStatus exists in this repo. Detection uses the
 * already-coded Frontend contract from add-hall initiation:
 *   - error.code / extensions.code of PaymentRequired (and close aliases)
 *   - HTTP 402, which that existing helper treats as subscription/payment blocked
 *   - 403 only when the payload text/code is explicitly payment-related
 *
 * Generic 403/409 are NOT treated as payment-required (those remain
 * AdminLocked / SystemLocked / other forbidden handling).
 */

const PAYMENT_REQUIRED_CODES = new Set([
  "paymentrequired",
  "payment_required",
  "subscriptionunpaid",
  "subscriptioninactive",
  "subscriptionrequired",
  "paymentpending",
  "pendingpayment",
]);

const PAYMENT_REQUIRED_HINTS = [
  "paymentrequired",
  "payment required",
  "payment pending",
  "pending payment",
  "awaiting payment",
  "subscriptionunpaid",
  "subscription unpaid",
  "بانتظار الدفع",
  "تأكيد الدفع",
  "غير مدفوع",
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

export function isPaymentRequiredApiError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;

  const code = normalizeCode(error.code ?? "");
  if (code && PAYMENT_REQUIRED_CODES.has(code)) return true;

  const nested = extensionCode(error);
  if (nested && PAYMENT_REQUIRED_CODES.has(nested)) return true;

  // Existing in-repo Frontend contract (add-hall initiation), not an invented guess.
  if (error.status === 402) return true;

  if (error.status !== 403 && error.status !== 402) return false;

  const blob = blobFromApiError(error);
  return PAYMENT_REQUIRED_HINTS.some((hint) => blob.includes(hint));
}
