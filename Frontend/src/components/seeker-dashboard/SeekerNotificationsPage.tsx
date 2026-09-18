"use client";

import Link from "next/link";
import { SEEKER_NOTIFICATIONS } from "@/constants/seekerNotifications";
import { useT } from "@/i18n";

/** Full notifications list inside the seeker dashboard shell. */
export default function SeekerNotificationsPage() {
  const t = useT();
  const items = SEEKER_NOTIFICATIONS;

  return (
    <div className="seeker-notifications-page" data-testid="seeker-notifications-page">
      <header className="seeker-settings-header">
        <h1 className="seeker-settings-title">{t("seeker.nav.notifications")}</h1>
        <p className="seeker-settings-lead">{t("seeker.notifications.subtitle")}</p>
      </header>

      <section className="seeker-settings-card">
        {items.length === 0 ? (
          <p className="seeker-notify-empty" data-testid="seeker-notifications-empty">
            {t("notifications.empty")}
          </p>
        ) : (
          <ul className="seeker-notifications-feed seeker-notifications-feed--animated" data-testid="seeker-notifications-feed">
            {items.map((item, index) => (
              <li
                key={item.id}
                style={{ ["--notify-i" as string]: index }}
              >
                <Link
                  href={item.href}
                  className="seeker-notifications-feed-item"
                  data-testid={`seeker-notifications-page-${item.id}`}
                >
                  <span className="seeker-notify-item-icon" aria-hidden="true">
                    <BellMiniIcon />
                  </span>
                  <span className="seeker-notify-item-copy">
                    <span className="seeker-notify-item-title">{t(item.titleKey)}</span>
                    <span className="seeker-notify-item-body">{t(item.bodyKey)}</span>
                    <span className="seeker-notifications-feed-time">{t(item.timeKey)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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
