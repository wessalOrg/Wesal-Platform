"use client";

import { useMemo, useState } from "react";
import SeekerAcceptedBookingNotices from "@/components/bookings/SeekerAcceptedBookingNotices";
import NotificationItem from "@/components/notifications/NotificationItem";
import { useNotifications } from "@/hooks/useNotifications";
import { useUserBookings } from "@/hooks/useUserBookings";
import { useT } from "@/i18n";
import { formatUnreadCount } from "@/lib/unread-badge";
import {
  matchesNotificationFilter,
  type NotificationFilter,
} from "@/types/platform-notification";

/** Full notifications center inside the seeker / professional dashboard shell. */
export default function SeekerNotificationsPage() {
  const t = useT();
  const { bookings } = useUserBookings();
  const hasAccepted = bookings.some((item) => item.status === "Accepted");
  const { items, unreadCount, markAllRead, openNotification } = useNotifications("seeker");
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const unreadLabel = formatUnreadCount(unreadCount);

  const visible = useMemo(
    () => items.filter((item) => matchesNotificationFilter(item, filter)),
    [filter, items],
  );

  return (
    <div className="seeker-notifications-page" data-testid="seeker-notifications-page">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="seeker-settings-title">{t("seeker.nav.notifications")}</h1>
            {unreadLabel ? (
              <span
                className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--wesal-maroon)] px-1.5 text-xs font-bold text-white"
                data-testid="notifications-page-unread"
                aria-label={t("messages.unreadCount", { count: unreadCount })}
              >
                {unreadLabel}
              </span>
            ) : null}
          </div>
          <p className="seeker-settings-lead">{t("seeker.notifications.subtitle")}</p>
        </div>
        {unreadCount > 0 ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wesal-pink-soft)] px-3 py-2 text-xs font-bold text-[var(--wesal-maroon)] transition hover:bg-[var(--wesal-pink)]"
            data-testid="notifications-mark-all-read"
            onClick={markAllRead}
          >
            <CheckMiniIcon />
            {t("notifications.markAllRead")}
          </button>
        ) : null}
      </header>

      <div
        className="mt-4 flex flex-wrap gap-2"
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
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              filter === id
                ? "bg-[var(--wesal-maroon)] text-white"
                : "bg-white text-[var(--wesal-maroon)] ring-1 ring-[var(--wesal-border)] hover:bg-[var(--wesal-pink-soft)]"
            }`}
            onClick={() => setFilter(id)}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      <section className="mt-5 space-y-3">
        {filter === "all" ? (
          <ul className="seeker-notifications-feed seeker-notifications-feed--animated space-y-3">
            <SeekerAcceptedBookingNotices />
          </ul>
        ) : null}

        {visible.length === 0 && !(filter === "all" && hasAccepted) ? (
          <p
            className="rounded-2xl border border-dashed border-[var(--wesal-border)] bg-white px-4 py-10 text-center text-sm text-[var(--wesal-muted)]"
            data-testid="seeker-notifications-empty"
          >
            {t("seeker.notifications.empty")}
          </p>
        ) : (
          <ul
            className="space-y-3"
            data-testid="platform-notifications-feed"
          >
            {visible.map((item) => (
              <li key={item.id}>
                <NotificationItem item={item} variant="feed" onOpen={openNotification} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CheckMiniIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="m3.5 8.2 2.7 2.7 6.3-6.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
