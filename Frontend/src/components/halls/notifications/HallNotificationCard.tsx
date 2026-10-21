"use client";

import { useEffect, useState } from "react";
import AcceptActionButton from "@/components/halls/notifications/AcceptActionButton";
import AcceptanceFeedback from "@/components/halls/notifications/AcceptanceFeedback";
import RejectActionButton from "@/components/halls/notifications/RejectActionButton";
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
  const [detailsOpen, setDetailsOpen] = useState(Boolean(highlighted));
  const phone = notification.requesterPhone?.trim() || "";
  const requester =
    displayRequesterName(notification.requesterName, phone) || t("common.user");
  const eventTypeLabel = notification.eventTypeLabel?.trim() || "";
  const dateLabel =
    formatNotificationDate(notification.date, locale) ||
    t("owner.notifications.valueMissing");
  const periodLabels = bookingWhenLabels(notification, t, locale);
  const whenLabel =
    periodLabels.length > 0
      ? periodLabels.join(lang === "ar" ? "، " : ", ")
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
  const imageSrc = hallImageSrc?.trim() || FALLBACK_HALL_IMAGE;
  const hasActions = showAccept || showReject || showConfirm;
  const hasDetailBody =
    hasActions ||
    showCancelled ||
    showFinalized ||
    Boolean(feedback) ||
    notification.status === "AcceptedPendingDeposit" ||
    Boolean(notification.rejectionReason);

  useEffect(() => {
    if (highlighted || errorText) setDetailsOpen(true);
  }, [highlighted, errorText]);

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
      <div className="flex min-w-0 flex-col gap-3 p-3 lg:flex-row lg:items-center lg:gap-3 lg:p-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-2.5 sm:w-[11.5rem] sm:shrink-0">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#efe8e2] sm:h-[3.75rem] sm:w-[3.75rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageSrc} alt="" className="h-full w-full object-cover" />
            </div>
            <p
              className="min-w-0 truncate text-sm font-extrabold text-[var(--wesal-text)]"
              title={hallName || undefined}
            >
              {hallName?.trim() || t("owner.notifications.hall")}
            </p>
          </div>

          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 sm:items-center sm:gap-4">
            <div className="min-w-0">
              <div className="flex items-start gap-1.5">
                <span className="mt-0.5 text-[var(--wesal-maroon)]" aria-hidden="true">
                  <DocIcon />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[0.78rem] font-bold text-[var(--wesal-text)]">
                    {dateLabel}
                  </p>
                  <p className="mt-0.5 truncate text-[0.72rem] font-semibold text-[var(--wesal-text)]">
                    {whenLabel}
                  </p>
                  {relativeLabel ? (
                    <p className="mt-0.5 text-[0.68rem] font-semibold text-[#c0392b]">
                      {relativeLabel}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-pink)] text-sm font-extrabold text-[var(--wesal-maroon)]"
                  aria-hidden="true"
                >
                  {avatarLetter}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[0.78rem] font-extrabold text-[var(--wesal-text)]">
                    {requester}
                  </p>
                  {phone ? (
                    <p dir="ltr" className="truncate text-start text-[0.7rem] text-[var(--wesal-muted)]">
                      {phone}
                    </p>
                  ) : null}
                  {eventTypeLabel ? (
                    <p className="mt-0.5 truncate text-[0.7rem] font-semibold text-[var(--wesal-maroon)]">
                      {t("owner.notifications.eventType", { value: eventTypeLabel })}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 border-t border-[var(--wesal-border)] pt-3 lg:min-w-[14rem] lg:items-stretch lg:border-t-0 lg:pt-0">
          {depositBadge ? (
            <span
              className={`inline-flex self-start rounded-lg px-2.5 py-1 text-[0.68rem] font-bold lg:self-end ${depositBadge.className}`}
            >
              {depositBadge.label}
            </span>
          ) : null}

          {hasDetailBody || showChat ? (
            <div
              className={`grid gap-2 ${hasDetailBody && showChat ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" : "grid-cols-1"}`}
            >
              {hasDetailBody ? (
                <button
                  type="button"
                  className="btn-primary inline-flex min-h-10 w-full items-center justify-center gap-1.5 !rounded-xl !px-3 !text-[0.78rem]"
                  data-testid={`hall-notification-details-${notification.id}`}
                  aria-expanded={detailsOpen}
                  onClick={() => setDetailsOpen((open) => !open)}
                >
                  {detailsOpen
                    ? t("owner.notifications.hideDetails")
                    : t("owner.notifications.viewDetails")}
                  <span aria-hidden="true">{detailsOpen ? "‹" : "›"}</span>
                </button>
              ) : null}

              {showChat ? (
                <button
                  type="button"
                  className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[rgba(166,99,99,0.35)] bg-[#faf6f2] px-3 text-[0.78rem] font-bold text-[var(--wesal-text)] transition hover:bg-[var(--wesal-pink-soft)] disabled:opacity-60"
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
          ) : null}
        </div>
      </div>

      {detailsOpen && hasDetailBody ? (
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
          {showFinalized ? <AcceptanceFeedback kind="finalized" /> : null}
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
                showFinalized ||
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

function depositBadgeFor(
  notification: HallBookingNotification,
  t: (key: string, params?: Record<string, string | number>) => string,
): { label: string; className: string } | null {
  if (notification.status === "AcceptedPendingDeposit") {
    return {
      label:
        notification.depositAmount != null
          ? t("owner.notifications.depositBadgeDue", {
              amount: formatDepositAmount(notification.depositAmount),
            })
          : t("owner.notifications.status.pendingDeposit"),
      className: "bg-[#fff4e5] text-[#b86a0a]",
    };
  }
  if (notification.status === "FullyBooked") {
    return {
      label: t("owner.notifications.status.fullyBooked"),
      className: "bg-[#e8f7ee] text-[#1f8a4c]",
    };
  }
  if (notification.status === "Rejected") {
    return {
      label: t("owner.notifications.status.rejected"),
      className: "bg-[#fdecea] text-[#b42318]",
    };
  }
  if (notification.status === "Cancelled") {
    return {
      label: t("owner.notifications.status.cancelled"),
      className: "bg-[#f3f0ed] text-[var(--wesal-muted)]",
    };
  }
  if (notification.status === "Pending") {
    return {
      label: t("owner.notifications.depositBadgeNone"),
      className: "bg-[#fff1e8] text-[#c06a3a]",
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

function formatNotificationDate(iso: string | null | undefined, locale: string): string {
  const parsed = parseDateIso(iso);
  if (!parsed) return "";
  const [year, month, day] = parsed.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path d="M7 4.5h8.5L19 8v11.5H7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M15 4.5V8h3.5M9 12h6M9 15.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M5 6.5h14v9.5H9.2L5 19.2V6.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
