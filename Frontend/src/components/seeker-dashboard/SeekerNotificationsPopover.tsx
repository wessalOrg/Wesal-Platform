"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SEEKER_NOTIFICATIONS_PATH } from "@/constants/seekerDashboardNav";
import { SEEKER_NOTIFICATIONS } from "@/constants/seekerNotifications";
import { useT } from "@/i18n";

export default function SeekerNotificationsPopover() {
  const t = useT();
  const pathname = usePathname();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const previewItems = SEEKER_NOTIFICATIONS.slice(0, 3);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="seeker-notify-wrap">
      <button
        type="button"
        className={`seeker-dash-notify${open ? " seeker-dash-notify--open" : ""}${
          previewItems.length > 0 ? " seeker-dash-notify--has-unread" : ""
        }`}
        aria-label={t("nav.notifications")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        data-testid="seeker-notifications-trigger"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="seeker-dash-notify-bell" aria-hidden="true">
          <BellIcon />
        </span>
        {previewItems.length > 0 ? (
          <span className="seeker-notify-dot" aria-hidden="true" />
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={t("notifications.title")}
          className="seeker-notify-panel"
          data-testid="seeker-notifications-panel"
        >
          <div className="seeker-notify-panel-head">
            <div className="min-w-0">
              <p className="seeker-notify-panel-title">{t("notifications.title")}</p>
              <p className="seeker-notify-panel-sub">{t("nav.notificationsHint")}</p>
            </div>
            <button
              type="button"
              className="seeker-notify-panel-close"
              aria-label={t("common.close")}
              data-testid="seeker-notifications-close"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>

          <ul className="seeker-notify-list">
            {previewItems.length === 0 ? (
              <li className="seeker-notify-empty">{t("notifications.empty")}</li>
            ) : (
              previewItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="seeker-notify-item"
                    data-testid={`seeker-notification-${item.id}`}
                    onClick={() => setOpen(false)}
                  >
                    <span className="seeker-notify-item-icon" aria-hidden="true">
                      <BellMiniIcon />
                    </span>
                    <span className="seeker-notify-item-copy">
                      <span className="seeker-notify-item-title">{t(item.titleKey)}</span>
                      <span className="seeker-notify-item-body">{t(item.bodyKey)}</span>
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>

          <div className="seeker-notify-panel-foot">
            <Link
              href={SEEKER_NOTIFICATIONS_PATH}
              className="seeker-notify-view-all"
              data-testid="seeker-notifications-view-all"
              onClick={() => setOpen(false)}
            >
              {t("seeker.notifications.viewAll")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path
        d="M6.5 9.5a5.5 5.5 0 0 1 11 0v3.2l1.3 2.3H5.2l1.3-2.3V9.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
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
