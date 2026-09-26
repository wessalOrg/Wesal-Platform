/**
 * Admin Messages (Edit 15) — unified inbox categories.
 * Extensible: future categories can be added without rewriting the page.
 */
export type AdminMessageCategory = "conversation" | "payment_notice";

export type AdminMessageFilter = "all" | AdminMessageCategory;

export type AdminMessageItem = {
  /** Stable list key: conversation id, or `hall:{hallId}` for hall-scoped notices. */
  id: string;
  category: AdminMessageCategory;
  hallId: string;
  hallName: string;
  ownerName: string;
  conversationId: string | null;
  preview: string;
  lastMessageAt: string | null;
  createdAt: string;
  /** True when the source API marks the thread unread (when available). */
  isUnread: boolean;
};

export type AdminMessageFilterCounts = Record<AdminMessageFilter, number>;
