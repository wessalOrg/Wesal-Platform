"use client";

import SeekerAcceptedBookingNotices from "@/components/bookings/SeekerAcceptedBookingNotices";
import NotificationsFeed from "@/components/notifications/NotificationsFeed";
import { useUserBookings } from "@/hooks/useUserBookings";
import { useT } from "@/i18n";

/** Full notifications list inside the seeker dashboard shell. */
export default function SeekerNotificationsPage() {
  const t = useT();
  const { bookings } = useUserBookings();
  const hasAccepted = bookings.some((item) => item.status === "Accepted");

  return (
    <div className="seeker-notifications-page" data-testid="seeker-notifications-page">
      <header className="seeker-settings-header">
        <h1 className="seeker-settings-title">{t("seeker.nav.notifications")}</h1>
        <p className="seeker-settings-lead">{t("seeker.notifications.subtitle")}</p>
      </header>

      <section className="seeker-settings-card">
        <ul className="seeker-notifications-feed seeker-notifications-feed--animated">
          <SeekerAcceptedBookingNotices />
        </ul>
        <NotificationsFeed audience="seeker" hideEmpty={hasAccepted} />
      </section>
    </div>
  );
}
