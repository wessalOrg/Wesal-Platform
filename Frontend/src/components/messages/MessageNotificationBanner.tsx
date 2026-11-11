"use client";

import { useEffect } from "react";
import { useT } from "@/i18n";
import { formatRelativeTime } from "@/lib/relative-time";
import { conversationAvatarInitials } from "@/lib/conversation-display";
import { formatUnreadCount } from "@/lib/unread-badge";

export type MessageNotificationPayload = {
  conversationId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  preview: string;
  sentAt: string;
  messageCount: number;
};

type MessageNotificationBannerProps = {
  item: MessageNotificationPayload | null;
  onOpen: (item: MessageNotificationPayload) => void;
  onClose: () => void;
  durationMs?: number;
};

/** Rich new-message toast: avatar, name, preview, time — tap opens the thread. */
export default function MessageNotificationBanner({
  item,
  onOpen,
  onClose,
  durationMs = 6500,
}: MessageNotificationBannerProps) {
  const t = useT();

  useEffect(() => {
    if (!item) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, item, onClose]);

  if (!item) return null;

  const countLabel = formatUnreadCount(item.messageCount);
  const time = formatRelativeTime(item.sentAt);

  return (
    <div
      className="wesal-message-toast fixed bottom-[6.5rem] start-4 end-4 z-[80] flex w-auto max-w-[22rem] items-start gap-3 rounded-2xl border border-[var(--wesal-border)] bg-white px-3 py-3 text-start shadow-[0_16px_40px_rgba(90,55,45,0.18)] sm:bottom-8 sm:end-auto sm:w-[min(22rem,calc(100vw-2rem))]"
      data-testid="message-notification-banner"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-3 text-start"
        onClick={() => onOpen(item)}
      >
        <span className="relative mt-0.5 h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[var(--wesal-maroon)] text-xs font-bold text-white">
          {item.senderAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.senderAvatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              {conversationAvatarInitials(item.senderName)}
            </span>
          )}
          {countLabel && item.messageCount > 1 ? (
            <span className="absolute -end-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c62828] px-1 text-[0.65rem] font-bold text-white">
              {countLabel}
            </span>
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline justify-between gap-2">
            <span className="truncate text-sm font-bold text-[var(--wesal-maroon)]">
              {item.senderName || t("common.user")}
            </span>
            {time ? (
              <span className="shrink-0 text-[0.65rem] text-[var(--wesal-muted)]">{time}</span>
            ) : null}
          </span>
          <span className="mt-0.5 line-clamp-2 text-xs leading-5 text-[var(--wesal-text)]">
            {item.preview || t("messages.previewEmpty")}
          </span>
          <span className="mt-1 text-[0.65rem] font-semibold text-[var(--wesal-gold)]">
            {t("messages.notification.open")}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="ms-1 mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--wesal-muted)]"
        aria-label={t("common.close")}
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
}
