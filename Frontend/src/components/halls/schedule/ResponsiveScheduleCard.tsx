"use client";

import { memo } from "react";
import BookingRowAction from "@/components/halls/schedule/BookingRowAction";
import DeleteActionButton from "@/components/halls/schedule/DeleteActionButton";
import DeletingStateWrapper from "@/components/halls/schedule/DeletingStateWrapper";
import DeletionFeedback from "@/components/halls/schedule/DeletionFeedback";
import PublicationFeedback from "@/components/halls/schedule/PublicationFeedback";
import PublicationStatusBadge from "@/components/halls/schedule/PublicationStatusBadge";
import PublishActionButton from "@/components/halls/schedule/PublishActionButton";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { bookingPeriodI18nKey } from "@/lib/booking-rejection-message";
import { canDeleteBooking } from "@/lib/owner-delete-booking";
import {
  cardDeletionState,
  deletionFeedbackKind,
  deletionLocksAction,
} from "@/lib/owner-deletion-ui";
import { canPublishBooking } from "@/lib/owner-publish-booking";
import {
  cardPublicationState,
  publicationFeedbackKind,
} from "@/lib/owner-publication-ui";
import type { HallBookingNotification } from "@/types/hall-notifications";

export type ResponsiveScheduleCardProps = {
  booking: HallBookingNotification;
  publishing?: boolean;
  deleting?: boolean;
  exiting?: boolean;
  errorKey?: string | null;
  deleteErrorKey?: string | null;
  onPublish?: (booking: HallBookingNotification) => void;
  onDelete?: (booking: HallBookingNotification) => void;
};

function ResponsiveScheduleCard({
  booking,
  publishing = false,
  deleting = false,
  exiting = false,
  errorKey = null,
  deleteErrorKey = null,
  onPublish,
  onDelete,
}: ResponsiveScheduleCardProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const dateLabel = booking.date
    ? formatBookingDateLabel(booking.date, locale)
    : t("owner.notifications.valueMissing");
  const periodLabels =
    booking.periods.length > 0
      ? booking.periods.map((period) => t(bookingPeriodI18nKey(period)))
      : [t("owner.notifications.valueMissing")];
  const published = booking.isPublished || booking.status === "FullyBooked";
  const showPublish = Boolean(onPublish) && canPublishBooking(booking);
  const showDelete = Boolean(onDelete) && canDeleteBooking(booking);
  const visualState = cardPublicationState({
    published,
    publishing,
    errorKey: errorKey ?? deleteErrorKey,
  });
  const deletionState = cardDeletionState({
    deleting,
    exiting,
    errorKey: deleteErrorKey,
  });
  const feedback = publicationFeedbackKind(errorKey);
  const deleteFeedback = deletionFeedbackKind(deleteErrorKey);
  const errorText = translateKeyedText(t, errorKey);
  const deleteErrorText = translateKeyedText(t, deleteErrorKey);
  const errorId = `hall-schedule-publish-error-${booking.id}`;
  const deleteErrorId = `hall-schedule-delete-error-${booking.id}`;
  const deleteLocked = deletionLocksAction(deletionState);
  const busy = publishing || deleting || exiting;

  return (
    <DeletingStateWrapper state={deletionState}>
      <article
        className={`owner-schedule-card min-w-0 overflow-hidden rounded-2xl border bg-white px-3.5 py-3 shadow-[0_8px_20px_rgba(90,55,45,0.06)] sm:px-4 sm:py-3.5 ${cardTone(visualState, deletionState)}`}
        data-testid="hall-schedule-booking-card"
        data-booking-id={booking.id}
        data-hall-id={booking.hallId}
        data-publication-state={visualState}
        data-deletion-state={deletionState}
        data-published={published ? "true" : "false"}
        aria-busy={busy || undefined}
      >
        <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">
              {t("owner.notifications.date")}
            </p>
            <p
              className="mt-0.5 break-words text-sm font-semibold leading-6 text-[var(--wesal-text)] [overflow-wrap:anywhere]"
              title={dateLabel}
            >
              {dateLabel}
            </p>
          </div>
          {published ? <PublicationStatusBadge live={publishing} /> : null}
        </div>

        <div className="mt-3 min-w-0">
          <p className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">
            {t("owner.notifications.periods")}
          </p>
          <div className="owner-schedule-periods mt-1">
            {periodLabels.map((label, index) => (
              <span
                key={`${booking.id}-${label}-${index}`}
                className="max-w-full break-words rounded-full bg-[var(--wesal-pink-soft)] px-2.5 py-1 text-[0.72rem] font-semibold leading-5 text-[var(--wesal-text)] [overflow-wrap:anywhere]"
                title={label}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {feedback && errorText ? (
          <PublicationFeedback id={errorId} kind={feedback} message={errorText} />
        ) : null}

        {deleteFeedback && deleteErrorText ? (
          <DeletionFeedback id={deleteErrorId} kind={deleteFeedback} message={deleteErrorText} />
        ) : null}

        {publishing ? (
          <p className="sr-only" role="status" aria-live="polite">
            {t("owner.schedule.publishing")}
          </p>
        ) : null}

        {deleting ? (
          <p className="sr-only" role="status" aria-live="polite">
            {t("owner.schedule.deleting")}
          </p>
        ) : null}

        {exiting ? (
          <p className="sr-only" role="status" aria-live="polite">
            {t("owner.schedule.deletedLive")}
          </p>
        ) : null}

        {showPublish || showDelete ? (
          <BookingRowAction busy={busy}>
            {showDelete ? (
              <DeleteActionButton
                bookingId={booking.id}
                hallId={booking.hallId}
                busy={deleting}
                disabled={publishing || deleteLocked}
                describedBy={deleteErrorText ? deleteErrorId : undefined}
                onClick={() => onDelete?.(booking)}
              />
            ) : null}
            {showPublish ? (
              <PublishActionButton
                bookingId={booking.id}
                hallId={booking.hallId}
                busy={publishing}
                disabled={deleting || exiting}
                describedBy={errorText ? errorId : undefined}
                onClick={() => onPublish?.(booking)}
              />
            ) : null}
          </BookingRowAction>
        ) : null}
      </article>
    </DeletingStateWrapper>
  );
}

function translateKeyedText(t: (key: string) => string, key: string | null): string | null {
  if (!key) return null;
  if (key.startsWith("errors.") || key.startsWith("owner.")) return t(key);
  return key;
}

function cardTone(publication: string, deletion: string): string {
  if (deletion === "exiting") return "border-[var(--wesal-border)]";
  if (deletion === "deleting") return "border-[rgba(193,123,127,0.45)]";
  if (deletion === "conflict") return "border-red-200";
  if (deletion === "failed") return "border-red-200";
  if (publication === "published") return "border-emerald-200";
  if (publication === "conflict" || publication === "failure") return "border-red-200";
  if (publication === "publishing") return "border-[rgba(193,123,127,0.45)]";
  return "border-[var(--wesal-border)]";
}

function propsEqual(prev: ResponsiveScheduleCardProps, next: ResponsiveScheduleCardProps): boolean {
  return (
    prev.booking === next.booking &&
    prev.publishing === next.publishing &&
    prev.deleting === next.deleting &&
    prev.exiting === next.exiting &&
    prev.errorKey === next.errorKey &&
    prev.deleteErrorKey === next.deleteErrorKey &&
    prev.onPublish === next.onPublish &&
    prev.onDelete === next.onDelete
  );
}

export default memo(ResponsiveScheduleCard, propsEqual);
