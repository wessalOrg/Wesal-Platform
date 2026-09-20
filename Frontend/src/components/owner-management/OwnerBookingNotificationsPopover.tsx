"use client";

import { usePathname } from "next/navigation";
import AccountNotificationsPanel from "@/components/layout/AccountNotificationsPanel";
import { useDismissibleOverlay } from "@/hooks/useDismissibleOverlay";
import { useHallBookingRequests } from "@/hooks/useHallBookingRequests";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { parseOwnerHallIdFromPathname } from "@/lib/hall-owner-query-keys";
import { useT } from "@/i18n";

/**
 * Top-bar bell for incoming booking-request notifications (US-OWNER-09).
 * Prefers the hall from the current route; otherwise the first owned hall.
 */
export default function OwnerBookingNotificationsPopover() {
  const { halls } = useHallOwnerHalls();
  const pathname = usePathname();
  const routeHallId = parseOwnerHallIdFromPathname(pathname);
  const routeOwned =
    routeHallId && halls.some((hall) => hall.id === routeHallId)
      ? routeHallId
      : null;
  const hallId = routeOwned ?? halls[0]?.id ?? null;

  if (!hallId) {
    return <OwnerNotifyBellEmpty />;
  }

  return <OwnerNotifyBellWithHall hallId={hallId} />;
}

function OwnerNotifyBellEmpty() {
  const t = useT();
  return (
    <div className="seeker-notify-wrap">
      <button
        type="button"
        className="seeker-dash-notify"
        aria-label={t("owner.management.notifications.title")}
        data-testid="owner-notifications-trigger"
        disabled
      >
        <span className="seeker-dash-notify-bell" aria-hidden="true">
          <BellIcon />
        </span>
      </button>
    </div>
  );
}

function OwnerNotifyBellWithHall({ hallId }: { hallId: string }) {
  const t = useT();
  const { open, close, toggle, rootRef, panelId } = useDismissibleOverlay();
  const { requests } = useHallBookingRequests(hallId);
  const hasPending = requests.some((item) => item.status === "Pending");

  return (
    <div ref={rootRef} className="seeker-notify-wrap">
      <button
        type="button"
        className={`seeker-dash-notify${open ? " seeker-dash-notify--open" : ""}${
          hasPending ? " seeker-dash-notify--has-unread" : ""
        }`}
        aria-label={t("owner.management.notifications.title")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-testid="owner-notifications-trigger"
        onClick={toggle}
      >
        <span className="seeker-dash-notify-bell" aria-hidden="true">
          <BellIcon />
        </span>
        {hasPending ? <span className="seeker-notify-dot" aria-hidden="true" /> : null}
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
      <path
        d="M10 18.5a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
