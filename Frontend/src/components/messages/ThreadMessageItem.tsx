"use client";

import BookingRejectionCard from "@/components/messages/BookingRejectionCard";
import { useBookingRejectionMessage } from "@/hooks/useBookingRejectionMessage";
import { useT } from "@/i18n";
import { formatRelativeTime } from "@/lib/relative-time";
import type { ThreadMessage } from "@/types/messages";

type ThreadMessageItemProps = {
  message: ThreadMessage;
  own: boolean;
  retrying: boolean;
  hallName: string;
  arriving?: boolean;
  onRetrySend: (messageId: string) => void;
};

export default function ThreadMessageItem({
  message,
  own,
  retrying,
  hallName,
  arriving = false,
  onRetrySend,
}: ThreadMessageItemProps) {
  const classified = useBookingRejectionMessage(message.content, hallName);

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
    <ThreadBubble message={message} own={own} retrying={retrying} onRetrySend={onRetrySend} />
  );
}

function ThreadBubble({
  message,
  own,
  retrying,
  onRetrySend,
}: {
  message: ThreadMessage;
  own: boolean;
  retrying: boolean;
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
        {own ? null : (
          <p className="mb-1 truncate text-[0.68rem] text-[var(--wesal-muted)]">{message.senderName}</p>
        )}
        <div
          className={
            own
              ? `overflow-hidden rounded-2xl rounded-ee-md bg-[var(--wesal-maroon)] px-3.5 py-2.5 text-[0.82rem] leading-6 break-words whitespace-pre-wrap [overflow-wrap:anywhere] text-white shadow-[0_6px_16px_rgba(193,123,127,0.28)] ${pending ? "opacity-70" : ""}`
              : "overflow-hidden rounded-2xl rounded-es-md border border-[var(--wesal-border)] bg-white px-3.5 py-2.5 text-[0.82rem] leading-6 break-words whitespace-pre-wrap [overflow-wrap:anywhere] text-[var(--wesal-text)]"
          }
        >
          {message.content}
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
            {formatRelativeTime(message.sentAt)}
          </p>
        )}
      </div>
    </article>
  );
}
