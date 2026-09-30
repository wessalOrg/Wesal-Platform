"use client";

import { useState } from "react";
import BookingRejectionCard from "@/components/messages/BookingRejectionCard";
import ChatImageLightbox from "@/components/messages/ChatImageLightbox";
import SubscriptionExpiryWarningCard from "@/components/messages/SubscriptionExpiryWarningCard";
import { useBookingRejectionMessage } from "@/hooks/useBookingRejectionMessage";
import { useMessageAttachment } from "@/hooks/useMessageAttachment";
import { useSubscriptionExpiryWarningMessage } from "@/hooks/useSubscriptionExpiryWarningMessage";
import { useT } from "@/i18n";
import { isChatImageUrl, paymentReceiptNoticeCaption, safeMessageText } from "@/lib/chat-image-message";
import { formatRelativeTime } from "@/lib/relative-time";
import type { ThreadMessage } from "@/types/messages";

type ThreadMessageItemProps = {
  message: ThreadMessage;
  own: boolean;
  retrying: boolean;
  hallId?: string | null;
  hallName: string;
  conversationId?: string | null;
  arriving?: boolean;
  tone?: "default" | "owner";
  onRetrySend: (messageId: string) => void;
};

export default function ThreadMessageItem({
  message,
  own,
  retrying,
  hallName,
  conversationId,
  arriving = false,
  tone = "default",
  onRetrySend,
}: ThreadMessageItemProps) {
  const classified = useBookingRejectionMessage(safeMessageText(message?.content), hallName ?? "");
  const expiryWarning = useSubscriptionExpiryWarningMessage(safeMessageText(message?.content), hallName ?? "");

  if (expiryWarning.kind === "subscription_expiry_warning") {
    return (
      <SubscriptionExpiryWarningCard
        details={expiryWarning.details}
        sentAt={message.sentAt}
        originalContent={message.content}
        arriving={arriving}
      />
    );
  }

  if (classified.kind === "booking_rejection") {
    return (
      <BookingRejectionCard
        details={classified.details}
        sentAt={message.sentAt}
        originalContent={message.content}
        arriving={arriving}
      />
    );
  }

  return (
    <ThreadBubble
      message={message}
      own={own}
      retrying={retrying}
      tone={tone}
      conversationId={conversationId}
      onRetrySend={onRetrySend}
    />
  );
}

function ThreadBubble({
  message,
  own,
  retrying,
  tone = "default",
  conversationId,
  onRetrySend,
}: {
  message: ThreadMessage;
  own: boolean;
  retrying: boolean;
  tone?: "default" | "owner";
  conversationId?: string | null;
  onRetrySend: (messageId: string) => void;
}) {
  const t = useT();
  const pending = message.delivery === "pending";
  const failed = message.delivery === "failed";

  return (
    <article
      className={`flex min-w-0 ${own ? "justify-end" : "justify-start"}`}
      data-testid="thread-message"
      data-own={own ? "true" : "false"}
      data-delivery={retrying ? "retrying" : message.delivery}
    >
      <div className={`min-w-0 max-w-[85%] ${own ? "ms-8" : "me-6"}`}>
        {own || tone === "owner" ? null : (
          <p className="mb-1 truncate text-[0.68rem] text-[var(--wesal-muted)]">{message.senderName}</p>
        )}
        <div
          className={
            tone === "owner"
              ? own
                ? `owner-chat-bubble is-own ${pending ? "opacity-70" : ""}`
                : "owner-chat-bubble"
              : own
                ? `overflow-hidden rounded-2xl rounded-ee-md bg-[var(--wesal-maroon)] px-3.5 py-2.5 text-[0.82rem] leading-6 break-words whitespace-pre-wrap [overflow-wrap:anywhere] text-white shadow-[0_6px_16px_rgba(193,123,127,0.28)] ${pending ? "opacity-70" : ""}`
                : "overflow-hidden rounded-2xl rounded-es-md border border-[var(--wesal-border)] bg-white px-3.5 py-2.5 text-[0.82rem] leading-6 break-words whitespace-pre-wrap [overflow-wrap:anywhere] text-[var(--wesal-text)]"
          }
        >
          <ThreadBubbleBody message={message} conversationId={conversationId} />
        </div>
        {pending ? (
          <p className={`mt-1 text-[0.65rem] text-[var(--wesal-muted)] ${own ? "text-end" : "text-start"}`}>
            {retrying ? t("messages.retrying") : t("messages.sending")}
          </p>
        ) : failed ? (
          <div className={`mt-1 flex items-center gap-2 ${own ? "justify-end" : "justify-start"}`}>
            <p className="text-[0.65rem] text-[#a86267]">{t("messages.sendFailed")}</p>
            <button
              type="button"
              className="text-[0.65rem] font-semibold text-[var(--wesal-maroon)] underline"
              onClick={() => onRetrySend(message.clientRequestId || message.id)}
            >
              {t("messages.retrySend")}
            </button>
          </div>
        ) : (
          <p className={`mt-1 text-[0.65rem] text-[var(--wesal-muted)] ${own ? "text-end" : "text-start"}`}>
            {tone === "owner" ? formatClock(message.sentAt) : formatRelativeTime(message.sentAt)}
          </p>
        )}
      </div>
    </article>
  );
}

function ThreadBubbleBody({
  message,
  conversationId,
}: {
  message: ThreadMessage;
  conversationId?: string | null;
}) {
  const text = safeMessageText(message?.content);
  const caption = message.hasAttachment
    ? text.trim()
    : paymentReceiptNoticeCaption(text) || text;

  if (message.hasAttachment || message.localPreviewUrl) {
    return (
      <ChatAttachmentBubble
        conversationId={conversationId ?? null}
        messageId={message.id}
        rawUrl={message.attachmentUrl}
        localPreviewUrl={message.localPreviewUrl}
        caption={caption}
      />
    );
  }

  if (isChatImageUrl(text)) {
    return <ChatImageBubble src={text.trim()} />;
  }

  return text;
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function ChatAttachmentBubble({
  conversationId,
  messageId,
  rawUrl,
  localPreviewUrl,
  caption,
}: {
  conversationId: string | null;
  messageId: string;
  rawUrl?: string | null;
  localPreviewUrl?: string | null;
  caption: string;
}) {
  const t = useT();
  const remote = useMessageAttachment(
    conversationId,
    messageId.startsWith("local:") ? null : messageId,
    Boolean(conversationId) && !messageId.startsWith("local:"),
    rawUrl,
  );
  const src = localPreviewUrl || remote.url;

  return (
    <div className="space-y-2">
      {src ? (
        <ChatImageBubble src={src} />
      ) : remote.status === "error" ? (
        <p>{t("messages.imagePreview")}</p>
      ) : (
        <p>{t("messages.imagePreview")}</p>
      )}
      {caption ? <p>{caption}</p> : null}
    </div>
  );
}

function ChatImageBubble({ src }: { src: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="-mx-1 -my-1 block overflow-hidden rounded-xl"
        onClick={() => setOpen(true)}
        data-testid="chat-image-thumb"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- remote / uploaded chat image */}
        <img src={src} alt={t("messages.imagePreview")} className="max-h-56 w-full object-cover" />
      </button>
      {open ? (
        <ChatImageLightbox src={src} alt={t("messages.imageLightbox")} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
