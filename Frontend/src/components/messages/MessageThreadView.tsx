"use client";

import MessageComposer from "@/components/messages/MessageComposer";
import ThreadMessageItem from "@/components/messages/ThreadMessageItem";
import { useRejectionArrival } from "@/hooks/useRejectionArrival";
import { useRetryingMessages } from "@/hooks/useRetryingMessages";
import { useThreadScroll } from "@/hooks/useThreadScroll";
import { useT } from "@/i18n";
import { isBookingRejectionContent } from "@/lib/booking-rejection-message";
import { isSameUserId } from "@/lib/current-user";
import type { MessageThread, ThreadStatus } from "@/types/messages";

type MessageThreadViewProps = {
  status: ThreadStatus;
  thread: MessageThread | null;
  error: string | null;
  title: string;
  subtitle?: string | null;
  currentUserId: string | null;
  onRetryLoad: () => void;
  onRetrySend: (messageId: string) => void;
  onSend: (text: string) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  composerEnabled: boolean;
  onBack?: () => void;
  composerId?: string;
  conversationId?: string | null;
  variant?: "page" | "widget";
};

export default function MessageThreadView({
  status,
  thread,
  error,
  title,
  subtitle,
  currentUserId,
  onRetryLoad,
  onRetrySend,
  onSend,
  draft,
  onDraftChange,
  composerEnabled,
  onBack,
  composerId = "inbox-message-draft",
  conversationId,
  variant = "page",
}: MessageThreadViewProps) {
  const t = useT();
  const messages = thread?.messages ?? [];
  const lastMessage = messages[messages.length - 1];
  const { scrollerRef, unseenCount, unseenRejection, onScroll, scrollToLatest } = useThreadScroll(
    conversationId ?? thread?.conversationId ?? null,
    messages.length,
    Boolean(lastMessage && isBookingRejectionContent(lastMessage.content)),
  );
  const arrivingId = useRejectionArrival(conversationId ?? thread?.conversationId ?? null, messages);
  const { markRetrying, isRetrying } = useRetryingMessages(messages);
  const showEmpty = (status === "empty" || status === "ready") && messages.length === 0;

  const widget = variant === "widget";

  return (
    <section
      className={`flex min-h-0 min-w-0 flex-1 flex-col ${widget ? "bg-[var(--wesal-pink)]" : "bg-white"}`}
      data-testid="message-thread"
    >
      <header
        className={`flex shrink-0 items-start gap-2 px-3 py-2.5 sm:px-4 sm:py-3 ${
          widget ? "border-b border-[var(--wesal-maroon)]/15" : "border-b border-[var(--wesal-border)]"
        }`}
      >
        {onBack ? (
          <button
            type="button"
            className={
              widget
                ? "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--wesal-maroon)]/45 bg-white text-[var(--wesal-maroon)] shadow-[0_4px_12px_rgba(193,123,127,0.16)] transition hover:border-[var(--wesal-maroon)] hover:bg-[var(--wesal-maroon)] hover:text-white"
                : "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--wesal-border)] text-[var(--wesal-maroon)]"
            }
            aria-label={t("messages.backToInbox")}
            onClick={onBack}
          >
            <BackIcon />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] font-semibold text-[var(--wesal-gold)]">{t("messages.title")}</p>
          <h2 className="mt-0.5 truncate text-base font-bold text-[var(--wesal-maroon)]">{title}</h2>
          {subtitle ? (
            <p className="truncate text-xs text-[var(--wesal-muted)]">{subtitle}</p>
          ) : null}
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          className={`absolute inset-0 space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 sm:px-4 sm:py-4 ${
            widget ? "bg-[var(--wesal-pink-soft)]" : "bg-[#fbf8f5]"
          }`}
          data-testid="message-thread-body"
          onScroll={onScroll}
        >
          {status === "idle" ? (
            <p className="px-2 py-10 text-center text-sm leading-7 text-[var(--wesal-muted)]">
              {t("messages.selectConversation")}
            </p>
          ) : null}

          {status === "loading" ? (
            <div aria-busy="true" data-testid="thread-loading">
              <span className="sr-only">{t("messages.threadLoading")}</span>
              <div className="space-y-3">
                <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-white" />
                <div className="ms-auto h-12 w-1/2 animate-pulse rounded-2xl bg-white" />
                <div className="h-12 w-3/5 animate-pulse rounded-2xl bg-white" />
              </div>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="px-2 py-10 text-center" data-testid="thread-error">
              <p className="text-sm leading-7 text-[var(--wesal-muted)]">{error ?? t("errors.thread.load")}</p>
              <button type="button" className="btn-outline mt-4" onClick={onRetryLoad}>
                {t("common.retry")}
              </button>
            </div>
          ) : null}

          {showEmpty ? (
            <p className="px-2 py-10 text-center text-sm leading-7 text-[var(--wesal-muted)]" data-testid="thread-empty">
              {t("messages.threadEmpty")}
            </p>
          ) : null}

          {status !== "loading" && status !== "error" && status !== "idle"
            ? messages.map((message) => (
                <ThreadMessageItem
                  key={message.id}
                  message={message}
                  own={isSameUserId(message.senderUserId, currentUserId)}
                  retrying={isRetrying(message)}
                  hallName={thread?.hallName ?? ""}
                  arriving={arrivingId === message.id}
                  onRetrySend={(id) => {
                    markRetrying(id);
                    onRetrySend(id);
                  }}
                />
              ))
            : null}
        </div>

        {unseenCount > 0 ? (
          <button
            type="button"
            className="absolute inset-x-0 bottom-3 z-10 mx-auto w-fit rounded-full border border-[var(--wesal-border)] bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-[var(--wesal-maroon)] shadow-[0_8px_20px_rgba(90,55,45,0.12)]"
            data-testid="thread-jump-latest"
            onClick={() => scrollToLatest(true)}
          >
            {unseenRejection ? t("messages.rejection.arrived") : t("messages.newBelow", { count: unseenCount })}
          </button>
        ) : null}
      </div>

      <MessageComposer
        id={composerId}
        value={draft}
        disabled={!composerEnabled}
        onChange={onDraftChange}
        onSend={onSend}
        variant={variant}
      />
    </section>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 rtl:rotate-180">
      <path
        d="M15 6 9 12l6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
