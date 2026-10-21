"use client";

import AcceptActionButton from "@/components/halls/notifications/AcceptActionButton";
import AcceptanceFeedback from "@/components/halls/notifications/AcceptanceFeedback";
import RejectActionButton from "@/components/halls/notifications/RejectActionButton";
import StableClockRangeText from "@/components/halls/StableClockRangeText";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { formatDepositAmount } from "@/lib/booking-deposits";
import { localTodayIso, parseDateIso } from "@/lib/booking-date";
import { bookingWhenLabels } from "@/lib/booking-when-label";
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
  confirming?: boolean;
  acceptLocked?: boolean;
  rejectLocked?: boolean;
  confirmLocked?: boolean;
  acceptErrorKey?: string | null;
  rejectErrorKey?: string | null;
  confirmErrorKey?: string | null;
  highlighted?: boolean;
  hallName?: string | null;
  hallImageSrc?: string | null;
  onAccept?: (notification: HallBookingNotification) => void;
  onReject?: (notification: HallBookingNotification) => void;
  onConfirmPayment?: (notification: HallBookingNotification) => void;
  onMessageSeeker?: (notification: HallBookingNotification) => void;
  messagingSeeker?: boolean;
};

const FALLBACK_HALL_IMAGE = "/hero/hall-ballroom.jpg";

export default function HallNotificationCard({
  notification,
  accepting = false,
  rejecting = false,
  confirming = false,
  acceptLocked = false,
  rejectLocked = false,
  confirmLocked = false,
  acceptErrorKey = null,
  rejectErrorKey = null,
  confirmErrorKey = null,
  highlighted = false,
  hallName = null,
  hallImageSrc = null,
  onAccept,
  onReject,
  onConfirmPayment,
  onMessageSeeker,
  messagingSeeker = false,
}: HallNotificationCardProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const phone = notification.requesterPhone?.trim() || "";
  const requester =
    displayRequesterName(notification.requesterName, phone) || t("common.user");
  const eventTypeLabel = notification.eventTypeLabel?.trim() || "";
  const { weekdayLabel, dateLabel } = formatNotificationDayDate(notification.date, locale);
  const periodLabels = bookingWhenLabels(notification, t, locale);
  const whenLabel =
    periodLabels.length > 0
      ? periodLabels.join(lang === "ar" ? " — " : " - ")
      : t("owner.notifications.valueMissing");
  const relativeLabel = formatBookingRelative(notification.date, t);
  const showAccept = Boolean(onAccept) && canAcceptBookingRequest(notification.status);
  const showReject = Boolean(onReject) && canRejectBookingRequest(notification.status);
  const showConfirm =
    Boolean(onConfirmPayment) && notification.status === "AcceptedPendingDeposit";
  const showChat = Boolean(onMessageSeeker) && Boolean(notification.requesterUserId);
  const errorId = `hall-notification-action-error-${notification.id}`;
  const feedback =
    acceptFeedbackKind(acceptErrorKey) ??
    acceptFeedbackKind(rejectErrorKey) ??
    acceptFeedbackKind(confirmErrorKey);
  const errorText =
    translateError(t, acceptErrorKey) ??
    translateError(t, rejectErrorKey) ??
    translateError(t, confirmErrorKey);
  const showCancelled = notification.status === "Cancelled";
  const showFinalized =
    notification.status === "Rejected" || notification.status === "FullyBooked";
  const visualState = cardAcceptanceState({
    status: notification.status,
    accepting: accepting || rejecting,
    errorKey: acceptErrorKey ?? rejectErrorKey,
  });
  const depositBadge = depositBadgeFor(notification, t);
  const avatarLetter = requester.trim().charAt(0) || "؟";
  const requesterAvatarUrl = notification.requesterAvatarUrl?.trim() || "";
  const imageSrc = hallImageSrc?.trim() || FALLBACK_HALL_IMAGE;
  const hasActions = showAccept || showReject || showConfirm;
  const hasDetailBody =
    hasActions ||
    showCancelled ||
    showFinalized ||
    Boolean(feedback) ||
    notification.status === "AcceptedPendingDeposit" ||
    Boolean(notification.rejectionReason);

  return (
    <article
      className={`hall-notification-card min-w-0 overflow-hidden rounded-2xl border bg-white shadow-[0_8px_20px_rgba(90,55,45,0.06)] ${cardTone(visualState)} ${
        highlighted
          ? "ring-2 ring-[var(--wesal-maroon)] ring-offset-2 ring-offset-white"
          : ""
      }`}
      data-testid="hall-notification-card"
      data-notification-id={notification.id}
      data-notification-status={notification.status ?? "unknown"}
      data-acceptance-state={visualState}
      data-highlighted={highlighted ? "true" : undefined}
      aria-busy={accepting || rejecting || confirming || undefined}
    >
      <div className="flex min-w-0 flex-col gap-0 p-3 lg:flex-row lg:items-stretch lg:p-0">
        {/* Hall — start (right in RTL) */}
        <div className="flex min-w-0 items-center justify-center gap-2.5 lg:w-[13.5rem] lg:shrink-0 lg:px-3.5 lg:py-3.5">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#efe8e2] sm:h-[3.75rem] sm:w-[3.75rem]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <p
              className="min-w-0 truncate text-sm font-extrabold text-[#2a221c]"
              title={hallName || undefined}
            >
              {hallName?.trim() || t("owner.notifications.hall")}
            </p>
            <span className="shrink-0 text-[var(--wesal-maroon)]" aria-hidden="true">
              <ChevronIcon />
            </span>
          </div>
        </div>

        <Divider />

        {/* Time + remaining — seeker range as-is; layout matches design mock */}
        <div className="flex w-full min-w-0 items-center justify-start gap-3 border-t border-[var(--wesal-border)] py-3 lg:min-w-[10.5rem] lg:flex-1 lg:border-t-0 lg:px-3.5 lg:py-3.5">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f6ecec] text-[#c0392b]">
            <ClockIcon />
          </span>
          <div className="min-w-0 text-start">
            <p className="truncate text-start text-[15px] font-extrabold leading-none text-[#2a221c]">
              <StableClockRangeText label={whenLabel} />
            </p>
            {relativeLabel ? (
              <p className="mt-1.5 text-[12px] font-semibold leading-none text-[#c0392b]">
                {t("owner.notifications.timeRemaining", { value: relativeLabel })}
              </p>
            ) : null}
          </div>
        </div>

        <Divider />

        {/* Day + date — same icon/text rhythm as time block */}
        <div className="flex w-full min-w-0 items-center justify-start gap-3 border-t border-[var(--wesal-border)] py-3 lg:min-w-[9.5rem] lg:flex-1 lg:border-t-0 lg:px-3.5 lg:py-3.5">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f6ecec] text-[#c0392b]">
            <CalendarIcon />
          </span>
          <div className="min-w-0 text-start">
            <p className="truncate text-[15px] font-extrabold leading-none text-[#2a221c]">
              {weekdayLabel || t("owner.notifications.valueMissing")}
            </p>
            <p className="mt-1.5 truncate text-[12px] font-semibold leading-none text-[#5c4f46]">
              {dateLabel || t("owner.notifications.valueMissing")}
            </p>
          </div>
        </div>

        <Divider />

        {/* Customer — compact icons + text; occasion aligned under the icon column */}
        <div className="flex min-w-0 flex-col justify-center gap-1.5 border-t border-[var(--wesal-border)] py-3 lg:min-w-[11.5rem] lg:flex-1 lg:border-t-0 lg:px-3.5 lg:py-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[#f5eaea]">
              {requesterAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={requesterAvatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span
                  className="inline-flex h-full w-full items-center justify-center text-[0.7rem] font-extrabold text-[#6b2f3a]"
                  aria-hidden="true"
                >
                  {avatarLetter}
                </span>
              )}
            </div>
            <p className="min-w-0 truncate text-[0.75rem] font-extrabold text-[#1a1410]">
              {requester}
            </p>
          </div>

          {phone ? (
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f5eaea] text-[#6b2f3a]">
                <PhoneIcon />
              </span>
              <p dir="ltr" className="truncate text-start text-[0.75rem] font-extrabold text-[#1a1410]">
                {phone}
              </p>
            </div>
          ) : null}

          {eventTypeLabel ? (
            <p className="truncate text-[0.65rem] font-bold leading-4 text-[#6b2f3a]">
              {t("owner.notifications.eventType", { value: eventTypeLabel })}
            </p>
          ) : null}
        </div>

        <Divider />

        {/* Status + chat */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-2 border-t border-[var(--wesal-border)] pt-3 lg:w-[11.5rem] lg:border-t-0 lg:px-3.5 lg:py-3.5">
          {depositBadge ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold ${depositBadge.className}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${depositBadge.dot}`} aria-hidden="true" />
              {depositBadge.label}
            </span>
          ) : null}

          {showChat ? (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--wesal-pink)] px-3 py-1.5 text-[0.68rem] font-bold text-[var(--wesal-maroon)] transition hover:bg-[var(--wesal-pink-soft)] disabled:opacity-60"
              disabled={messagingSeeker}
              aria-busy={messagingSeeker || undefined}
              data-testid={`hall-notification-chat-seeker-${notification.id}`}
              onClick={() => onMessageSeeker?.(notification)}
            >
              <ChatIcon />
              {messagingSeeker
                ? t("owner.notifications.chatWithSeekerOpening")
                : t("owner.notifications.contactCustomer")}
            </button>
          ) : null}
        </div>
      </div>

      {hasDetailBody ? (
        <div className="border-t border-[var(--wesal-border)] bg-[#faf8f6] px-3.5 py-3 sm:px-4">
          {notification.status === "AcceptedPendingDeposit" ? (
            <p
              className="text-[0.75rem] leading-5 text-[#8a6a2a]"
              data-testid="owner-deposit-hint"
              role="status"
            >
              {notification.depositAmount != null
                ? t("owner.notifications.depositDue", {
                    amount: formatDepositAmount(notification.depositAmount),
                  })
                : t("owner.notifications.depositHint")}
            </p>
          ) : null}

          {notification.status === "Rejected" && notification.rejectionReason ? (
            <p className="break-words text-sm leading-6 text-[var(--wesal-muted)] [overflow-wrap:anywhere]">
              {notification.rejectionReason}
            </p>
          ) : null}

          {showCancelled ? <AcceptanceFeedback kind="cancelled-status" /> : null}
          {showFinalized && notification.status === "Rejected" ? (
            <AcceptanceFeedback kind="finalized" />
          ) : null}
          {!showCancelled && feedback === "conflict" ? (
            <AcceptanceFeedback id={errorId} kind="conflict" />
          ) : null}
          {!showCancelled && feedback === "generic" && errorText ? (
            <AcceptanceFeedback id={errorId} kind="generic" message={errorText} />
          ) : null}

          {hasActions ? (
            <div
              className={`hall-request-actions ${
                showCancelled ||
                feedback ||
                notification.status === "AcceptedPendingDeposit" ||
                notification.rejectionReason
                  ? "mt-3"
                  : ""
              }`}
            >
              {showReject ? (
                <RejectActionButton
                  bookingId={notification.id}
                  busy={rejecting}
                  disabled={rejectLocked || accepting || confirming}
                  describedBy={errorText ? errorId : undefined}
                  onClick={() => onReject?.(notification)}
                />
              ) : null}
              {showAccept ? (
                <AcceptActionButton
                  bookingId={notification.id}
                  busy={accepting}
                  disabled={acceptLocked || rejecting || confirming}
                  describedBy={errorText || showCancelled ? errorId : undefined}
                  onClick={() => onAccept?.(notification)}
                />
              ) : null}
              {showConfirm ? (
                <button
                  type="button"
                  className="btn-primary hall-accept-btn min-h-11"
                  data-testid={`hall-notification-confirm-payment-${notification.id}`}
                  disabled={confirmLocked || accepting || rejecting}
                  aria-busy={confirming || undefined}
                  onClick={() => onConfirmPayment?.(notification)}
                >
                  {confirming
                    ? t("owner.notifications.confirmingPayment")
                    : t("owner.notifications.confirmPayment")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function Divider() {
  return <div className="hidden w-px shrink-0 self-stretch bg-[var(--wesal-border)] lg:block" aria-hidden="true" />;
}

function depositBadgeFor(
  notification: HallBookingNotification,
  t: (key: string, params?: Record<string, string | number>) => string,
): { label: string; className: string; dot: string } | null {
  if (notification.status === "AcceptedPendingDeposit") {
    return {
      label:
        notification.depositAmount != null
          ? t("owner.notifications.depositBadgeDue", {
              amount: formatDepositAmount(notification.depositAmount),
            })
          : t("owner.notifications.status.pendingDeposit"),
      className: "bg-[#fff4e5] text-[#b86a0a]",
      dot: "bg-[#d97706]",
    };
  }
  if (notification.status === "FullyBooked") {
    return {
      label: t("owner.notifications.status.fullyBooked"),
      className: "bg-[#e8f7ee] text-[#1f8a4c]",
      dot: "bg-[#1f8a4c]",
    };
  }
  if (notification.status === "Rejected") {
    return {
      label: t("owner.notifications.status.rejected"),
      className: "bg-[#fdecea] text-[#b42318]",
      dot: "bg-[#b42318]",
    };
  }
  if (notification.status === "Cancelled") {
    return {
      label: t("owner.notifications.status.cancelled"),
      className: "bg-[#f3f0ed] text-[var(--wesal-muted)]",
      dot: "bg-[var(--wesal-muted)]",
    };
  }
  if (notification.status === "Pending") {
    return {
      label: t("owner.notifications.depositBadgeNone"),
      className: "bg-[#fff1e8] text-[#c06a3a]",
      dot: "bg-[#c06a3a]",
    };
  }
  return null;
}

function formatBookingRelative(
  iso: string | null | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const date = parseDateIso(iso);
  if (!date) return "";
  const today = localTodayIso();
  const [y1, m1, d1] = today.split("-").map(Number);
  const [y2, m2, d2] = date.split("-").map(Number);
  const diff = Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000,
  );
  if (diff === 0) return t("owner.notifications.relative.today");
  if (diff === 1) return t("owner.notifications.relative.inOneDay");
  if (diff > 1) return t("owner.notifications.relative.inDays", { count: diff });
  if (diff === -1) return t("owner.notifications.relative.oneDayAgo");
  return t("owner.notifications.relative.daysAgo", { count: Math.abs(diff) });
}

function displayRequesterName(rawName: string, phone: string): string {
  let name = rawName.trim();
  if (!name) return "";
  if (phone) {
    const suffix = ` - ${phone}`;
    if (name.endsWith(suffix)) name = name.slice(0, -suffix.length).trim();
  }
  const eventSep = name.indexOf(" · ");
  if (eventSep >= 0) name = name.slice(0, eventSep).trim();
  return name;
}

function formatNotificationDayDate(
  iso: string | null | undefined,
  locale: string,
): { weekdayLabel: string; dateLabel: string } {
  const parsed = parseDateIso(iso);
  if (!parsed) return { weekdayLabel: "", dateLabel: "" };
  const [year, month, day] = parsed.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return {
    weekdayLabel: date.toLocaleDateString(locale, { weekday: "long" }),
    dateLabel: date.toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
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

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.15rem] w-[1.15rem]" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.1" stroke="currentColor" strokeWidth="1.85" />
      <path d="M12 7.75v4.35l3.1 1.85" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M8.2 4.8h2.1l1.1 3.2-1.4 1.1a12.4 12.4 0 0 0 4.9 4.9l1.1-1.4 3.2 1.1v2.1c0 .7-.5 1.3-1.2 1.4-6.9.9-12.7-4.9-11.8-11.8.1-.7.7-1.2 1.4-1.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M5 6.5h14v9.5H9.2L5 19.2V6.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 rtl:rotate-180" fill="none" aria-hidden="true">
      <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
