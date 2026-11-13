"use client";

import { conversationAvatarInitials } from "@/lib/conversation-display";
import { formatNotificationTime } from "@/lib/platform-notification-routes";
import type { PlatformNotification, PlatformNotificationTone } from "@/types/platform-notification";

type NotificationItemProps = {
  item: PlatformNotification;
  variant?: "panel" | "feed";
  onOpen: (item: PlatformNotification) => void;
};

export default function NotificationItem({
  item,
  variant = "panel",
  onOpen,
}: NotificationItemProps) {
  const isMessage = item.type === "new_message";
  const avatarUrl = item.metadata.sender_avatar_url?.trim() || null;
  const senderName = item.metadata.sender_name?.trim() || item.title;
  const count = Number(item.metadata.message_count || 0);
  const unread = !item.is_read;
  const feed = variant === "feed";

  return (
    <button
      type="button"
      className={`wesal-notify-item group relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-2xl border text-start transition ${
        feed
          ? "border-[var(--wesal-border)] bg-white px-4 py-3.5 shadow-[0_6px_18px_rgba(90,55,45,0.05)] hover:border-[var(--wesal-maroon)]/30"
          : "seeker-notify-item border-transparent bg-white px-3 py-2.5 hover:bg-[var(--wesal-pink-soft)]"
      } ${unread ? "wesal-notify-item--unread bg-[var(--wesal-pink-soft)]" : ""}`}
      data-testid={`platform-notification-${item.id}`}
      data-type={item.type}
      data-read={unread ? "false" : "true"}
      onClick={() => onOpen(item)}
    >
      {isMessage ? (
        <span
          className="col-start-1 row-span-2 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--wesal-maroon)] text-xs font-bold text-white"
          aria-hidden="true"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            conversationAvatarInitials(senderName)
          )}
        </span>
      ) : (
        <span
          className={`col-start-1 row-span-2 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${toneSurface(item.tone)}`}
          aria-hidden="true"
        >
          <NotificationTypeIcon type={item.type} tone={item.tone} />
        </span>
      )}

      <span className="col-start-2 row-start-1 min-w-0">
        <span className="block truncate text-sm font-bold leading-5 text-[var(--wesal-maroon-dark)]">
          {isMessage ? senderName : item.title}
          {isMessage && count > 1 ? ` · ${count}` : ""}
        </span>
      </span>

      <span className="col-start-3 row-start-1 flex shrink-0 items-center gap-1.5 self-start pt-0.5">
        <span className="whitespace-nowrap text-[0.65rem] leading-none text-[var(--wesal-muted)]">
          {formatNotificationTime(item.created_at)}
        </span>
        {unread ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-[#c62828]"
            aria-hidden="true"
            data-testid="notification-unread-dot"
          />
        ) : feed ? (
          <ChevronIcon />
        ) : null}
      </span>

      <span className="col-start-2 col-end-4 row-start-2 min-w-0">
        <span className="line-clamp-2 block text-xs leading-5 text-[var(--wesal-muted)]">
          {item.body}
        </span>
        {item.action_label ? (
          <span className="wesal-notify-item-action mt-1 inline-block text-[0.7rem] font-bold text-[var(--wesal-maroon)]">
            {item.action_label}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function toneSurface(tone: PlatformNotificationTone): string {
  if (tone === "success") return "bg-[#e8f6ee] text-[#1f7a45]";
  if (tone === "danger") return "bg-[#fdecee] text-[#b42318]";
  if (tone === "warning") return "bg-[#fff4df] text-[#b47912]";
  return "bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)]";
}

function NotificationTypeIcon({
  type,
  tone,
}: {
  type: PlatformNotification["type"];
  tone: PlatformNotificationTone;
}) {
  switch (type) {
    case "account_needs_edit":
    case "offer_edits_saved":
    case "post_edits_saved":
      return <PencilIcon />;
    case "account_rejected":
      return <CloseIcon />;
    case "post_deleted":
    case "offer_deleted":
      return <TrashIcon />;
    case "offer_published":
      return <MegaphoneIcon />;
    case "account_approved":
    case "account_unlocked":
      return <CheckIcon />;
    case "offer_ending_soon":
      return <ClockIcon />;
    case "offer_stopped":
      return <PauseIcon />;
    case "publishing_restricted":
    case "account_locked":
      return <LockIcon />;
    case "new_message":
      return <MailIcon />;
    case "post_comment":
    case "post_comment_reply":
      return <ChatIcon />;
    default:
      return tone === "success" ? <CheckIcon /> : <BellIcon />;
  }
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[var(--wesal-muted)] rtl:rotate-180" fill="none" aria-hidden="true">
      <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M7 10a5 5 0 0 1 10 0v2.6l1.1 1.9H5.9L7 12.6V10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10.2 17.5a1.8 1.8 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="m6.5 12.5 3.2 3.2 7.8-7.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="m4.5 15.5 9.7-9.7a2 2 0 0 1 2.8 2.8L7.3 18.3 4 19.2l.5-3.7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M4 10v4h2l8 4V6L6 10H4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M18 9.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8.5V12l2.5 1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M9 7.5v9M15 7.5v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M5 7h14M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7m-7.5 0 .7 11.2A1.8 1.8 0 0 0 10 20h4a1.8 1.8 0 0 0 1.8-1.8L16.5 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <rect x="5.5" y="10" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.5 10V8a3.5 3.5 0 0 1 7 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="m5 8 7 5 7-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8l-5 3V7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
