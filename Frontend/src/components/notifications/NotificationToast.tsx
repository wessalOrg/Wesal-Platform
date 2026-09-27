"use client";

import { useEffect } from "react";
import { useT } from "@/i18n";
import type { PlatformNotification } from "@/types/platform-notification";

type NotificationToastProps = {
  item: PlatformNotification | null;
  onAction: (item: PlatformNotification) => void;
  onClose: () => void;
  durationMs?: number;
};

export default function NotificationToast({
  item,
  onAction,
  onClose,
  durationMs = 6200,
}: NotificationToastProps) {
  const t = useT();

  useEffect(() => {
    if (!item) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, item, onClose]);

  if (!item) return null;

  return (
    <div
      className={`wesal-notify-toast wesal-notify-toast--${item.tone}`}
      role="status"
      aria-live="polite"
      data-testid="platform-notification-toast"
      data-type={item.type}
    >
      <span className={`wesal-notify-toast-icon wesal-notify-tone--${item.tone}`} aria-hidden="true">
        <BellMiniIcon />
      </span>
      <div className="wesal-notify-toast-copy">
        <p className="wesal-notify-toast-title">{item.title}</p>
        <p className="wesal-notify-toast-body">{item.body}</p>
        {item.action_label ? (
          <button
            type="button"
            className="wesal-notify-toast-action"
            data-testid="platform-notification-toast-action"
            onClick={() => onAction(item)}
          >
            {item.action_label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="wesal-notify-toast-close"
        aria-label={t("common.close")}
        onClick={onClose}
      >
        ✕
      </button>
    </div>
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
      <path d="M10.2 17.5a1.8 1.8 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
