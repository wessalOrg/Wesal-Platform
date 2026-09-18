"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DeleteConfirmationDialog from "@/components/halls/schedule/DeleteConfirmationDialog";
import ResponsiveScheduleCard from "@/components/halls/schedule/ResponsiveScheduleCard";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useDeleteBooking } from "@/hooks/useDeleteBooking";
import { useHallNotifications } from "@/hooks/useHallNotifications";
import { usePublishBooking } from "@/hooks/usePublishBooking";
import { useT } from "@/i18n";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { bookingPeriodI18nKey } from "@/lib/booking-rejection-message";
import { OWNER_DELETION_EXIT_MS } from "@/lib/owner-deletion-ui";
import { publishOwnerDepositSlotsFromItems } from "@/lib/owner-deposit-slot-store";
import { visibleScheduleBookings } from "@/lib/owner-publish-booking";
import { publishOwnerPublishedSlotsFromItems } from "@/lib/owner-published-slot-store";
import type { DeleteBookingResult, HallBookingNotification } from "@/types/hall-notifications";
import "@/components/halls/notifications/hall-notifications.css";

type OwnerAvailabilityScheduleProps = {
  hallId: string;
  hallName?: string;
};

export default function OwnerAvailabilitySchedule({
  hallId,
  hallName,
}: OwnerAvailabilityScheduleProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const enabled = Boolean(hallId);
  const bookings = useHallNotifications(hallId, enabled);
  const [publishedIds, setPublishedIds] = useState<Set<string>>(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState<HallBookingNotification | null>(null);
  const [exitingIds, setExitingIds] = useState<Set<string>>(() => new Set());
  const [exitingCards, setExitingCards] = useState<HallBookingNotification[]>([]);
  const exitTimersRef = useRef<number[]>([]);
  const publish = usePublishBooking({
    onPublished: (result) => {
      bookings.applyPublished(result);
      setPublishedIds((current) => {
        const next = new Set(current);
        next.add(result.bookingId);
        return next;
      });
    },
    onStatusSync: bookings.applyStatus,
  });

  const finishDeleted = useCallback(
    (result: DeleteBookingResult) => {
      bookings.applyDeleted(result);
      setPublishedIds((current) => {
        if (!current.has(result.bookingId)) return current;
        const next = new Set(current);
        next.delete(result.bookingId);
        return next;
      });
      setExitingIds((current) => {
        if (!current.has(result.bookingId)) return current;
        const next = new Set(current);
        next.delete(result.bookingId);
        return next;
      });
      setExitingCards((current) => current.filter((item) => item.id !== result.bookingId));
    },
    [bookings.applyDeleted],
  );

  const deletion = useDeleteBooking({
    onDeleted: (result) => {
      setDeleteTarget((current) => {
        if (current?.id === result.bookingId) return null;
        return current;
      });
      setExitingIds((current) => {
        const next = new Set(current);
        next.add(result.bookingId);
        return next;
      });
      setExitingCards((current) => {
        if (current.some((item) => item.id === result.bookingId)) return current;
        const snapshot =
          bookings.items.find((item) => item.id === result.bookingId) ??
          (deleteTarget?.id === result.bookingId ? deleteTarget : null);
        return snapshot ? [...current, snapshot] : current;
      });
      const timer = window.setTimeout(() => {
        finishDeleted(result);
      }, OWNER_DELETION_EXIT_MS);
      exitTimersRef.current.push(timer);
    },
  });

  useEffect(() => {
    setPublishedIds(new Set());
    setDeleteTarget(null);
    setExitingIds(new Set());
    setExitingCards([]);
  }, [hallId]);

  useEffect(() => {
    return () => {
      exitTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      exitTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (bookings.status !== "ready" && bookings.status !== "empty") return;
    publishOwnerDepositSlotsFromItems(hallId, bookings.items);
    publishOwnerPublishedSlotsFromItems(hallId, bookings.items);
  }, [bookings.items, bookings.status, enabled, hallId]);

  const listed = visibleScheduleBookings(
    bookings.items,
    publish.publishingId,
    publishedIds,
    deletion.deletingId,
  );
  const listedIds = new Set(listed.map((item) => item.id));
  const cards = [
    ...listed,
    ...exitingCards.filter((item) => !listedIds.has(item.id)),
  ];
  const onPublish = useCallback(
    (item: HallBookingNotification) => {
      void publish.publish(item.hallId || hallId, item.id);
    },
    [hallId, publish.publish],
  );
  const onDelete = useCallback((item: HallBookingNotification) => {
    deletion.clearError(item.id);
    setDeleteTarget(item);
  }, [deletion.clearError]);

  const deleteDateLabel = deleteTarget?.date
    ? formatBookingDateLabel(deleteTarget.date, locale)
    : undefined;
  const deletePeriodLabels =
    deleteTarget?.periods.map((period) => t(bookingPeriodI18nKey(period))) ?? [];

  return (
    <div className="space-y-4" data-testid="owner-availability-schedule">
      {cards.length > 0 ? (
        <section className="space-y-3" aria-labelledby="owner-schedule-publish-heading">
          <div>
            <h3
              id="owner-schedule-publish-heading"
              className="text-sm font-bold text-[var(--wesal-maroon)]"
            >
              {t("owner.schedule.publishableTitle")}
            </h3>
            <p className="mt-1 text-sm leading-6 text-[var(--wesal-muted)]">
              {t("owner.schedule.publishHint")}
            </p>
          </div>
          <ul className="owner-schedule-cards">
            {cards.map((booking) => (
              <li key={booking.id} className="min-w-0">
                <ResponsiveScheduleCard
                  booking={booking}
                  publishing={publish.publishingId === booking.id}
                  deleting={deletion.deletingId === booking.id}
                  exiting={exitingIds.has(booking.id)}
                  errorKey={publish.errorById[booking.id] ?? null}
                  deleteErrorKey={deletion.errorById[booking.id] ?? null}
                  onPublish={onPublish}
                  onDelete={onDelete}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <DeleteConfirmationDialog
        open={Boolean(deleteTarget)}
        busy={Boolean(deleteTarget && deletion.deletingId === deleteTarget.id)}
        errorKey={deleteTarget ? deletion.errorById[deleteTarget.id] ?? null : null}
        hallName={hallName}
        dateLabel={deleteDateLabel}
        periodLabels={deletePeriodLabels}
        onClose={() => {
          if (!deletion.deletingId) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (!deleteTarget) return;
          void deletion.remove(deleteTarget.hallId || hallId, deleteTarget.id, {
            date: deleteTarget.date,
            periods: deleteTarget.periods,
          });
        }}
      />
    </div>
  );
}
