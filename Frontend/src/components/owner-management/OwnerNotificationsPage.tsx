"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUiLang } from "@/components/layout/LanguageProvider";
import NotificationsFeed from "@/components/notifications/NotificationsFeed";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { useT } from "@/i18n";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { bookingWhenLabels } from "@/lib/booking-when-label";
import { ownerHallNotificationsPath } from "@/lib/hall-owner-query-keys";
import { fetchOwnerHallBookingRequests } from "@/services/owner-hall-booking-requests";
import type { OwnerHallBookingRequest } from "@/types/owner-hall-booking-requests";

function isOpenRequest(status: OwnerHallBookingRequest["status"]): boolean {
  return status === "Pending" || status === "Accepted";
}

/** Live alerts plus the booking requests still waiting on the owner. */
export default function OwnerNotificationsPage() {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const { halls } = useHallOwnerHalls();
  const hallKey = halls.map((hall) => `${hall.id}\u0000${hall.name}`).join("\n");
  const [requests, setRequests] = useState<OwnerHallBookingRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  useEffect(() => {
    const owned = hallKey
      ? hallKey.split("\n").map((row) => {
          const [id, name] = row.split("\u0000");
          return { id, name };
        })
      : [];
    if (owned.length === 0) {
      setRequests([]);
      setLoadingRequests(false);
      return;
    }

    let active = true;
    setLoadingRequests(true);
    void Promise.all(
      owned.map((hall) => fetchOwnerHallBookingRequests(hall.id).catch(() => [])),
    ).then((groups) => {
      if (!active) return;
      setRequests(
        groups
          .flat()
          .filter((item) => isOpenRequest(item.status))
          .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
      );
      setLoadingRequests(false);
    });

    return () => {
      active = false;
    };
  }, [hallKey]);

  const names = new Map(
    hallKey
      ? hallKey.split("\n").map((row) => {
          const [id, name] = row.split("\u0000");
          return [id, name] as const;
        })
      : [],
  );
  const hasRequests = requests.length > 0;

  return (
    <div className="seeker-notifications-page" data-testid="owner-notifications-page">
      <header className="seeker-settings-header">
        <h1 className="seeker-settings-title">{t("owner.nav.notifications")}</h1>
        <p className="seeker-settings-lead">{t("owner.notifications.feedSubtitle")}</p>
      </header>

      <section className="seeker-settings-card">
        {loadingRequests && !hasRequests ? (
          <p className="seeker-notify-empty">{t("common.loading")}</p>
        ) : null}
        {hasRequests ? (
          <ul
            className="seeker-notifications-feed"
            data-testid="owner-notification-requests"
          >
            {requests.map((item) => {
              const hallName = names.get(item.hallId)?.trim() || t("common.hall");
              const userName = item.requesterName.trim() || t("common.user");
              const date = item.date ? formatBookingDateLabel(item.date, locale) : "";
              const when = bookingWhenLabels(item, t, locale).join(" · ");
              return (
                <li key={`${item.hallId}-${item.id}`}>
                  <Link
                    href={ownerHallNotificationsPath(item.hallId, item.id)}
                    className="seeker-notifications-feed-item"
                    data-testid={`owner-notification-request-${item.id}`}
                  >
                    <span className="seeker-notify-item-copy">
                      <span className="seeker-notify-item-title">
                        {t("notify.ownerBookingRequest.title")}
                      </span>
                      <span className="seeker-notify-item-body">
                        {t("notify.ownerBookingRequest.body", {
                          userName,
                          hallName,
                          date: date || t("owner.notifications.valueMissing"),
                        })}
                        {when ? ` — ${when}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
        <NotificationsFeed
          audience="owner"
          emptyKey="owner.notifications.feedEmpty"
          hideEmpty={hasRequests || loadingRequests}
        />
      </section>
    </div>
  );
}
