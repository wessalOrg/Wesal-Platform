"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useHallBookingRequests } from "@/hooks/useHallBookingRequests";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { bookingPeriodI18nKey } from "@/lib/booking-rejection-message";
import {
  ownerHallNotificationsPath,
  parseOwnerHallIdFromPathname,
} from "@/lib/hall-owner-query-keys";
import { useT } from "@/i18n";
import type { OwnerHallBookingRequest } from "@/types/owner-hall-booking-requests";

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
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const pathname = usePathname();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { requests, isLoading } = useHallBookingRequests(hallId);
  const previewItems = requests.slice(0, 3);
  const hasPending = requests.some((item) => item.status === "Pending");
  const notificationsHref = ownerHallNotificationsPath(hallId);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
        aria-controls={panelId}
        data-testid="owner-notifications-trigger"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="seeker-dash-notify-bell" aria-hidden="true">
          <BellIcon />
        </span>
        {hasPending ? (
          <span className="seeker-notify-dot" aria-hidden="true" />
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={t("owner.management.notifications.title")}
          className="seeker-notify-panel"
          data-testid="owner-notifications-panel"
        >
          <div className="seeker-notify-panel-head">
            <div className="min-w-0">
              <p className="seeker-notify-panel-title">
                {t("owner.management.notifications.title")}
              </p>
              <p className="seeker-notify-panel-sub">
                {t("owner.management.notifications.subtitle")}
              </p>
            </div>
            <button
              type="button"
              className="seeker-notify-panel-close"
              aria-label={t("common.close")}
              data-testid="owner-notifications-close"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>

          <ul className="seeker-notify-list">
            {isLoading && previewItems.length === 0 ? (
              <li className="seeker-notify-empty">{t("common.loading")}</li>
            ) : previewItems.length === 0 ? (
              <li className="seeker-notify-empty">
                {t("owner.management.notifications.empty")}
              </li>
            ) : (
              previewItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={notificationsHref}
                    className="seeker-notify-item"
                    data-testid={`owner-notification-${item.id}`}
                    onClick={() => setOpen(false)}
                  >
                    <span className="seeker-notify-item-icon" aria-hidden="true">
                      <BellMiniIcon />
                    </span>
                    <span className="seeker-notify-item-copy">
                      <span className="seeker-notify-item-title">
                        {item.requesterName}
                      </span>
                      <span className="seeker-notify-item-body">
                        {formatRequestPreview(item, t, locale)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>

          <div className="seeker-notify-panel-foot">
            <Link
              href={notificationsHref}
              className="seeker-notify-view-all"
              data-testid="owner-notifications-view-all"
              onClick={() => setOpen(false)}
            >
              {t("owner.management.notifications.viewAll")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatRequestPreview(
  item: OwnerHallBookingRequest,
  t: (key: string) => string,
  locale: string,
): string {
  const date = formatBookingDateLabel(item.date, locale);
  const periods = item.periods
    .map((period) => {
      const key = bookingPeriodI18nKey(period);
      return key ? t(key) : period;
    })
    .join(" · ");
  return periods ? `${date} — ${periods}` : date;
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

function BellMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M7 10a5 5 0 0 1 10 0v2.6l1.1 1.9H5.9L7 12.6V10Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M10.2 17.5a1.8 1.8 0 0 0 3.6 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
