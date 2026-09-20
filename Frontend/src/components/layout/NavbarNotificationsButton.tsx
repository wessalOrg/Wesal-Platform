"use client";

import AccountNotificationsPanel from "@/components/layout/AccountNotificationsPanel";
import { SEEKER_NOTIFICATIONS } from "@/constants/seekerNotifications";
import { useDismissibleOverlay } from "@/hooks/useDismissibleOverlay";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { useT } from "@/i18n";

/**
 * Navbar notifications bell — sits beside the language switcher.
 */
export default function NavbarNotificationsButton() {
  const t = useT();
  const identity = useUserIdentity();
  const { open, close, toggle, rootRef, panelId } = useDismissibleOverlay();
  const hasPreview =
    !identity.isHallOwner && SEEKER_NOTIFICATIONS.length > 0;

  if (!identity.authenticated) return null;

  return (
    <div ref={rootRef} className="seeker-notify-wrap wesal-navbar-notify">
      <button
        type="button"
        className={`seeker-dash-notify wesal-navbar-notify-btn${
          open ? " seeker-dash-notify--open" : ""
        }${hasPreview ? " seeker-dash-notify--has-unread" : ""}`}
        aria-label={t("nav.notifications")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-testid="navbar-notifications-trigger"
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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[1.2rem] w-[1.2rem]"
      aria-hidden="true"
    >
      <path d="M7.2 9.6a4.8 4.8 0 0 1 9.6 0c0 4.2 1.35 5.4 1.35 5.4H5.85S7.2 13.8 7.2 9.6Z" />
      <path d="M10.35 18.4a1.65 1.65 0 0 0 3.3 0" />
    </svg>
  );
}
