"use client";

import AdminMessageListItem from "@/components/admin/messages/AdminMessageListItem";
import { useT } from "@/i18n";
import type { AdminMessageItem } from "@/types/admin-messages";
import type { InboxStatus } from "@/types/messages";

type EmptyReason = "all" | "conversation" | "payment_notice" | "search" | null;

type AdminMessageListProps = {
  status: InboxStatus;
  items: AdminMessageItem[];
  selectedId: string | null;
  error: string | null;
  emptyReason: EmptyReason;
  onSelect: (item: AdminMessageItem) => void;
  onRetry: () => void;
};

function emptyMessageKey(reason: EmptyReason): string {
  if (reason === "search") return "admin.messages.empty.search";
  if (reason === "conversation") return "admin.messages.empty.conversations";
  if (reason === "payment_notice") return "admin.messages.empty.paymentNotices";
  return "admin.messages.empty.all";
}

export default function AdminMessageList({
  status,
  items,
  selectedId,
  error,
  emptyReason,
  onSelect,
  onRetry,
}: AdminMessageListProps) {
  const t = useT();

  if (status === "idle" || status === "loading") {
    return (
      <div className="space-y-2 p-3" aria-busy="true" data-testid="admin-message-list-loading">
        <span className="sr-only">{t("messages.listLoading")}</span>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-16 animate-pulse rounded-2xl bg-[var(--wesal-pink)]"
          />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="px-4 py-8 text-center" data-testid="admin-message-list-error">
        <p className="text-sm leading-7 text-[var(--wesal-muted)]">
          {error ?? t("errors.inbox.load")}
        </p>
        <button type="button" className="btn-outline mt-4" onClick={onRetry}>
          {t("common.retry")}
        </button>
      </div>
    );
  }

  if (status === "empty" || items.length === 0) {
    return (
      <div className="px-5 py-10 text-center" data-testid="admin-message-list-empty">
        <p className="text-sm font-semibold text-[var(--wesal-maroon)]">
          {t(emptyMessageKey(emptyReason))}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1" data-testid="admin-message-list">
      {items.map((item) => (
        <li key={item.id}>
          <AdminMessageListItem
            item={item}
            selected={item.id === selectedId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}
