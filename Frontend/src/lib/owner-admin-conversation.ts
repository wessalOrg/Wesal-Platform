import { classifyAdminMessageCategory } from "@/lib/admin-message-category";
import { isPaymentReceiptNotice } from "@/lib/chat-image-message";
import { conversationTimeValue } from "@/lib/conversation-mapper";
import { isSubscriptionExpiryWarningContent } from "@/lib/subscription-expiry-warning-message";
import type { ConversationSummary } from "@/types/messages";

const ADMIN_NAME =
  /^(الإدارة|ادارة|إدارة المنصة|Admin|Administrator|Wesal Admin|مشرف)\b/i;

const ADMIN_PREVIEW =
  /تم اعتماد قاعتك|تم تأكيد دفع اشتراك|يجب دفع الاشتراك|إثبات الدفع|تم رفض صالة|تم رفض القاعة/;

function hallKey(item: ConversationSummary): string {
  return (item.hallId ?? "").trim().toLowerCase();
}

function participantKey(item: ConversationSummary): string {
  return (item.otherParticipantId ?? "").trim().toLowerCase();
}

function isSameAdminAcrossHalls(
  item: ConversationSummary,
  allItems: ConversationSummary[],
): boolean {
  const id = participantKey(item);
  if (!id) return false;
  const halls = new Set(
    allItems
      .filter((row) => participantKey(row) === id)
      .map(hallKey)
      .filter(Boolean),
  );
  return halls.size > 1;
}

/** True when this inbox row is the owner ↔ Admin thread, not a seeker chat. */
export function isOwnerAdminConversation(
  item: ConversationSummary,
  allItems: ConversationSummary[] = [],
): boolean {
  const preview = item.lastMessagePreview ?? "";
  if (isPaymentReceiptNotice(preview)) return true;
  if (isSubscriptionExpiryWarningContent(preview)) return true;
  if (classifyAdminMessageCategory(preview, item.otherParticipantId) === "payment_notice") {
    return true;
  }
  if (ADMIN_PREVIEW.test(preview)) return true;
  if (ADMIN_NAME.test((item.otherParticipantName ?? "").trim())) return true;
  if (participantKey(item) === "system") return true;
  return isSameAdminAcrossHalls(item, allItems);
}

function oldestInPool(pool: ConversationSummary[]): ConversationSummary | null {
  if (!pool.length) return null;
  return [...pool].sort((left, right) => {
    const byCreated =
      conversationTimeValue(left.createdAt) - conversationTimeValue(right.createdAt);
    if (byCreated !== 0) return byCreated;
    return left.conversationId.localeCompare(right.conversationId);
  })[0] ?? null;
}

/**
 * Same hall-scoped owner ↔ admin thread Edit 4 opens from the payment notice.
 * Never falls back to a seeker inbox row.
 */
export function pickOwnerAdminConversation(
  items: ConversationSummary[],
  hallId?: string | null,
): ConversationSummary | null {
  const needle = hallId?.trim().toLowerCase() || "";
  const adminItems = items.filter((item) => isOwnerAdminConversation(item, items));

  if (needle) {
    const adminForHall = adminItems.filter((item) => hallKey(item) === needle);
    if (adminForHall.length) return oldestInPool(adminForHall);

    const unscopedAdmin = adminItems.filter((item) => !hallKey(item));
    if (unscopedAdmin.length) return oldestInPool(unscopedAdmin);

    const forHall = items.filter((item) => hallKey(item) === needle);
    // Approval creates the owner/Admin thread first; only use it when it is the sole hall row.
    if (forHall.length === 1) return forHall[0];
    return null;
  }

  return oldestInPool(adminItems);
}
