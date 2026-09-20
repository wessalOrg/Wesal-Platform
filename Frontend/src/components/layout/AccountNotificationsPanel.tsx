"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { SEEKER_NOTIFICATIONS_PATH } from "@/constants/seekerDashboardNav";
import { SEEKER_NOTIFICATIONS } from "@/constants/seekerNotifications";
import { useHallBookingRequests } from "@/hooks/useHallBookingRequests";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { bookingPeriodI18nKey } from "@/lib/booking-rejection-message";
import {
  ownerHallNotificationsPath,
  parseOwnerHallIdFromPathname,
} from "@/lib/hall-owner-query-keys";
import { useT } from "@/i18n";
import type { OwnerHallBookingRequest } from "@/types/owner-hall-booking-requests";

type AccountNotificationsPanelProps = {
  open: boolean;
  onClose: () => void;
  panelId?: string;
};

/**
 * Shared notifications popup for navbar and dashboard bells.
 */
export default function AccountNotificationsPanel({
  open,
  onClose,
  panelId: panelIdProp,
}: AccountNotificationsPanelProps) {
  const identity = useUserIdentity();
  const generatedId = useId();
  const panelId = panelIdProp ?? generatedId;

  if (!open) return null;

  return identity.isHallOwner ? (
    <OwnerNotificationsBody panelId={panelId} onClose={onClose} />
  ) : (
    <SeekerNotificationsBody panelId={panelId} onClose={onClose} />
  );
}

function NotifyShell({
  panelId,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  panelId: string;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const t = useT();
  return (
    <div
      id={panelId}
      role="dialog"
      aria-label={title}
      className="seeker-notify-panel"
      data-testid="account-notifications-panel"
    >
      <div className="seeker-notify-panel-head">
        <div className="min-w-0">
          <p className="seeker-notify-panel-title">{title}</p>
          <p className="seeker-notify-panel-sub">{subtitle}</p>
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
      <ul className="seeker-notify-list">{children}</ul>
      {footer ? <div className="seeker-notify-panel-foot">{footer}</div> : null}
    </div>
  );
}

function SeekerNotificationsBody({
  panelId,
  onClose,
}: {
  panelId: string;
  onClose: () => void;
}) {
  const t = useT();
  const previewItems = SEEKER_NOTIFICATIONS.slice(0, 5);

  return (
    <NotifyShell
      panelId={panelId}
      title={t("notifications.title")}
      subtitle={t("nav.notificationsHint")}
      onClose={onClose}
      footer={
        <Link
          href={SEEKER_NOTIFICATIONS_PATH}
          className="seeker-notify-view-all"
          data-testid="account-notifications-view-all"
          onClick={onClose}
        >
          {t("seeker.notifications.viewAll")}
        </Link>
      }
    >
      {previewItems.length === 0 ? (
        <li className="seeker-notify-empty">{t("notifications.empty")}</li>
      ) : (
        previewItems.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="seeker-notify-item"
              data-testid={`account-notification-${item.id}`}
              onClick={onClose}
            >
              <span className="seeker-notify-item-icon" aria-hidden="true">
                <BellMiniIcon />
              </span>
              <span className="seeker-notify-item-copy">
                <span className="seeker-notify-item-title">{t(item.titleKey)}</span>
                <span className="seeker-notify-item-body">{t(item.bodyKey)}</span>
              </span>
            </Link>
          </li>
        ))
      )}
    </NotifyShell>
  );
}

function OwnerNotificationsBody({
  panelId,
  onClose,
}: {
  panelId: string;
  onClose: () => void;
}) {
  const { halls } = useHallOwnerHalls();
  const pathname = usePathname();
  const routeHallId = parseOwnerHallIdFromPathname(pathname);
  const routeOwned =
    routeHallId && halls.some((hall) => hall.id === routeHallId)
      ? routeHallId
      : null;
  const hallId = routeOwned ?? halls[0]?.id ?? null;

  if (!hallId) {
    return <OwnerEmptyPanel panelId={panelId} onClose={onClose} />;
  }

  return (
    <OwnerHallNotificationsBody
      panelId={panelId}
      hallId={hallId}
      onClose={onClose}
    />
  );
}

function OwnerEmptyPanel({
  panelId,
  onClose,
}: {
  panelId: string;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <NotifyShell
      panelId={panelId}
      title={t("owner.management.notifications.title")}
      subtitle={t("owner.management.notifications.subtitle")}
      onClose={onClose}
    >
      <li className="seeker-notify-empty">
        {t("owner.management.notifications.empty")}
      </li>
    </NotifyShell>
  );
}

function OwnerHallNotificationsBody({
  panelId,
  hallId,
  onClose,
}: {
  panelId: string;
  hallId: string;
  onClose: () => void;
}) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const { requests, isLoading } = useHallBookingRequests(hallId);
  const previewItems = requests.slice(0, 5);
  const notificationsHref = ownerHallNotificationsPath(hallId);

  return (
    <NotifyShell
      panelId={panelId}
      title={t("owner.management.notifications.title")}
      subtitle={t("owner.management.notifications.subtitle")}
      onClose={onClose}
      footer={
        <Link
          href={notificationsHref}
          className="seeker-notify-view-all"
          data-testid="account-notifications-view-all"
          onClick={onClose}
        >
          {t("owner.management.notifications.viewAll")}
        </Link>
      }
    >
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
              data-testid={`account-notification-${item.id}`}
              onClick={onClose}
            >
              <span className="seeker-notify-item-icon" aria-hidden="true">
                <BellMiniIcon />
              </span>
              <span className="seeker-notify-item-copy">
                <span className="seeker-notify-item-title">{item.requesterName}</span>
                <span className="seeker-notify-item-body">
                  {formatRequestPreview(item, t, locale)}
                </span>
              </span>
            </Link>
          </li>
        ))
      )}
    </NotifyShell>
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
