import { ApiError } from "@/lib/api-error";

const IMAGE_URL_PATTERN =
  /^(https?:\/\/\S+\.(?:jpe?g|png|webp|gif)(?:\?\S*)?|\/uploads\/\S+\.(?:jpe?g|png|webp|gif))$/i;

export const PAYMENT_RECEIPT_NOTICE = "[wesal-payment-receipt]";

export const CHAT_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
export const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function safeMessageText(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function isChatImageUrl(content: unknown): boolean {
  return IMAGE_URL_PATTERN.test(safeMessageText(content).trim());
}

export function isPaymentReceiptNotice(content: unknown): boolean {
  return safeMessageText(content).trim().startsWith(PAYMENT_RECEIPT_NOTICE);
}

export function paymentReceiptNoticeCaption(content: unknown): string {
  const text = safeMessageText(content);
  if (!isPaymentReceiptNotice(text)) return "";
  return text.trim().slice(PAYMENT_RECEIPT_NOTICE.length).trim();
}

export function isAcceptedChatImage(file: File): boolean {
  return chatImageValidationError(file) === null;
}

export function chatImageValidationError(file: File): string | null {
  if (file.size === 0) return "messages.attachEmpty";
  if (file.size > CHAT_IMAGE_MAX_BYTES) return "messages.attachTooLarge";
  if (!CHAT_IMAGE_MIME.has(file.type.toLowerCase()) || !/\.(jpe?g|png|webp)$/i.test(file.name)) return "messages.attachInvalid";
  return null;
}

/** Only classify actual upload rejections; authorization and transient errors keep their existing handling. */
export function chatAttachmentFailure(error: unknown): "attachment-unsupported" | "attachment-rejected" | undefined {
  if (!(error instanceof ApiError)) return undefined;
  if (error.status === 400) {
    // ValidationException(string) uses errors.message, which the generic field mapper
    // treats as a metadata key. Inspect that envelope without exposing its raw text.
    const errors = error.details && typeof error.details === "object"
      ? (error.details as { errors?: unknown }).errors : null;
    const serverMessages = errors && typeof errors === "object"
      ? Object.values(errors).flatMap(value => typeof value === "string" ? [value]
        : Array.isArray(value) ? value.filter((message): message is string => typeof message === "string") : []) : [];
    const messages = [error.message, error.detail ?? "", ...Object.values(error.fieldErrors).flat(), ...serverMessages];
    if (messages.some(message => /attachments are not supported in professional conversations/i.test(message))) {
      return "attachment-unsupported";
    }
    return "attachment-rejected";
  }
  if (error.status === 413) return "attachment-rejected";
  return undefined;
}
