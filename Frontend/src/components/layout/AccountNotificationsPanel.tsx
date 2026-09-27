"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import NotificationItem from "@/components/notifications/NotificationItem";
import SeekerAcceptedBookingNotices from "@/components/bookings/SeekerAcceptedBookingNotices";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { SEEKER_NOTIFICATIONS_PATH } from "@/constants/seekerDashboardNav";
import { useHallBookingRequests } from "@/hooks/useHallBookingRequests";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { useNotifications } from "@/hooks/useNotifications";
import { useUserBookings } from "@/hooks/useUserBookings";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { bookingWhenLabels } from "@/lib/booking-when-label";
import {
  ownerBookingsPath,
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

  if (identity.isAdmin) {
    return <AdminNotificationsBody panelId={panelId} onClose={onClose} />;
  }
  if (identity.isHallOwner) {
    return <OwnerNotificationsBody panelId={panelId} onClose={onClose} />;
  }
  return <SeekerNotificationsBody panelId={panelId} onClose={onClose} />;
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
  const { items, openNotification } = useNotifications("seeker");
  const { bookings } = useUserBookings();
  const acceptedCount = bookings.filter((item) => item.status === "Accepted").length;
  const previewItems = items.slice(0, 5);

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
      <SeekerAcceptedBookingNotices limit={5} onOpened={onClose} />
      {previewItems.length === 0 && acceptedCount === 0 ? (
        <li className="seeker-notify-empty">{t("notifications.empty")}</li>
      ) : (
        previewItems.map((item) => (
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
    </NotifyShell>
  );
}

function AdminNotificationsBody({
  panelId,
  onClose,
}: {
  panelId: string;
  onClose: () => void;
}) {
  const t = useT();
  const { items, openNotification } = useNotifications("admin");
  const previewItems = items.slice(0, 5);

  return (
    <NotifyShell
      panelId={panelId}
      title={t("notifications.title")}
      subtitle={t("notify.admin.subtitle")}
      onClose={onClose}
      footer={
        <Link
          href="/notifications"
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

  return (
    <OwnerHallNotificationsBody
      panelId={panelId}
      hallId={hallId}
      onClose={onClose}
    />
  );
}

function OwnerHallNotificationsBody({
  panelId,
  hallId,
  onClose,
}: {
  panelId: string;
  hallId: string | null;
  onClose: () => void;
}) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const { halls } = useHallOwnerHalls();
  const { items, openNotification } = useNotifications("owner");
  const hallName = hallId
    ? halls.find((hall) => hall.id === hallId)?.name?.trim() || ""
    : "";
  const { requests, isLoading } = useHallBookingRequests(hallId ?? "");
  const activeRequests = hallId
    ? requests.filter((item) => item.status === "Pending").slice(0, 4)
    : [];
  const previewItems = items.slice(0, 4);
  const notificationsHref = hallId
    ? ownerHallNotificationsPath(hallId)
    : "/owner/bookings";
  const empty =
    previewItems.length === 0 && activeRequests.length === 0 && !isLoading;

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
      {previewItems.map((item) => (
        <li key={item.id}>
          <NotificationItem
            item={item}
            onOpen={(next) => {
              openNotification(next);
              onClose();
            }}
          />
        </li>
      ))}
      {isLoading && activeRequests.length === 0 && previewItems.length === 0 ? (
        <li className="seeker-notify-empty">{t("common.loading")}</li>
      ) : empty ? (
        <li className="seeker-notify-empty">
          {t("owner.management.notifications.empty")}
        </li>
      ) : (
        activeRequests.map((item) => (
          <li key={item.id}>
            <Link
              href={ownerBookingsPath(item.id, hallId)}
              className="seeker-notify-item"
              data-testid={`account-notification-${item.id}`}
              onClick={onClose}
            >
              <span className="seeker-notify-item-icon" aria-hidden="true">
                <BellMiniIcon />
              </span>
              <span className="seeker-notify-item-copy">
                <span className="seeker-notify-item-title">
                  {hallName ? `${hallName} — ${item.requesterName}` : item.requesterName}
                </span>
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
  translate: (key: string) => string,
  locale: string,
): string {
  const date = formatBookingDateLabel(item.date, locale);
  const when = bookingWhenLabels(item, translate, locale).join(" · ");
  return when ? `${date} — ${when}` : date;
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
