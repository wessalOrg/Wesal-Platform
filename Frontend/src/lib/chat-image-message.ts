const IMAGE_URL_PATTERN =
  /^(https?:\/\/\S+\.(?:jpe?g|png|webp|gif)(?:\?\S*)?|\/uploads\/\S+\.(?:jpe?g|png|webp|gif))$/i;

export const PAYMENT_RECEIPT_NOTICE = "[wesal-payment-receipt]";

export const CHAT_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
export const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type ChatMessageKind = "TEXT" | "IMAGE";

export function safeMessageText(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function isChatImageUrl(content: unknown): boolean {
  return IMAGE_URL_PATTERN.test(safeMessageText(content).trim());
}

export function isPaymentReceiptNotice(content: unknown): boolean {
  return safeMessageText(content).trim().startsWith(PAYMENT_RECEIPT_NOTICE);
}

export function paymentReceiptNoticeText(note?: string): string {
  const extra = note?.trim();
  return extra ? `${PAYMENT_RECEIPT_NOTICE}\n${extra}` : PAYMENT_RECEIPT_NOTICE;
}

export function paymentReceiptNoticeCaption(content: unknown): string {
  const text = safeMessageText(content);
  if (!isPaymentReceiptNotice(text)) return "";
  return text.trim().slice(PAYMENT_RECEIPT_NOTICE.length).trim();
}

export function chatMessageKind(content: unknown): ChatMessageKind {
  if (isChatImageUrl(content) || isPaymentReceiptNotice(content)) return "IMAGE";
  return "TEXT";
}

export function isAcceptedChatImage(file: File): boolean {
  return CHAT_IMAGE_MIME.has(file.type.toLowerCase()) && file.size <= CHAT_IMAGE_MAX_BYTES;
}
