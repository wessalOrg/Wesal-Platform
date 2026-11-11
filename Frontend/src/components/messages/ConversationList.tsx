"use client";

import MabroukFigure from "@/components/brand/MabroukFigure";
import ConversationListItem from "@/components/messages/ConversationListItem";
import { useT } from "@/i18n";
import type { ConversationSummary, InboxStatus } from "@/types/messages";

type ConversationListProps = {
  status: InboxStatus;
  conversations: ConversationSummary[];
  selectedId: string | null;
  error: string | null;
  onSelect: (conversationId: string) => void;
  onRetry: () => void;
  variant?: "page" | "widget";
};

export default function ConversationList({
  status,
  conversations,
  selectedId,
  error,
  onSelect,
  onRetry,
  variant = "page",
}: ConversationListProps) {
  const t = useT();

  if (status === "idle" || status === "loading") {
    return (
      <div className="space-y-2 p-3" aria-busy="true" data-testid="inbox-list-loading">
        <span className="sr-only">{t("messages.listLoading")}</span>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={`h-16 animate-pulse rounded-2xl ${variant === "widget" ? "bg-white/70" : "bg-[var(--wesal-pink)]"}`} />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="px-4 py-8 text-center" data-testid="inbox-list-error">
        <p className="text-sm leading-7 text-[var(--wesal-muted)]">{error ?? t("errors.inbox.load")}</p>
        <button type="button" className="btn-outline mt-4" onClick={onRetry}>
          {t("common.retry")}
        </button>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="flex flex-col items-center px-5 py-10 text-center" data-testid="inbox-list-empty">
        <MabroukFigure
          pose="messageEmpty"
          size="md"
          rounded="2xl"
          className="mb-4 !h-32 !w-36 bg-transparent sm:!h-36 sm:!w-40"
        />
        <p className="text-sm font-semibold text-[var(--wesal-maroon)]">{t("messages.empty")}</p>
        <p className="mt-2 text-xs leading-6 text-[var(--wesal-muted)]">{t("messages.emptyHint")}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-1 p-2" data-testid="inbox-conversation-list">
      {conversations
        .filter((conversation) => conversation?.conversationId)
        .map((conversation) => (
        <li key={conversation.conversationId}>
          <ConversationListItem
            conversation={conversation}
            selected={conversation.conversationId === selectedId}
            variant={variant}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}
