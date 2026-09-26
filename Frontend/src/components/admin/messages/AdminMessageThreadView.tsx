"use client";

import AdminMessageAvatar from "@/components/admin/messages/AdminMessageAvatar";
import AdminMessageComposer from "@/components/admin/messages/AdminMessageComposer";
import AdminMessageTypeBadge from "@/components/admin/messages/AdminMessageTypeBadge";
import AdminPaymentNoticeCard from "@/components/admin/messages/AdminPaymentNoticeCard";
import ThreadMessageItem from "@/components/messages/ThreadMessageItem";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useRejectionArrival } from "@/hooks/useRejectionArrival";
import { useRetryingMessages } from "@/hooks/useRetryingMessages";
import { useThreadScroll } from "@/hooks/useThreadScroll";
import { useT } from "@/i18n";
import { classifyAdminMessageCategory } from "@/lib/admin-message-category";
import { isBookingRejectionContent } from "@/lib/booking-rejection-message";
import { conversationHallLabel } from "@/lib/conversation-display";
import { isSameUserId } from "@/lib/current-user";
import { parseSubscriptionExpiryWarningMessage } from "@/lib/subscription-expiry-warning-message";
import type { AdminMessageCategory } from "@/types/admin-messages";
import type { MessageThread, ThreadMessage, ThreadStatus } from "@/types/messages";

type AdminMessageThreadViewProps = {
  status: ThreadStatus;
  thread: MessageThread | null;
  error: string | null;
  title: string;
  subtitle?: string | null;
  category: AdminMessageCategory;
  currentUserId: string | null;
  onRetryLoad: () => void;
  onRetrySend: (messageId: string) => void;
  onSend: (text: string) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  composerEnabled: boolean;
  onBack?: () => void;
  conversationId?: string | null;
};

function dayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDayLabel(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function paymentCardCopy(message: ThreadMessage, hallName: string, fallbackTitle: string) {
  const parsed = parseSubscriptionExpiryWarningMessage(message.content, hallName);
  if (parsed.kind === "subscription_expiry_warning") {
    return {
      title: fallbackTitle,
      body: parsed.details.text || message.content,
    };
  }
  const text = message.content.trim();
  const firstLine = text.split(/\n/)[0]?.trim() || fallbackTitle;
  const rest = text.slice(firstLine.length).trim();
  return {
    title: firstLine.length > 80 ? fallbackTitle : firstLine,
    body: rest || text,
  };
}

export default function AdminMessageThreadView({
  status,
  thread,
  error,
  title,
  subtitle,
  category,
  currentUserId,
  onRetryLoad,
  onRetrySend,
  onSend,
  draft,
  onDraftChange,
  composerEnabled,
  onBack,
  conversationId,
}: AdminMessageThreadViewProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const localizedHallName = thread ? conversationHallLabel(thread, lang) : title;
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
  const paymentTitle = t("admin.messages.paymentNotice.cardTitle");

  const timeline = messages.map((message, index) => {
    const key = dayKey(message.sentAt);
    const prevKey = index > 0 ? dayKey(messages[index - 1]!.sentAt) : "";
    return {
      message,
      showDay: Boolean(key && key !== prevKey),
      isPayment:
        classifyAdminMessageCategory(message.content, message.senderUserId) ===
        "payment_notice",
    };
  });

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-white"
      data-testid="admin-message-thread"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-[var(--wesal-border)] px-3 py-3 sm:px-4">
        {onBack ? (
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--wesal-border)] text-[var(--wesal-maroon)] md:hidden"
            aria-label={t("messages.backToInbox")}
            onClick={onBack}
          >
            <BackIcon />
          </button>
        ) : null}

        <AdminMessageAvatar name={title} />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-bold text-[var(--wesal-text)]">{title}</h2>
            <AdminMessageTypeBadge category={category} />
          </div>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-[var(--wesal-muted)]">{subtitle}</p>
          ) : null}
        </div>

        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--wesal-muted)] hover:bg-[var(--wesal-pink)]"
          aria-label={t("admin.messages.thread.more")}
        >
          <MoreIcon />
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          className="absolute inset-0 space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain bg-[#fbf8f5] px-3 py-4 sm:px-4"
          data-testid="admin-message-thread-body"
          onScroll={onScroll}
        >
          {status === "loading" ? (
            <div aria-busy="true" data-testid="thread-loading">
              <span className="sr-only">{t("messages.threadLoading")}</span>
              <div className="space-y-3">
                <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-white" />
                <div className="ms-auto h-12 w-1/2 animate-pulse rounded-2xl bg-white" />
              </div>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="px-2 py-10 text-center" data-testid="thread-error">
              <p className="text-sm leading-7 text-[var(--wesal-muted)]">
                {error ?? t("errors.thread.load")}
              </p>
              <button type="button" className="btn-outline mt-4" onClick={onRetryLoad}>
                {t("common.retry")}
              </button>
            </div>
          ) : null}

          {showEmpty ? (
            <p
              className="px-2 py-10 text-center text-sm leading-7 text-[var(--wesal-muted)]"
              data-testid="thread-empty"
            >
              {t("messages.threadEmpty")}
            </p>
          ) : null}

          {status !== "loading" && status !== "error" && status !== "idle"
            ? timeline.map(({ message, showDay, isPayment }) => {
                const copy = isPayment
                  ? paymentCardCopy(message, localizedHallName, paymentTitle)
                  : null;

                return (
                  <div key={message.id} className="space-y-3">
                    {showDay ? (
                      <div
                        className="flex items-center gap-3 py-1"
                        data-testid="admin-message-day-separator"
                      >
                        <span className="h-px flex-1 bg-[var(--wesal-border)]" />
                        <span className="shrink-0 text-[0.72rem] font-medium text-[var(--wesal-muted)]">
                          {formatDayLabel(message.sentAt, locale)}
                        </span>
                        <span className="h-px flex-1 bg-[var(--wesal-border)]" />
                      </div>
                    ) : null}

                    {isPayment && copy ? (
                      <AdminPaymentNoticeCard
                        title={copy.title}
                        body={copy.body}
                        sentAt={message.sentAt}
                      />
                    ) : (
                      <ThreadMessageItem
                        message={message}
                        own={isSameUserId(message.senderUserId, currentUserId)}
                        retrying={isRetrying(message)}
                        hallName={localizedHallName}
                        arriving={arrivingId === message.id}
                        onRetrySend={(id) => {
                          markRetrying(id);
                          onRetrySend(id);
                        }}
                      />
                    )}
                  </div>
                );
              })
            : null}
        </div>

        {unseenCount > 0 ? (
          <button
            type="button"
            className="absolute inset-x-0 bottom-3 z-10 mx-auto w-fit rounded-full border border-[var(--wesal-border)] bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-[var(--wesal-maroon)] shadow-[0_8px_20px_rgba(90,55,45,0.12)]"
            onClick={() => scrollToLatest(true)}
          >
            {unseenRejection
              ? t("messages.rejection.arrived")
              : t("messages.newBelow", { count: unseenCount })}
          </button>
        ) : null}
      </div>

      <AdminMessageComposer
        id="admin-messages-draft"
        value={draft}
        disabled={!composerEnabled}
        onChange={onDraftChange}
        onSend={onSend}
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

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}
