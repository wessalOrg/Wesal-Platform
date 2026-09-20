"use client";

import AccountNotificationsPanel from "@/components/layout/AccountNotificationsPanel";
import { SEEKER_NOTIFICATIONS } from "@/constants/seekerNotifications";
import { useDismissibleOverlay } from "@/hooks/useDismissibleOverlay";
import { useT } from "@/i18n";

/**
 * Dashboard notifications bell — same feed as the public navbar bell.
 */
export default function SeekerNotificationsPopover() {
  const t = useT();
  const { open, close, toggle, rootRef, panelId } = useDismissibleOverlay();
  const hasPreview = SEEKER_NOTIFICATIONS.length > 0;

  return (
    <div ref={rootRef} className="seeker-notify-wrap">
      <button
        type="button"
        className={`seeker-dash-notify${open ? " seeker-dash-notify--open" : ""}${
          hasPreview ? " seeker-dash-notify--has-unread" : ""
        }`}
        aria-label={t("nav.notifications")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-testid="seeker-notifications-trigger"
        onClick={toggle}
      >
        <span className="seeker-dash-notify-bell" aria-hidden="true">
          <BellIcon />
        </span>
        {hasPreview ? <span className="seeker-notify-dot" aria-hidden="true" /> : null}
      </button>

      <AccountNotificationsPanel open={open} onClose={close} panelId={panelId} />
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
