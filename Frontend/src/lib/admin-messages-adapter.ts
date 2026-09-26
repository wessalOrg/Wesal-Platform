import { classifyAdminMessageCategory } from "@/lib/admin-message-category";
import type {
  AdminMessageFilter,
  AdminMessageFilterCounts,
  AdminMessageItem,
} from "@/types/admin-messages";
import type {
  AdminPaymentStatus,
  AdminSubscriptionOwnerGroup,
} from "@/types/admin-halls";
import type { ConversationSummary } from "@/types/messages";

function hallScopedId(hallId: string): string {
  return `hall:${hallId}`;
}

function needsPaymentAttention(
  paymentStatus: AdminPaymentStatus,
  systemLocked: boolean,
): boolean {
  return systemLocked || paymentStatus === "Unpaid" || paymentStatus === "ReceiptUploaded";
}

export function conversationToAdminMessageItem(
  conversation: ConversationSummary,
  isUnread = false,
): AdminMessageItem {
  return {
    id: conversation.conversationId,
    category: classifyAdminMessageCategory(conversation.lastMessagePreview),
    hallId: conversation.hallId,
    hallName: conversation.hallName,
    ownerName: conversation.otherParticipantName,
    conversationId: conversation.conversationId,
    preview: conversation.lastMessagePreview,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    isUnread,
  };
}

/**
 * Build a payment-notice row from subscription overview when the hall needs
 * payment attention and has no inbox conversation yet.
 */
export function subscriptionHallToPaymentNoticeItem(input: {
  hallId: string;
  hallName: string;
  ownerName: string;
  preview: string;
  lastMessageAt?: string | null;
  conversationId?: string | null;
}): AdminMessageItem {
  return {
    id: input.conversationId || hallScopedId(input.hallId),
    category: "payment_notice",
    hallId: input.hallId,
    hallName: input.hallName,
    ownerName: input.ownerName,
    conversationId: input.conversationId ?? null,
    preview: input.preview,
    lastMessageAt: input.lastMessageAt ?? null,
    createdAt: input.lastMessageAt ?? new Date(0).toISOString(),
    isUnread: false,
  };
}

/**
 * Single source list: inbox conversations + subscription halls that need
 * payment attention and are not already represented.
 */
export function buildAdminMessageItems(
  conversations: ConversationSummary[],
  subscriptionGroups: AdminSubscriptionOwnerGroup[],
  paymentNoticePreview: string,
): AdminMessageItem[] {
  const attentionByHall = new Map<
    string,
    {
      hallId: string;
      ownerName: string;
      hallName: string;
      nextBillingDate: string | null;
    }
  >();

  for (const group of subscriptionGroups) {
    const ownerName = (group.ownerFullName ?? "").trim();
    for (const hall of group.halls) {
      if (!needsPaymentAttention(hall.paymentStatus, hall.systemLocked)) continue;
      attentionByHall.set(hall.hallId.toLowerCase(), {
        hallId: hall.hallId,
        ownerName,
        hallName: hall.name,
        nextBillingDate: hall.nextBillingDate,
      });
    }
  }

  const fromInbox = conversations.map((conversation) => {
    const base = conversationToAdminMessageItem(conversation);
    const attention = attentionByHall.get(conversation.hallId.toLowerCase());
    if (!attention) return base;

    return {
      ...base,
      category: "payment_notice" as const,
      ownerName: base.ownerName.trim() || attention.ownerName,
      preview: base.preview.trim() || paymentNoticePreview,
    };
  });

  const coveredHalls = new Set(
    fromInbox.map((item) => item.hallId.toLowerCase()).filter(Boolean),
  );

  const extras: AdminMessageItem[] = [];
  for (const [hallKey, attention] of attentionByHall) {
    if (coveredHalls.has(hallKey)) continue;
    extras.push(
      subscriptionHallToPaymentNoticeItem({
        hallId: attention.hallId,
        hallName: attention.hallName,
        ownerName: attention.ownerName,
        preview: paymentNoticePreview,
        lastMessageAt: attention.nextBillingDate,
      }),
    );
  }

  return [...fromInbox, ...extras].sort((left, right) => {
    const leftAt = Date.parse(left.lastMessageAt ?? left.createdAt) || 0;
    const rightAt = Date.parse(right.lastMessageAt ?? right.createdAt) || 0;
    return rightAt - leftAt;
  });
}

export function filterAdminMessages(
  items: AdminMessageItem[],
  filter: AdminMessageFilter,
  query: string,
): AdminMessageItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => {
    if (filter !== "all" && item.category !== filter) return false;
    if (!normalizedQuery) return true;
    const haystack = [item.hallName, item.ownerName, item.preview]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function countAdminMessageFilters(
  items: AdminMessageItem[],
): AdminMessageFilterCounts {
  let conversation = 0;
  let payment_notice = 0;
  for (const item of items) {
    if (item.category === "conversation") conversation += 1;
    else payment_notice += 1;
  }
  return {
    all: items.length,
    conversation,
    payment_notice,
  };
}
