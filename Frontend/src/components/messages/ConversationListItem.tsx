"use client";

import { useT } from "@/i18n";
import { formatRelativeTime } from "@/lib/relative-time";
import { conversationListPreview, conversationPreviewSubtitle, conversationPreviewTitle } from "@/lib/conversation-display";
import type { ConversationSummary } from "@/types/messages";

type ConversationListItemProps = {
  conversation: ConversationSummary;
  selected: boolean;
  variant?: "page" | "widget";
  onSelect: (conversationId: string) => void;
};

export default function ConversationListItem({
  conversation,
  selected,
  variant = "page",
  onSelect,
}: ConversationListItemProps) {
  const t = useT();
  const title = conversationPreviewTitle(conversation);
  const subtitle = conversationPreviewSubtitle(conversation);
  const preview = conversationListPreview(conversation.lastMessagePreview);
  const time = formatRelativeTime(conversation.lastMessageAt ?? conversation.createdAt);

  return (
    <button
      type="button"
      className={`flex w-full min-w-0 flex-col gap-0.5 rounded-2xl px-3 py-3 text-start transition ${
        selected
          ? variant === "widget"
            ? "bg-white shadow-[0_6px_16px_rgba(90,55,45,0.08)]"
            : "bg-[var(--wesal-pink)]"
          : variant === "widget"
            ? "hover:bg-white/80"
            : "hover:bg-[var(--wesal-pink)]/70"
      }`}
      aria-current={selected ? "true" : undefined}
      data-testid="inbox-conversation"
      data-conversation-id={conversation.conversationId}
      onClick={() => onSelect(conversation.conversationId)}
    >
      <span className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold text-[var(--wesal-maroon)]">{title}</span>
        {time ? (
          <span className="shrink-0 text-[0.68rem] text-[var(--wesal-muted)]">{time}</span>
        ) : null}
      </span>
      {subtitle ? (
        <span className="truncate text-[0.7rem] text-[var(--wesal-muted)]">{subtitle}</span>
      ) : null}
      <span className="line-clamp-2 text-xs leading-5 text-[var(--wesal-text)]">
        {preview || t("messages.previewEmpty")}
      </span>
    </button>
  );
}
