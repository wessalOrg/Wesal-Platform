"use client";

import AcceptActionButton from "@/components/halls/notifications/AcceptActionButton";
import AcceptanceFeedback from "@/components/halls/notifications/AcceptanceFeedback";
import AcceptanceStateBadge from "@/components/halls/notifications/AcceptanceStateBadge";
import RejectActionButton from "@/components/halls/notifications/RejectActionButton";
import RejectionStatusBadge from "@/components/halls/notifications/RejectionStatusBadge";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { bookingPeriodI18nKey } from "@/lib/booking-rejection-message";
import {
  acceptFeedbackKind,
  cardAcceptanceState,
} from "@/lib/owner-acceptance-ui";
import { canAcceptBookingRequest, canRejectBookingRequest } from "@/lib/owner-booking-status";
import type { HallBookingNotification } from "@/types/hall-notifications";

type HallNotificationCardProps = {
  notification: HallBookingNotification;
  accepting?: boolean;
  rejecting?: boolean;
  acceptLocked?: boolean;
  rejectLocked?: boolean;
  acceptErrorKey?: string | null;
  rejectErrorKey?: string | null;
  onAccept?: (notification: HallBookingNotification) => void;
  onReject?: (notification: HallBookingNotification) => void;
};

export default function HallNotificationCard({
  notification,
  accepting = false,
  rejecting = false,
  acceptLocked = false,
  rejectLocked = false,
  acceptErrorKey = null,
  rejectErrorKey = null,
  onAccept,
  onReject,
}: HallNotificationCardProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const requester = notification.requesterName.trim() || t("common.user");
  const dateLabel = notification.date
    ? formatBookingDateLabel(notification.date, locale)
    : t("owner.notifications.valueMissing");
  const periodLabels =
    notification.periods.length > 0
      ? notification.periods.map((period) => t(bookingPeriodI18nKey(period)))
      : [t("owner.notifications.valueMissing")];
  const showAccept = Boolean(onAccept) && canAcceptBookingRequest(notification.status);
  const showReject = Boolean(onReject) && canRejectBookingRequest(notification.status);
  const errorId = `hall-notification-action-error-${notification.id}`;
  const feedback = acceptFeedbackKind(acceptErrorKey) ?? acceptFeedbackKind(rejectErrorKey);
  const errorText = translateError(t, acceptErrorKey) ?? translateError(t, rejectErrorKey);
  const showCancelled = notification.status === "Cancelled";
  const showFinalized =
    notification.status === "Rejected" || notification.status === "FullyBooked";
  const visualState = cardAcceptanceState({
    status: notification.status,
    accepting: accepting || rejecting,
    errorKey: acceptErrorKey ?? rejectErrorKey,
  });

  return (
    <article
      className={`hall-notification-card min-w-0 overflow-hidden rounded-2xl border bg-white px-3.5 py-3 shadow-[0_8px_20px_rgba(90,55,45,0.06)] sm:px-4 sm:py-3.5 ${cardTone(visualState)}`}
      data-testid="hall-notification-card"
      data-notification-id={notification.id}
      data-notification-status={notification.status ?? "unknown"}
      data-acceptance-state={visualState}
      aria-busy={accepting || rejecting || undefined}
    >
      <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">
            {t("owner.notifications.requester")}
          </p>
          <h3
            className="mt-0.5 break-words text-sm font-bold text-[var(--wesal-maroon)] [overflow-wrap:anywhere] line-clamp-2 sm:text-base"
            title={requester}
          >
            {requester}
          </h3>
        </div>
        {notification.status === "Rejected" ? (
          <RejectionStatusBadge live={rejecting} />
        ) : notification.status ? (
          <AcceptanceStateBadge status={notification.status} live={accepting} />
        ) : null}
      </div>

      <dl className="hall-notification-meta mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 overflow-hidden">
          <dt className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">
            {t("owner.notifications.date")}
          </dt>
          <dd
            className="mt-0.5 break-words text-sm leading-6 text-[var(--wesal-text)] [overflow-wrap:anywhere]"
            title={dateLabel}
          >
            {dateLabel}
          </dd>
        </div>
        <div className="min-w-0 overflow-hidden">
          <dt className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">
            {t("owner.notifications.periods")}
          </dt>
          <dd className="mt-1 flex min-w-0 flex-wrap gap-1.5">
            {periodLabels.map((label, index) => (
              <span
                key={`${notification.id}-${label}-${index}`}
                className="max-w-full break-words rounded-full bg-[var(--wesal-pink-soft)] px-2.5 py-1 text-[0.72rem] font-semibold leading-5 text-[var(--wesal-text)] [overflow-wrap:anywhere]"
                title={label}
              >
                {label}
              </span>
            ))}
          </dd>
        </div>
      </dl>

      {notification.status === "AcceptedPendingDeposit" ? (
        <p
          className="mt-3 text-[0.75rem] leading-5 text-[#8a6a2a]"
          data-testid="owner-deposit-hint"
          role="status"
          title={t("owner.notifications.depositHint")}
        >
          {t("owner.notifications.depositHint")}
        </p>
      ) : null}

      {notification.status === "Rejected" && notification.rejectionReason ? (
        <p className="mt-3 break-words text-sm leading-6 text-[var(--wesal-muted)] [overflow-wrap:anywhere]">
          {notification.rejectionReason}
        </p>
      ) : null}

      {showCancelled ? <AcceptanceFeedback kind="cancelled-status" /> : null}
      {showFinalized ? <AcceptanceFeedback kind="finalized" /> : null}
      {!showCancelled && feedback === "conflict" ? (
        <AcceptanceFeedback id={errorId} kind="conflict" />
      ) : null}
      {!showCancelled && feedback === "generic" && errorText ? (
        <AcceptanceFeedback id={errorId} kind="generic" message={errorText} />
      ) : null}

      {showAccept || showReject ? (
        <div className="hall-request-actions mt-3">
          {showReject ? (
            <RejectActionButton
              bookingId={notification.id}
              busy={rejecting}
              disabled={rejectLocked || accepting}
              describedBy={errorText ? errorId : undefined}
              onClick={() => onReject?.(notification)}
            />
          ) : null}
          {showAccept ? (
            <AcceptActionButton
              bookingId={notification.id}
              busy={accepting}
              disabled={acceptLocked || rejecting}
              describedBy={errorText || showCancelled ? errorId : undefined}
              onClick={() => onAccept?.(notification)}
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function translateError(
  t: (key: string) => string,
  key: string | null | undefined,
): string | null {
  if (!key) return null;
  if (key.startsWith("errors.") || key.startsWith("owner.")) return t(key);
  return key;
}

function cardTone(state: string): string {
  if (state === "deposit-pending") {
    return "border-[rgba(196,160,92,0.45)]";
  }
  if (state === "cancelled" || state === "finalized") {
    return "border-[var(--wesal-border)] opacity-90";
  }
  if (state === "conflict") {
    return "border-red-200";
  }
  return "border-[var(--wesal-border)]";
}
