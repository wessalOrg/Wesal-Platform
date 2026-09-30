"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import {
  conversationAvatarInitials,
  conversationHallLabel,
  conversationListPreview,
  conversationPreviewTitle,
} from "@/lib/conversation-display";
import { isOwnerAdminConversation } from "@/lib/owner-admin-conversation";
import type { ConversationSummary, InboxStatus } from "@/types/messages";

type InboxFilter = "all" | "users" | "admin";

type OwnerInboxListProps = {
  status: InboxStatus;
  conversations: ConversationSummary[];
  selectedId: string | null;
  error: string | null;
  focusAdmin: boolean;
  onSelect: (conversationId: string) => void;
  onRetry: () => void;
};

export default function OwnerInboxList({
  status,
  conversations,
  selectedId,
  error,
  focusAdmin,
  onSelect,
  onRetry,
}: OwnerInboxListProps) {
  const t = useT();
  const lang = useUiLang();
  const [filter, setFilter] = useState<InboxFilter>(focusAdmin ? "admin" : "all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (focusAdmin) setFilter("admin");
  }, [focusAdmin]);

  const rows = useMemo(
    () => conversations.filter((item) => item?.conversationId),
    [conversations],
  );
  const userRows = rows.filter((item) => !isOwnerAdminConversation(item, rows));
  const adminRows = rows.filter((item) => isOwnerAdminConversation(item, rows));
  const unreadCount = rows.filter((item) => item.isUnread).length;
  const needle = query.trim().toLowerCase();
  const visible = (filter === "users" ? userRows : filter === "admin" ? adminRows : rows).filter(
    (item) => {
      if (!needle) return true;
      const title = conversationPreviewTitle(item, lang).toLowerCase();
      const hall = conversationHallLabel(item, lang).toLowerCase();
      const preview = conversationListPreview(
        item.lastMessagePreview,
        Boolean(item.lastMessageHasAttachment),
      ).toLowerCase();
      return title.includes(needle) || hall.includes(needle) || preview.includes(needle);
    },
  );

  return (
    <div className="owner-chat-inbox" data-testid="owner-chat-inbox">
      <div className="owner-chat-inbox-head">
        <h1 className="owner-chat-inbox-title">{t("owner.nav.messages")}</h1>
        {unreadCount > 0 ? (
          <span className="owner-chat-unread" data-testid="owner-chat-unread">
            {unreadCount}
          </span>
        ) : null}
      </div>

      <div className="owner-chat-filters" role="tablist" aria-label={t("owner.nav.messages")}>
        <FilterChip
          active={filter === "all"}
          label={t("owner.messages.filterAll")}
          count={rows.length}
          onClick={() => setFilter("all")}
        />
        <FilterChip
          active={filter === "users"}
          label={t("owner.messages.users")}
          count={userRows.length}
          onClick={() => setFilter("users")}
        />
        <FilterChip
          active={filter === "admin"}
          label={t("owner.messages.admin")}
          count={adminRows.length}
          onClick={() => setFilter("admin")}
        />
      </div>

      <label className="owner-chat-search">
        <SearchIcon />
        <span className="sr-only">{t("owner.messages.search")}</span>
        <input
          type="search"
          value={query}
          placeholder={t("owner.messages.search")}
          data-testid="owner-chat-search"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {status === "idle" || status === "loading" ? (
        <div className="space-y-2 p-3" aria-busy="true" data-testid="inbox-list-loading">
          <span className="sr-only">{t("messages.listLoading")}</span>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-[var(--wesal-pink)]" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="px-4 py-8 text-center" data-testid="inbox-list-error">
          <p className="text-sm leading-7 text-[var(--wesal-muted)]">{error ?? t("errors.inbox.load")}</p>
          <button type="button" className="btn-outline mt-4" onClick={onRetry}>
            {t("common.retry")}
          </button>
        </div>
      ) : visible.length === 0 ? (
        <p className="owner-chat-empty" data-testid="owner-chat-empty">
          {rows.length === 0 ? t("messages.empty") : t("owner.messages.noMatches")}
        </p>
      ) : (
        <ul className="owner-chat-rows" data-testid="inbox-conversation-list">
          {visible.map((conversation) => {
            const title = conversationPreviewTitle(conversation, lang);
            const preview = conversationListPreview(
              conversation.lastMessagePreview,
              Boolean(conversation.lastMessageHasAttachment),
            );
            const selected = conversation.conversationId === selectedId;
            const admin = isOwnerAdminConversation(conversation, rows);
            return (
              <li key={conversation.conversationId}>
                <button
                  type="button"
                  className={`owner-chat-row${selected ? " is-selected" : ""}`}
                  aria-current={selected ? "true" : undefined}
                  data-testid="inbox-conversation"
                  data-conversation-id={conversation.conversationId}
                  onClick={() => onSelect(conversation.conversationId)}
                >
                  <span
                    className={`owner-chat-avatar${admin ? " is-admin" : ""}`}
                    aria-hidden="true"
                  >
                    {conversationAvatarInitials(title)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-bold text-[var(--wesal-text)]">{title}</span>
                      <span className="shrink-0 text-[0.68rem] text-[var(--wesal-muted)]">
                        {formatInboxStamp(conversation.lastMessageAt ?? conversation.createdAt)}
                      </span>
                    </span>
                    <span className="mt-1 flex items-start gap-2">
                      <span className="line-clamp-1 min-w-0 flex-1 text-xs leading-5 text-[var(--wesal-muted)]">
                        {preview || t("messages.previewEmpty")}
                      </span>
                      {conversation.isUnread && !selected ? (
                        <span className="owner-chat-unread" data-testid="inbox-unread-badge">
                          1
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function OwnerChatHallCard({
  hallId,
  hallName,
}: {
  hallId: string;
  hallName: string;
}) {
  const t = useT();
  const name = hallName.trim();
  if (!name) return null;

  return (
    <div className="owner-chat-hall" data-testid="owner-chat-hall">
      <span className="owner-chat-hall-mark" aria-hidden="true">
        {conversationAvatarInitials(name)}
      </span>
      <p className="owner-chat-hall-name">{name}</p>
      {hallId ? (
        <Link
          href={`/halls/${encodeURIComponent(hallId)}`}
          className="owner-chat-hall-link"
        >
          {t("owner.messages.viewHall")}
        </Link>
      ) : null}
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
      className={`owner-chat-filter${active ? " is-active" : ""}`}
      onClick={onClick}
    >
      {label}
      <span>({count})</span>
    </button>
  );
}

function formatInboxStamp(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16 16.5 20 20.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
