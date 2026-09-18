"use client";

import { useCallback, useEffect, useState } from "react";
import { notificationErrorKind } from "@/lib/hall-notifications";
import { parseBookingPeriodType } from "@/lib/booking-period";
import {
  BOOKING_ACCEPTED_EVENT,
  BOOKING_DELETED_EVENT,
  type BookingAcceptedDetail,
  type BookingDeletedDetail,
} from "@/lib/booking-events";
import { subscribeOwnerBookingRequestEvents } from "@/services/booking-notification-realtime";
import { fetchHallBookingNotifications } from "@/services/hall-notifications";
import type {
  AcceptBookingResult,
  HallBookingNotification,
  HallNotificationStatus,
  OwnerBookingRequestStatus,
  PublishBookingResult,
  DeleteBookingResult,
  RejectBookingResult,
} from "@/types/hall-notifications";

function statusFromKind(
  kind: ReturnType<typeof notificationErrorKind>,
): HallNotificationStatus {
  if (kind === "unauthorized") return "unauthorized";
  if (kind === "forbidden") return "forbidden";
  if (kind === "not_found") return "not_found";
  return "error";
}

/**
 * Hall-scoped booking-request notifications.
 * Changing `hallId` immediately drops the previous hall's list.
 */
export function useHallNotifications(hallId: string | null, enabled: boolean) {
  const scopedId = enabled && hallId?.trim() ? hallId.trim() : null;
  const [seenId, setSeenId] = useState<string | null>(scopedId);
  const [retryTick, setRetryTick] = useState(0);
  const [status, setStatus] = useState<HallNotificationStatus>(scopedId ? "loading" : "idle");
  const [items, setItems] = useState<HallBookingNotification[]>([]);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  if (scopedId !== seenId) {
    setSeenId(scopedId);
    setItems([]);
    setErrorKey(null);
    setStatus(scopedId ? "loading" : "idle");
  }

  useEffect(() => {
    if (!scopedId) return;

    const controller = new AbortController();
    let cancelled = false;

    void fetchHallBookingNotifications(scopedId, controller.signal)
      .then((next) => {
        if (cancelled) return;
        setItems((current) => {
          const merged = mergePendingWithKeptSchedule(next, current);
          setStatus(merged.length === 0 ? "empty" : "ready");
          return merged;
        });
        setErrorKey(null);
      })
      .catch((err: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        const kind = notificationErrorKind(err);
        setItems([]);
        setErrorKey(
          kind === "unauthorized"
            ? "errors.owner.notifications.unauthorized"
            : kind === "forbidden"
              ? "errors.owner.notifications.forbidden"
              : kind === "not_found"
                ? "errors.owner.notifications.notFound"
                : "errors.owner.notifications.load",
        );
        setStatus(statusFromKind(kind));
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [scopedId, retryTick]);

  useEffect(() => {
    if (!scopedId) return;

    const onDeleted = (event: Event) => {
      const detail = (event as CustomEvent<BookingDeletedDetail>).detail;
      if (!detail?.bookingId) return;
      if (detail.hallId && detail.hallId !== scopedId) return;
      setItems((current) => current.filter((item) => item.id !== detail.bookingId));
    };

    window.addEventListener(BOOKING_DELETED_EVENT, onDeleted);
    return () => window.removeEventListener(BOOKING_DELETED_EVENT, onDeleted);
  }, [scopedId]);

  useEffect(() => {
    if (!scopedId) return;

    const onAccepted = (event: Event) => {
      const detail = (event as CustomEvent<BookingAcceptedDetail>).detail;
      if (!detail?.bookingId) return;
      if (detail.hallId && detail.hallId !== scopedId) return;
      setItems((current) => {
        const nextItem: HallBookingNotification = {
          id: detail.bookingId,
          hallId: detail.hallId || scopedId,
          requesterName: "",
          requesterUserId: "",
          date: detail.date,
          periods: detail.periods ?? [],
          status: "AcceptedPendingDeposit",
          canPublish: true,
          isPublished: false,
          canDelete: true,
        };
        let found = false;
        const mapped = current.map((item) => {
          if (item.id !== detail.bookingId) return item;
          found = true;
          return {
            ...item,
            ...nextItem,
            requesterName: item.requesterName,
            requesterUserId: item.requesterUserId,
            date: detail.date || item.date,
            periods:
              detail.periods && detail.periods.length > 0
                ? detail.periods
                : item.periods,
          };
        });
        return found ? mapped : [nextItem, ...current];
      });
    };

    window.addEventListener(BOOKING_ACCEPTED_EVENT, onAccepted);
    return () => window.removeEventListener(BOOKING_ACCEPTED_EVENT, onAccepted);
  }, [scopedId]);

  useEffect(() => {
    if (!scopedId) return;

    return subscribeOwnerBookingRequestEvents((event) => {
      if (event.replay) return;
      if (event.hallId && event.hallId !== scopedId) return;

      const period = parseBookingPeriodType(event.period);
      setItems((current) => {
        if (current.some((item) => item.id === event.id)) return current;
        const incoming: HallBookingNotification = {
          id: event.id,
          hallId: event.hallId || scopedId,
          requesterName: event.requesterName ?? "",
          requesterUserId: "",
          date: event.date ?? "",
          periods: period ? [period] : [],
          status: "Pending",
          canPublish: false,
          isPublished: false,
          canDelete: false,
        };
        return [incoming, ...current];
      });
      setErrorKey(null);
      setStatus("ready");
    });
  }, [scopedId]);

  const retry = useCallback(() => {
    if (!scopedId) return;
    setErrorKey(null);
    setStatus("loading");
    setRetryTick((n) => n + 1);
  }, [scopedId]);

  const patchItem = useCallback((bookingId: string, patch: Partial<HallBookingNotification>) => {
    setItems((current) =>
      current.map((item) => (item.id === bookingId ? { ...item, ...patch } : item)),
    );
  }, []);

  const applyAccepted = useCallback((result: AcceptBookingResult) => {
    setItems((current) => {
      const nextItem: HallBookingNotification = {
        id: result.bookingId,
        hallId: result.hallId,
        requesterName: "",
        requesterUserId: "",
        date: result.date,
        periods: result.periods,
        status: result.status,
        canPublish: true,
        isPublished: false,
        canDelete: true,
      };
      let found = false;
      const mapped = current.map((item) => {
        if (item.id !== result.bookingId) return item;
        found = true;
        return {
          ...item,
          ...nextItem,
          requesterName: item.requesterName,
          requesterUserId: item.requesterUserId,
          date: result.date || item.date,
          periods: result.periods.length > 0 ? result.periods : item.periods,
        };
      });
      return found ? mapped : [nextItem, ...current];
    });
  }, []);

  const applyRejected = useCallback((result: RejectBookingResult) => {
    setItems((current) =>
      current.map((item) =>
        item.id === result.bookingId
          ? {
              ...item,
              status: "Rejected",
              date: result.date || item.date,
              periods: result.periods.length > 0 ? result.periods : item.periods,
              rejectionReason: result.rejectionReason || item.rejectionReason,
              canPublish: false,
              isPublished: false,
              canDelete: false,
            }
          : item,
      ),
    );
  }, []);

  const applyPublished = useCallback((result: PublishBookingResult) => {
    setItems((current) =>
      current.map((item) =>
        item.id === result.bookingId
          ? {
              ...item,
              status: "FullyBooked",
              date: result.date || item.date,
              periods: result.periods.length > 0 ? result.periods : item.periods,
              canPublish: false,
              isPublished: true,
              canDelete: true,
            }
          : item,
      ),
    );
  }, []);

  const applyDeleted = useCallback((result: DeleteBookingResult) => {
    setItems((current) => current.filter((item) => item.id !== result.bookingId));
  }, []);

  const applyStatus = useCallback((bookingId: string, next: OwnerBookingRequestStatus) => {
    setItems((current) =>
      current.map((item) =>
        item.id === bookingId
          ? {
              ...item,
              status: next,
              isPublished: next === "FullyBooked" ? true : next === "Rejected" || next === "Cancelled" ? false : item.isPublished,
              canPublish: next === "AcceptedPendingDeposit",
              canDelete: next === "AcceptedPendingDeposit" || next === "FullyBooked",
            }
          : item,
      ),
    );
  }, []);

  return {
    status,
    items,
    errorKey,
    retry,
    applyAccepted,
    applyRejected,
    applyPublished,
    applyDeleted,
    applyStatus,
    patchItem,
    hallId: scopedId,
  };
}

function keepOnSchedule(item: HallBookingNotification): boolean {
  return (
    item.canPublish ||
    item.canDelete ||
    item.isPublished ||
    item.status === "AcceptedPendingDeposit" ||
    item.status === "FullyBooked"
  );
}

function mergePendingWithKeptSchedule(
  pending: HallBookingNotification[],
  current: HallBookingNotification[],
): HallBookingNotification[] {
  const pendingIds = new Set(pending.map((item) => item.id));
  const kept = current.filter((item) => keepOnSchedule(item) && !pendingIds.has(item.id));
  return [...pending, ...kept];
}
