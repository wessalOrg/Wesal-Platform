"use client";

import { formatNotificationTime } from "@/lib/platform-notification-routes";
import type { PlatformNotification } from "@/types/platform-notification";

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
  const className =
    variant === "feed" ? "seeker-notifications-feed-item" : "seeker-notify-item";

  return (
    <button
      type="button"
      className={`${className} wesal-notify-item w-full text-start${
        item.is_read ? "" : " wesal-notify-item--unread"
      }`}
      data-testid={`platform-notification-${item.id}`}
      data-type={item.type}
      data-read={item.is_read ? "true" : "false"}
      onClick={() => onOpen(item)}
    >
      <span
        className={`seeker-notify-item-icon wesal-notify-tone--${item.tone}`}
        aria-hidden="true"
      >
        <BellMiniIcon />
      </span>
      <span className="seeker-notify-item-copy">
        <span className="seeker-notify-item-title">{item.title}</span>
        <span className="seeker-notify-item-body">{item.body}</span>
        {item.action_label ? (
          <span className="wesal-notify-item-action">{item.action_label}</span>
        ) : null}
        <span className="seeker-notifications-feed-time">
          {formatNotificationTime(item.created_at)}
        </span>
      </span>
    </button>
  );
}

function BellMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M7 10a5 5 0 0 1 10 0v2.6l1.1 1.9H5.9L7 12.6V10Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M10.2 17.5a1.8 1.8 0 0 0 3.6 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
