import { isPaymentReceiptNotice } from "@/lib/chat-image-message";
import { isSubscriptionExpiryWarningContent } from "@/lib/subscription-expiry-warning-message";
import type { ConversationSummary } from "@/types/messages";

function isSupportPreview(preview: string): boolean {
  return isPaymentReceiptNotice(preview) || isSubscriptionExpiryWarningContent(preview);
}

/**
 * Same hall-scoped owner ↔ admin thread Edit 4 opens from the payment notice.
 * Prefers a support/payment preview when the hall has more than one inbox row.
 */
export function pickOwnerAdminConversation(
  items: ConversationSummary[],
  hallId?: string | null,
): ConversationSummary | null {
  const needle = hallId?.trim().toLowerCase() || "";
  const scoped = needle
    ? items.filter((item) => (item.hallId ?? "").toLowerCase() === needle)
    : [];
  if (!scoped.length) return null;
  return scoped.find((item) => isSupportPreview(item.lastMessagePreview ?? "")) ?? scoped[0] ?? null;
}
