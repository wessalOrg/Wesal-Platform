"use client";

import { useEffect } from "react";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { t } from "@/i18n";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { formatDepositAmount } from "@/lib/booking-deposits";
import {
  BOOKING_ACCEPTED_EVENT,
  BOOKING_CANCELLED_EVENT,
  BOOKING_REJECTED_EVENT,
  BOOKING_SUBMITTED_EVENT,
  emitBookingCancelled,
  type BookingAcceptedDetail,
  type BookingCancelledDetail,
  type BookingRejectedDetail,
  type BookingSubmittedDetail,
} from "@/lib/booking-events";
import { bookingPeriodI18nKey } from "@/lib/booking-rejection-message";
import { getStoredUiLang } from "@/lib/language";
import {
  HALL_APPROVED_EVENT,
  HALL_CREATED_EVENT,
  HALL_REJECTED_EVENT,
  type HallApprovedDetail,
  type HallCreatedDetail,
  type HallRejectedDetail,
} from "@/lib/hall-review-events";
import {
  notifySeekerWelcome,
  pushPlatformNotification,
} from "@/lib/platform-notifications-store";
import {
  ownerBookingsPath,
  ownerHallNotificationsPath,
} from "@/lib/hall-owner-query-keys";
import { subscribeOwnerBookingRequestEvents } from "@/services/booking-notification-realtime";
import { loadRememberedBookings } from "@/lib/user-bookings-store";

function locale() {
  return getStoredUiLang() === "en" ? "en-GB" : "ar-EG";
}

function formatPeriods(periods?: string[]): string {
  if (!periods?.length) return "";
  return periods
    .map((period) => {
      const key = bookingPeriodI18nKey(period);
      return key ? t(key) : period;
    })
    .join(" · ");
}

function lookupHallName(hallId: string, bookingId?: string, fallback?: string) {
  const bookings = loadRememberedBookings();
  const match =
    bookings.find((item) => bookingId && item.bookingId === bookingId) ??
    bookings.find((item) => item.hallId === hallId);
  return fallback?.trim() || match?.hallName?.trim() || t("common.hall");
}

/**
 * Turns existing booking/hall domain events into the local notification feed.
 * No inbox API exists — this only mirrors client-side lifecycle events.
 */
export default function NotificationEventsBridge() {
  const account = useAccountAccess();

  useEffect(() => {
    if (!account.ready || !account.authenticated || account.isAdmin || account.isHallOwner) {
      return;
    }
    notifySeekerWelcome(account.userId);
  }, [account.authenticated, account.isAdmin, account.isHallOwner, account.ready, account.userId]);

  useEffect(() => {
    const onSubmitted = (event: Event) => {
      const detail = (event as CustomEvent<BookingSubmittedDetail>).detail;
      if (!detail?.hallId) return;
      pushPlatformNotification({
        type: "booking_submitted",
        audience: "seeker",
        titleKey: "notify.bookingSubmitted.title",
        bodyKey: "notify.bookingSubmitted.body",
        metadata: {
          hall_id: detail.hallId,
          booking_id: detail.bookingId,
          hall_name: detail.hallName,
          date: detail.date,
        },
      });
    };

    const onAccepted = (event: Event) => {
      const detail = (event as CustomEvent<BookingAcceptedDetail>).detail;
      if (!detail?.bookingId) return;
      const hallName = lookupHallName(detail.hallId, detail.bookingId, detail.hallName);
      const date = formatBookingDateLabel(detail.date, locale());
      const period = formatPeriods(detail.periods) || t("halls.period.generic");
      const amount =
        detail.depositAmount != null ? formatDepositAmount(detail.depositAmount) : "—";
      pushPlatformNotification({
        type: "booking_accepted",
        audience: "seeker",
        titleKey: "notify.bookingAccepted.title",
        bodyKey: "notify.bookingAccepted.body",
        actionLabelKey: "notify.bookingAccepted.action",
        params: { hallName, date, period, amount },
        metadata: {
          hall_id: detail.hallId,
          booking_id: detail.bookingId,
          // The exact seeker <-> owner thread the owner wrote the approval into. Carrying it
          // here is what lets the click open that conversation rather than the bookings list.
          conversation_id: detail.conversationId,
          hall_name: hallName,
          date: detail.date,
          period,
          deposit_amount: amount,
        },
        tone: "success",
      });
    };

    const onRejected = (event: Event) => {
      const detail = (event as CustomEvent<BookingRejectedDetail>).detail;
      if (!detail?.bookingId) return;
      const hallName = lookupHallName(detail.hallId, detail.bookingId, detail.hallName);
      const reason = detail.rejectionReason?.trim() || t("notify.bookingRejected.reasonMissing");
      pushPlatformNotification({
        type: "booking_rejected",
        audience: "seeker",
        titleKey: "notify.bookingRejected.title",
        bodyKey: "notify.bookingRejected.body",
        actionLabelKey: "notify.bookingRejected.action",
        params: { hallName, reason },
        metadata: {
          hall_id: detail.hallId,
          booking_id: detail.bookingId,
          hall_name: hallName,
          rejection_reason: reason,
          date: detail.date,
        },
        tone: "danger",
      });
    };

    const onCancelled = (event: Event) => {
      const detail = (event as CustomEvent<BookingCancelledDetail>).detail;
      if (!detail?.bookingId) return;
      const hallName = lookupHallName(detail.hallId, detail.bookingId, detail.hallName);
      const userName = detail.requesterName?.trim() || t("common.user");
      const date = formatBookingDateLabel(detail.date, locale());
      const period = formatPeriods([detail.period]);
      pushPlatformNotification({
        type: "booking_cancelled",
        audience: "owner",
        titleKey: "notify.bookingCancelled.title",
        bodyKey: "notify.bookingCancelled.body",
        params: { userName, date, period, hallName },
        metadata: {
          hall_id: detail.hallId,
          booking_id: detail.bookingId,
          hall_name: hallName,
          user_name: userName,
          date: detail.date,
          period,
        },
        tone: "danger",
      });
    };

    const onHallCreated = (event: Event) => {
      const detail = (event as CustomEvent<HallCreatedDetail>).detail;
      if (!detail?.hallName && !detail?.hallId) return;
      const hallName = detail.hallName.trim() || t("common.hall");
      pushPlatformNotification({
        type: "hall_submitted",
        audience: "owner",
        titleKey: "notify.hallSubmitted.title",
        bodyKey: "notify.hallSubmitted.body",
        params: { hallName },
        metadata: { hall_id: detail.hallId ?? undefined, hall_name: hallName },
        tone: "success",
      });
      if (detail.hallId) {
        pushPlatformNotification({
          type: "hall_review_request",
          audience: "admin",
          titleKey: "notify.hallReview.title",
          bodyKey: "notify.hallReview.body",
          params: { hallName },
          metadata: { hall_id: detail.hallId, hall_name: hallName },
          tone: "info",
        });
      }
    };

    const onHallApproved = (event: Event) => {
      const detail = (event as CustomEvent<HallApprovedDetail>).detail;
      if (!detail?.hallId) return;
      const hallName = detail.hallName.trim() || t("common.hall");
      pushPlatformNotification({
        type: "hall_approved",
        audience: "owner",
        titleKey: "notify.hallApproved.title",
        bodyKey: "notify.hallApproved.body",
        params: { hallName },
        metadata: { hall_id: detail.hallId, hall_name: hallName },
        tone: "success",
      });
    };

    const onHallRejected = (event: Event) => {
      const detail = (event as CustomEvent<HallRejectedDetail>).detail;
      if (!detail?.hallId) return;
      const hallName = detail.hallName.trim() || t("common.hall");
      const reason = detail.reason?.trim() || "";
      pushPlatformNotification({
        type: "hall_rejected",
        audience: "owner",
        titleKey: "notify.hallRejected.title",
        bodyKey: reason ? "notify.hallRejected.bodyReason" : "notify.hallRejected.body",
        actionLabelKey: "notify.hallRejected.action",
        params: { hallName, reason },
        metadata: {
          hall_id: detail.hallId,
          hall_name: hallName,
          rejection_reason: reason || undefined,
        },
        tone: "danger",
      });
    };

    window.addEventListener(BOOKING_SUBMITTED_EVENT, onSubmitted);
    window.addEventListener(BOOKING_ACCEPTED_EVENT, onAccepted);
    window.addEventListener(BOOKING_REJECTED_EVENT, onRejected);
    window.addEventListener(BOOKING_CANCELLED_EVENT, onCancelled);
    window.addEventListener(HALL_CREATED_EVENT, onHallCreated);
    window.addEventListener(HALL_APPROVED_EVENT, onHallApproved);
    window.addEventListener(HALL_REJECTED_EVENT, onHallRejected);
    const unsubscribeOwnerRealtime = subscribeOwnerBookingRequestEvents((event) => {
      if (event.replay || !event.id) return;
      if (event.kind === "cancelled") {
        emitBookingCancelled({
          bookingId: event.id,
          hallId: event.hallId,
          date: event.date ?? "",
          period: event.timeRange || event.period || "",
          hallName: event.hallName,
          requesterName: event.requesterName,
        });
        return;
      }

      const hallName = event.hallName?.trim() || t("common.hall");
      const userName = event.requesterName?.trim() || t("common.user");
      const date = event.date ? formatBookingDateLabel(event.date, locale()) : "";
      pushPlatformNotification({
        type: "booking_submitted",
        audience: "owner",
        titleKey: "notify.ownerBookingRequest.title",
        bodyKey: "notify.ownerBookingRequest.body",
        actionLabelKey: "notify.ownerBookingRequest.action",
        params: { hallName, userName, date },
        action_url: event.hallId
          ? ownerHallNotificationsPath(event.hallId, event.id)
          : ownerBookingsPath(event.id),
        metadata: {
          hall_id: event.hallId || undefined,
          booking_id: event.id,
          hall_name: hallName,
          user_name: userName,
          date: event.date,
          period: event.timeRange || event.period,
        },
      });
    });
    return () => {
      window.removeEventListener(BOOKING_SUBMITTED_EVENT, onSubmitted);
      window.removeEventListener(BOOKING_ACCEPTED_EVENT, onAccepted);
      window.removeEventListener(BOOKING_REJECTED_EVENT, onRejected);
      window.removeEventListener(BOOKING_CANCELLED_EVENT, onCancelled);
      window.removeEventListener(HALL_CREATED_EVENT, onHallCreated);
      window.removeEventListener(HALL_APPROVED_EVENT, onHallApproved);
      window.removeEventListener(HALL_REJECTED_EVENT, onHallRejected);
      unsubscribeOwnerRealtime();
    };
  }, []);

  return null;
}
