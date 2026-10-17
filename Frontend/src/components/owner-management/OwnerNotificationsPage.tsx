"use client";

import NotificationsFeed from "@/components/notifications/NotificationsFeed";
import { useT } from "@/i18n";

/** Every platform notification for the signed-in hall owner. */
export default function OwnerNotificationsPage() {
  const t = useT();

  return (
    <div className="seeker-notifications-page" data-testid="owner-notifications-page">
      <header className="seeker-settings-header">
        <h1 className="seeker-settings-title">{t("owner.nav.notifications")}</h1>
        <p className="seeker-settings-lead">{t("owner.notifications.feedSubtitle")}</p>
      </header>

      <section className="seeker-settings-card">
        <NotificationsFeed
          audience="owner"
          emptyKey="owner.notifications.feedEmpty"
        />
      </section>
    </div>
  );
}
