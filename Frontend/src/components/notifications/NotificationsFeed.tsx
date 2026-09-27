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
  const { items, openNotification } = useNotifications(audience);

  if (items.length === 0) {
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
    <ul className="seeker-notifications-feed seeker-notifications-feed--animated" data-testid="platform-notifications-feed">
      {items.map((item, index) => (
        <li key={item.id} style={{ ["--notify-i" as string]: index }}>
          <NotificationItem item={item} variant="feed" onOpen={openNotification} />
        </li>
      ))}
    </ul>
  );
}
