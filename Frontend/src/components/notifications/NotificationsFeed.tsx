"use client";

import NotificationItem from "@/components/notifications/NotificationItem";
import { useNotifications } from "@/hooks/useNotifications";
import { useT } from "@/i18n";
import type { NotificationAudience } from "@/types/platform-notification";

type NotificationsFeedProps = {
  audience?: NotificationAudience;
  emptyKey?: string;
  hideEmpty?: boolean;
};

export default function NotificationsFeed({
  audience,
  emptyKey = "notifications.empty",
  hideEmpty = false,
}: NotificationsFeedProps) {
  const t = useT();
  const { items, openNotification, unreadCount, markAllRead, totalCount, hasMore, loading, error, loadMore, retry } = useNotifications(audience);

  if (items.length === 0 && !loading && !error && !hasMore) {
    if (hideEmpty) return null;
    return (
      <p
        className="seeker-notify-empty"
        data-testid={audience === "seeker" ? "seeker-notifications-empty" : "platform-notifications-empty"}
      >
        {t(emptyKey)}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {totalCount !== null ? <p className="text-sm text-[var(--wesal-muted)]" data-testid="notifications-total">
        {t("notifications.pagination.total", { count: totalCount })}
      </p> : null}
      {unreadCount > 0 ? (
        <div className="flex justify-end">
          <button
            type="button"
            className="text-xs font-bold text-[var(--wesal-maroon)]"
            onClick={markAllRead}
          >
            {t("notifications.markAllRead")}
          </button>
        </div>
      ) : null}
      <ul
        className="space-y-3 seeker-notifications-feed seeker-notifications-feed--animated"
        data-testid="platform-notifications-feed"
        aria-busy={loading}
      >
        {items.map((item, index) => (
          <li key={item.id} style={{ ["--notify-i" as string]: index }}>
            <NotificationItem item={item} variant="feed" onOpen={openNotification} />
          </li>
        ))}
      </ul>
      {error ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-[#b42318]">
        <span>{t("notifications.pagination.loadFailed")}</span>
        <button type="button" className="btn-outline" disabled={loading} onClick={retry} data-testid="notifications-retry">{t("notifications.pagination.retry")}</button>
      </div> : null}
      {loading ? <p role="status" className="text-sm text-[var(--wesal-muted)]">{t("notifications.pagination.loading")}</p> : null}
      {hasMore ? <div className="flex justify-center">
        <button type="button" className="btn-outline min-h-11" disabled={loading} aria-busy={loading}
          onClick={loadMore} data-testid="notifications-load-more">{t("notifications.pagination.loadMore")}</button>
      </div> : null}
    </div>
  );
}
