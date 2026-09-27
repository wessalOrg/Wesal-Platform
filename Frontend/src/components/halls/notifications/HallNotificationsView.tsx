"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HallLockedState from "@/components/halls/HallLockedState";
import AcceptConfirmModal from "@/components/halls/notifications/AcceptConfirmModal";
import HallNotificationEmptyState from "@/components/halls/notifications/HallNotificationEmptyState";
import HallNotificationErrorState from "@/components/halls/notifications/HallNotificationErrorState";
import HallNotificationList from "@/components/halls/notifications/HallNotificationList";
import HallNotificationSkeleton from "@/components/halls/notifications/HallNotificationSkeleton";
import RejectionReasonModal from "@/components/halls/notifications/RejectionReasonModal";
import SuccessToast from "@/components/ui/SuccessToast";
import { useHallNotifications } from "@/hooks/useHallNotifications";
import { useAcceptBookingRequest } from "@/hooks/useAcceptBookingRequest";
import { usePublishBooking } from "@/hooks/usePublishBooking";
import { useRejectBookingRequest } from "@/hooks/useRejectBookingRequest";
import { useRememberHistoricalBookingAlerts } from "@/hooks/useBookingRequestAudio";
import { useT } from "@/i18n";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { bookingWhenLabels } from "@/lib/booking-when-label";
import {
  BOOKING_PUBLISHED_EVENT,
  BOOKING_REJECTED_EVENT,
  OWNER_BOOKING_REJECTION_EVENT,
  type BookingPublishedDetail,
  type BookingRejectedDetail,
} from "@/lib/booking-events";
import { publishOwnerDepositSlotsFromItems } from "@/lib/owner-deposit-slot-store";
import { useUiLang } from "@/components/layout/LanguageProvider";
import type { HallBookingNotification } from "@/types/hall-notifications";

type HallNotificationsViewProps = {
  hallId: string;
  enabled?: boolean;
  requestId?: string | null;
  hallName?: string | null;
};

/**
 * Hall-scoped booking-request list. Remount or pass a new hallId to drop stale rows.
 */
export default function HallNotificationsView({
  hallId,
  enabled = true,
  requestId = null,
  hallName = null,
}: HallNotificationsViewProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const notifications = useHallNotifications(hallId, enabled);
  const { applyPublished, applyStatus } = notifications;
  const [rejectTarget, setRejectTarget] = useState<HallBookingNotification | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<HallBookingNotification | null>(null);
  const [acceptToast, setAcceptToast] = useState(false);
  const [rejectToast, setRejectToast] = useState(false);
  const highlightedId = requestId?.trim() || null;
  const accept = useAcceptBookingRequest({
    onAccepted: notifications.applyAccepted,
    onStatusSync: notifications.applyStatus,
  });
  const confirmPayment = usePublishBooking({
    onPublished: notifications.applyPublished,
    onStatusSync: notifications.applyStatus,
  });
  const reject = useRejectBookingRequest({
    onRejected: (result) => {
      notifications.applyRejected(result);
      setRejectTarget(null);
      setRejectToast(true);
    },
    onStatusSync: (bookingId, status) => {
      notifications.applyStatus(bookingId, status);
      if (status !== "Pending") setRejectTarget(null);
    },
  });
  useRememberHistoricalBookingAlerts(
    notifications.items,
    enabled && (notifications.status === "ready" || notifications.status === "empty"),
  );

  useEffect(() => {
    if (!enabled || !highlightedId) return;
    if (notifications.status !== "ready") return;
    const node = document.querySelector<HTMLElement>(
      `[data-notification-id="${CSS.escape(highlightedId)}"]`,
    );
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [enabled, highlightedId, notifications.items, notifications.status]);

  useEffect(() => {
    if (!enabled) return;
    if (notifications.status !== "ready" && notifications.status !== "empty") return;
    publishOwnerDepositSlotsFromItems(hallId, notifications.items);
  }, [enabled, hallId, notifications.items, notifications.status]);

  useEffect(() => {
    if (!enabled) return;

    const onRejected = (event: Event) => {
      const detail = (event as CustomEvent<BookingRejectedDetail>).detail;
      if (!detail?.bookingId) return;
      if (detail.hallId && detail.hallId !== hallId) return;
      applyStatus(detail.bookingId, "Rejected");
    };

    const onPublished = (event: Event) => {
      const detail = (event as CustomEvent<BookingPublishedDetail>).detail;
      if (!detail?.bookingId) return;
      if (detail.hallId && detail.hallId !== hallId) return;
      applyPublished({
        bookingId: detail.bookingId,
        hallId: detail.hallId,
        date: detail.date,
        periods: detail.periods ?? [],
        status: "FullyBooked",
        alreadyPublished: false,
      });
    };

    window.addEventListener(BOOKING_REJECTED_EVENT, onRejected);
    window.addEventListener(OWNER_BOOKING_REJECTION_EVENT, onRejected);
    window.addEventListener(BOOKING_PUBLISHED_EVENT, onPublished);
    return () => {
      window.removeEventListener(BOOKING_REJECTED_EVENT, onRejected);
      window.removeEventListener(OWNER_BOOKING_REJECTION_EVENT, onRejected);
      window.removeEventListener(BOOKING_PUBLISHED_EVENT, onPublished);
    };
  }, [enabled, hallId, applyPublished, applyStatus]);

  const loginHref = `/login?redirect=${encodeURIComponent(`/owner/halls/${hallId}/notifications`)}`;
  const rejectDateLabel = rejectTarget?.date
    ? formatBookingDateLabel(rejectTarget.date, locale)
    : undefined;
  const rejectPeriodLabels = rejectTarget
    ? bookingWhenLabels(rejectTarget, t, locale)
    : [];
  const acceptDateLabel = acceptTarget?.date
    ? formatBookingDateLabel(acceptTarget.date, locale)
    : undefined;
  const acceptPeriodLabels = acceptTarget ? bookingWhenLabels(acceptTarget, t, locale) : [];

  if (!enabled) return null;

  return (
    <div
      className="min-w-0"
      data-testid="hall-notifications-view"
      data-hall-id={notifications.hallId ?? hallId}
      data-status={notifications.status}
      aria-live="polite"
      aria-busy={
        notifications.status === "loading" ||
        Boolean(accept.acceptingId) ||
        Boolean(reject.rejectingId) ||
        Boolean(confirmPayment.publishingId) ||
        undefined
      }
    >
      {notifications.status === "loading" ? (
        <>
          <p className="sr-only">{t("owner.notifications.loading")}</p>
          <HallNotificationSkeleton />
        </>
      ) : null}

      {notifications.status === "empty" ? <HallNotificationEmptyState /> : null}

      {notifications.status === "ready" ? (
        <HallNotificationList
          items={notifications.items}
          acceptingId={accept.acceptingId}
          rejectingId={reject.rejectingId}
          confirmingId={confirmPayment.publishingId}
          acceptErrorById={accept.errorById}
          rejectErrorById={reject.errorById}
          confirmErrorById={confirmPayment.errorById}
          highlightedId={highlightedId}
          hallName={hallName}
          onAccept={setAcceptTarget}
          onReject={setRejectTarget}
          onConfirmPayment={(item) => {
            void confirmPayment.publish(item.hallId || hallId, item.id);
          }}
        />
      ) : null}

      {notifications.status === "unauthorized" ? (
        <HallNotificationErrorState
          message={t("errors.owner.notifications.unauthorized")}
          action={
            <Link href={loginHref} className="btn-primary inline-flex min-h-11 w-full">
              {t("profile.goLogin")}
            </Link>
          }
        />
      ) : null}

      {notifications.status === "forbidden" ? <HallLockedState reason="both" /> : null}

      {notifications.status === "not_found" ? (
        <HallNotificationErrorState
          message={t(notifications.errorKey ?? "errors.owner.notifications.notFound")}
        />
      ) : null}

      {notifications.status === "error" ? (
        <HallNotificationErrorState
          message={t(notifications.errorKey ?? "errors.owner.notifications.load")}
          action={
            <button
              type="button"
              className="btn-outline min-h-11 w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)]"
              onClick={notifications.retry}
            >
              {t("common.retry")}
            </button>
          }
        />
      ) : null}

      <AcceptConfirmModal
        open={Boolean(acceptTarget)}
        busy={Boolean(acceptTarget && accept.acceptingId === acceptTarget.id)}
        errorKey={acceptTarget ? accept.errorById[acceptTarget.id] ?? null : null}
        requesterName={acceptTarget?.requesterName.trim() || t("common.user")}
        dateLabel={acceptDateLabel}
        periodLabels={acceptPeriodLabels}
        hallName={hallName}
        onClose={() => {
          if (!accept.acceptingId) setAcceptTarget(null);
        }}
        onConfirm={(depositAmount) => {
          if (!acceptTarget) return;
          void accept
            .accept(acceptTarget.hallId || hallId, acceptTarget.id, depositAmount, hallName)
            .then((result) => {
              if (!result) return;
              setAcceptTarget(null);
              setAcceptToast(true);
            });
        }}
      />

      <RejectionReasonModal
        open={Boolean(rejectTarget)}
        busy={Boolean(rejectTarget && reject.rejectingId === rejectTarget.id)}
        errorKey={rejectTarget ? reject.errorById[rejectTarget.id] ?? null : null}
        dateLabel={rejectDateLabel}
        periodLabels={rejectPeriodLabels}
        onClose={() => {
          if (!reject.rejectingId) setRejectTarget(null);
        }}
        onConfirm={(reason) => {
          if (!rejectTarget) return;
          void reject.reject(rejectTarget.hallId || hallId, rejectTarget.id, reason, hallName);
        }}
      />

      <SuccessToast
        open={acceptToast}
        message={t("owner.notifications.acceptSuccess")}
        onClose={() => setAcceptToast(false)}
      />
      <SuccessToast
        open={rejectToast}
        message={t("owner.notifications.rejectSuccess")}
        onClose={() => setRejectToast(false)}
      />
    </div>
  );
}
