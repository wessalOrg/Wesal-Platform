"use client";

import { usePathname } from "next/navigation";
import AccountNotificationsPanel from "@/components/layout/AccountNotificationsPanel";
import { useDismissibleOverlay } from "@/hooks/useDismissibleOverlay";
import { useHallBookingRequests } from "@/hooks/useHallBookingRequests";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { useNotifications } from "@/hooks/useNotifications";
import { parseOwnerHallIdFromPathname } from "@/lib/hall-owner-query-keys";
import { useT } from "@/i18n";

/**
 * Top-bar bell for owner platform notices + incoming booking requests.
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

  return <OwnerNotifyBell hallId={hallId} />;
}

function OwnerNotifyBell({ hallId }: { hallId: string | null }) {
  const t = useT();
  const { open, close, toggle, rootRef, panelId } = useDismissibleOverlay();
  const { unreadCount } = useNotifications("owner");
  const { requests } = useHallBookingRequests(hallId ?? "");
  const pendingCount = requests.filter((item) => item.status === "Pending").length;
  const badgeCount = unreadCount + pendingCount;
  const hasUnread = badgeCount > 0;

  return (
    <div ref={rootRef} className="seeker-notify-wrap">
      <button
        type="button"
        className={`seeker-dash-notify${open ? " seeker-dash-notify--open" : ""}${
          hasUnread ? " seeker-dash-notify--has-unread" : ""
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
        {hasUnread ? (
          <span className="seeker-notify-badge" aria-hidden="true">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        ) : null}
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
