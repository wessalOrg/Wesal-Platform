"use client";

import { useMemo, useState } from "react";
import MabroukFigure from "@/components/brand/MabroukFigure";
import ConversationListItem from "@/components/messages/ConversationListItem";
import { useT } from "@/i18n";
import { isAdminAccountConversation } from "@/lib/admin-account-conversation";
import { formatUnreadCount } from "@/lib/unread-badge";
import type { ConversationSummary, InboxStatus } from "@/types/messages";

type InboxFilter = "customers" | "admin";

type ProfessionalInboxListProps = {
  status: InboxStatus;
  conversations: ConversationSummary[];
  selectedId: string | null;
  error: string | null;
  focusAdmin?: boolean;
  onSelect: (conversationId: string) => void;
  onRetry: () => void;
};

export default function ProfessionalInboxList({
  status,
  conversations,
  selectedId,
  error,
  focusAdmin = false,
  onSelect,
  onRetry,
}: ProfessionalInboxListProps) {
  const t = useT();
  const [filter, setFilter] = useState<InboxFilter>(focusAdmin ? "admin" : "customers");
  const [previousFocusAdmin, setPreviousFocusAdmin] = useState(focusAdmin);

  if (focusAdmin !== previousFocusAdmin) {
    setPreviousFocusAdmin(focusAdmin);
    if (focusAdmin) setFilter("admin");
  }

  const rows = useMemo(
    () => conversations.filter((item) => item?.conversationId),
    [conversations],
  );
  const customerRows = rows.filter((item) => !isAdminAccountConversation(item));
  const adminRows = rows.filter((item) => isAdminAccountConversation(item));
  const totalUnread = rows.reduce(
    (sum, item) => sum + Math.max(item.unreadMessageCount || 0, item.isUnread ? 1 : 0),
    0,
  );
  const totalUnreadLabel = formatUnreadCount(totalUnread);
  const visible = filter === "admin" ? adminRows : customerRows;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="professional-chat-inbox">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--wesal-border)] px-4 py-3">
        <h2 className="text-base font-bold text-[var(--wesal-maroon)]">{t("messages.title")}</h2>
        {totalUnreadLabel ? (
          <span
            className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#c62828] px-1.5 text-[0.7rem] font-bold text-white"
            data-testid="professional-chat-unread-total"
            aria-label={t("messages.unreadCount", { count: totalUnread })}
          >
            {totalUnreadLabel}
          </span>
        ) : null}
      </div>

      <div
        className="flex gap-2 overflow-x-auto border-b border-[var(--wesal-border)] px-3 py-2"
        role="tablist"
        aria-label={t("messages.title")}
      >
        <FilterChip
          active={filter === "customers"}
          label={t("messages.professional.filterCustomers")}
          count={customerRows.length}
          onClick={() => setFilter("customers")}
        />
        <FilterChip
          active={filter === "admin"}
          label={t("messages.professional.filterAdmin")}
          count={adminRows.length}
          onClick={() => setFilter("admin")}
        />
      </div>

      {status === "idle" || status === "loading" ? (
        <div className="space-y-2 p-3" aria-busy="true" data-testid="inbox-list-loading">
          <span className="sr-only">{t("messages.listLoading")}</span>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-[var(--wesal-pink)]" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="px-4 py-8 text-center" data-testid="inbox-list-error">
          <p className="text-sm leading-7 text-[var(--wesal-muted)]">
            {error ?? t("errors.inbox.load")}
          </p>
          <button type="button" className="btn-outline mt-4" onClick={onRetry}>
            {t("common.retry")}
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-10 text-center" data-testid="inbox-list-empty">
          <MabroukFigure
            pose="messageEmpty"
            size="md"
            rounded="2xl"
            className="mb-4 !h-32 !w-36 bg-transparent sm:!h-36 sm:!w-40"
          />
          <p className="text-sm font-semibold text-[var(--wesal-maroon)]">
            {filter === "admin" ? t("messages.professional.adminEmpty") : t("messages.empty")}
          </p>
          <p className="mt-2 text-xs leading-6 text-[var(--wesal-muted)]">
            {filter === "admin"
              ? t("messages.professional.adminEmptyHint")
              : t("messages.emptyHint")}
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2" data-testid="inbox-conversation-list">
          {visible.map((conversation) => (
            <li key={conversation.conversationId}>
              <ConversationListItem
                conversation={conversation}
                selected={conversation.conversationId === selectedId}
                variant="page"
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`min-h-11 shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-[var(--wesal-maroon)] text-white"
          : "bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)] hover:bg-[var(--wesal-pink)]"
      }`}
      onClick={onClick}
    >
      {label}
      <span className="ms-1 opacity-80">({count})</span>
    </button>
  );
}
