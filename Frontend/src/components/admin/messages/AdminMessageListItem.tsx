"use client";

import AdminMessageAvatar from "@/components/admin/messages/AdminMessageAvatar";
import AdminMessageTypeBadge from "@/components/admin/messages/AdminMessageTypeBadge";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { conversationListPreview } from "@/lib/conversation-display";
import { localizeHallName } from "@/lib/localize-hall-display";
import type { AdminMessageItem } from "@/types/admin-messages";

type AdminMessageListItemProps = {
  item: AdminMessageItem;
  selected: boolean;
  onSelect: (item: AdminMessageItem) => void;
};

function formatListTime(iso: string | null, locale: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
  }).format(date);
}

export default function AdminMessageListItem({
  item,
  selected,
  onSelect,
}: AdminMessageListItemProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const title =
    localizeHallName(item.hallId, item.hallName, lang).trim() ||
    item.ownerName.trim() ||
    t("common.hall");
  const preview =
    conversationListPreview(item.preview) ||
    item.preview.trim() ||
    t("messages.previewEmpty");
  const time = formatListTime(item.lastMessageAt ?? item.createdAt, locale);

  return (
    <button
      type="button"
      className={`flex w-full min-w-0 items-start gap-3 rounded-2xl px-3 py-3 text-start transition ${
        selected
          ? "bg-[#f8e9ea]"
          : "bg-white hover:bg-[var(--wesal-pink)]/60"
      }`}
      aria-current={selected ? "true" : undefined}
      aria-label={
        item.isUnread
          ? t("admin.messages.item.unreadLabel", { name: title })
          : title
      }
      data-testid="admin-message-item"
      data-item-id={item.id}
      data-category={item.category}
      onClick={() => onSelect(item)}
    >
      <AdminMessageAvatar name={title} size="sm" />

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-start justify-between gap-2">
          <span className="truncate text-sm font-bold text-[var(--wesal-text)]">{title}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            {time ? (
              <span className="text-[0.68rem] text-[var(--wesal-muted)]">{time}</span>
            ) : null}
            {item.isUnread ? (
              <span
                className="h-2 w-2 rounded-full bg-[#c62828]"
                aria-hidden="true"
              />
            ) : null}
          </span>
        </span>

        <span className="mt-1 flex min-w-0 items-center gap-1.5">
          <AdminMessageTypeBadge category={item.category} />
        </span>

        <span className="mt-1 line-clamp-1 text-xs leading-5 text-[var(--wesal-muted)]">
          {preview}
        </span>
      </span>
    </button>
  );
}
