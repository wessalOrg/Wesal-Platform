"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import NotificationItem from "@/components/notifications/NotificationItem";
import SeekerAcceptedBookingNotices from "@/components/bookings/SeekerAcceptedBookingNotices";
import { SEEKER_NOTIFICATIONS_PATH } from "@/constants/seekerDashboardNav";
import { useNotifications } from "@/hooks/useNotifications";
import { useT } from "@/i18n";
import { formatUnreadCount } from "@/lib/unread-badge";
import {
  matchesNotificationFilter,
  type NotificationAudience,
  type NotificationFilter,
} from "@/types/platform-notification";

type NotificationsDropdownProps = {
  audience?: NotificationAudience;
  onClose: () => void;
  panelId: string;
  viewAllHref?: string;
  subtitle?: string;
  /** Include seeker accepted-booking local notices in the "all" tab. */
  includeBookingNotices?: boolean;
};

/** Figma notifications popup: unread badge, category chips, tap-to-open rows. */
export default function NotificationsDropdown({
  audience = "seeker",
  onClose,
  panelId,
  viewAllHref = SEEKER_NOTIFICATIONS_PATH,
  subtitle,
  includeBookingNotices = audience === "seeker",
}: NotificationsDropdownProps) {
  const t = useT();
  const { items, unreadCount, openNotification } = useNotifications(audience);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const unreadLabel = formatUnreadCount(unreadCount);

  const visible = useMemo(
    () => items.filter((item) => matchesNotificationFilter(item, filter)).slice(0, 8),
    [filter, items],
  );

  return (
    <div
      id={panelId}
      role="dialog"
      aria-label={t("notifications.title")}
      className="seeker-notify-panel"
      data-testid="account-notifications-panel"
    >
      <div className="seeker-notify-panel-head">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="seeker-notify-panel-title">{t("notifications.title")}</p>
            {unreadLabel ? (
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c62828] px-1 text-[0.65rem] font-bold text-white"
                data-testid="notifications-dropdown-unread"
              >
                {unreadLabel}
              </span>
            ) : null}
          </div>
          <p className="seeker-notify-panel-sub">
            {subtitle ?? t("nav.notificationsHint")}
          </p>
        </div>
        <button
          type="button"
          className="seeker-notify-panel-close"
          aria-label={t("common.close")}
          data-testid="account-notifications-close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div
        className="flex gap-1.5 overflow-x-auto border-b border-[var(--wesal-border)] px-3 py-2"
        role="tablist"
        aria-label={t("notifications.filters.label")}
      >
        {(
          [
            ["all", "notifications.filters.all"],
            ["offers", "notifications.filters.offers"],
            ["requests", "notifications.filters.requests"],
            ["system", "notifications.filters.system"],
          ] as const
        ).map(([id, labelKey]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-3 py-2 text-[0.7rem] font-bold transition ${
              filter === id
                ? "bg-[var(--wesal-maroon)] text-white"
                : "bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)]"
            }`}
            onClick={() => setFilter(id)}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      <ul className="seeker-notify-list">
        {includeBookingNotices && filter === "all" ? (
          <SeekerAcceptedBookingNotices limit={3} onOpened={onClose} />
        ) : null}
        {visible.length === 0 ? (
          <li className="seeker-notify-empty">{t("notifications.empty")}</li>
        ) : (
          visible.map((item) => (
            <li key={item.id}>
              <NotificationItem
                item={item}
                onOpen={(next) => {
                  openNotification(next);
                  onClose();
                }}
              />
            </li>
          ))
        )}
      </ul>

      <div className="seeker-notify-panel-foot">
        <Link
          href={viewAllHref}
          className="seeker-notify-view-all"
          data-testid="account-notifications-view-all"
          onClick={onClose}
        >
          {t("seeker.notifications.viewAll")}
        </Link>
      </div>
    </div>
  );
}
