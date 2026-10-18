import { t } from "@/i18n";
import { conversationPreviewTitle } from "@/lib/conversation-display";
import type { UiLang } from "@/lib/language";
import { conversationTimeValue } from "@/lib/conversation-mapper";
import type { ConversationSummary } from "@/types/messages";

const ADMIN_NAME =
  /^(الإدارة|ادارة|إدارة المنصة|إدارة وصال|Admin|Administrator|Wesal Admin|مشرف)(\b|$)/i;

const PLATFORM_PARTICIPANT_ID = /^(system|admin)$/i;

function hallKey(item: ConversationSummary): string {
  return (item.hallId ?? "").trim().toLowerCase();
}

function participantKey(item: ConversationSummary): string {
  return (item.otherParticipantId ?? "").trim().toLowerCase();
}

/**
 * True when this inbox row is the owner ↔ Admin thread, not a seeker chat.
 * A booker's deposit receipt, or the same seeker writing about more than one hall,
 * must keep that seeker's own name.
 */
export function isOwnerAdminConversation(
  item: ConversationSummary,
  _allItems: ConversationSummary[] = [],
): boolean {
  if (PLATFORM_PARTICIPANT_ID.test(participantKey(item))) return true;
  // Only the counterparty's own name. A booking receipt or a seeker message must not
  // be relabeled "إدارة وصال" because the latest preview happens to mention the platform.
  return ADMIN_NAME.test((item.otherParticipantName ?? "").trim());
}

/**
 * Title shown to a hall owner for a conversation. Messages from the platform admins
 * always appear under the administration's name, never under the individual admin's.
 */
export function ownerConversationTitle(
  item: ConversationSummary,
  lang: UiLang,
  allItems: ConversationSummary[] = [],
): string {
  if (isOwnerAdminConversation(item, allItems)) return t("owner.messages.admin");
  return conversationPreviewTitle(item, lang);
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
