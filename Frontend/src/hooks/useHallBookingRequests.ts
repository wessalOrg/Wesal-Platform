"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  ApiError,
  isForbiddenApiError,
  isUnauthorizedApiError,
} from "@/lib/api-error";
import {
  BOOKING_CANCELLED_EVENT,
  type BookingCancelledDetail,
} from "@/lib/booking-events";
import { parseBookingPeriodType } from "@/lib/booking-period";
import { subscribeOwnerBookingRequestEvents } from "@/services/booking-notification-realtime";
import { fetchOwnerHallBookingRequests } from "@/services/owner-hall-booking-requests";
import type {
  OwnerHallBookingRequest,
  OwnerHallBookingRequestsErrorKind,
  OwnerHallBookingRequestsLoadStatus,
} from "@/types/owner-hall-booking-requests";

function mapErrorKind(err: unknown): OwnerHallBookingRequestsErrorKind {
  if (err instanceof ApiError) {
    if (err.status === 0) return "network";
    if (err.status === 401) return "unauthorized";
    if (err.status === 403) return "forbidden";
    if (err.status === 404) return "not_found";
  }
  return "generic";
}

function errorMessageKey(kind: OwnerHallBookingRequestsErrorKind): string {
  if (kind === "network") {
    return "owner.management.notifications.errors.network";
  }
  if (kind === "forbidden") {
    return "owner.management.notifications.errors.forbidden";
  }
  if (kind === "not_found") {
    return "owner.management.notifications.errors.notFound";
  }
  if (kind === "unauthorized") {
    return "owner.management.notifications.errors.unauthorized";
  }
  return "owner.management.notifications.errors.loadFailed";
}

/**
 * Hall-ID-scoped booking request notifications (US-OWNER-09).
 * Switching hallId clears previous Hall requests before the next fetch settles.
 */
export function useHallBookingRequests(hallId: string) {
  const { logout } = useAuth();

  const [boundHallId, setBoundHallId] = useState(hallId);
  const [requests, setRequests] = useState<OwnerHallBookingRequest[]>([]);
  const [status, setStatus] = useState<OwnerHallBookingRequestsLoadStatus>(() =>
    hallId.trim() ? "loading" : "ready",
  );
  const [errorKind, setErrorKind] =
    useState<OwnerHallBookingRequestsErrorKind | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const generationRef = useRef(0);
  const hasLoadedForHallRef = useRef<string | null>(null);

  if (hallId !== boundHallId) {
    setBoundHallId(hallId);
    setRequests([]);
    setErrorKind(null);
    setErrorKey(null);
    setIsRefreshing(false);
    // No Hall selected → nothing to load; otherwise the effect below fetches.
    setStatus(hallId.trim() ? "loading" : "ready");
  }

  useEffect(() => {
    hasLoadedForHallRef.current = null;
  }, [boundHallId]);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const requestHallId = hallId.trim();
      if (!requestHallId) {
        setRequests([]);
        setStatus("ready");
        setIsRefreshing(false);
        return;
      }
      const generation = ++generationRef.current;

      const soft =
        mode === "refresh" && hasLoadedForHallRef.current === requestHallId;

      if (soft) {
        setIsRefreshing(true);
      } else {
        setStatus("loading");
        setRequests([]);
      }
      setErrorKind(null);
      setErrorKey(null);

      try {
        const next = await fetchOwnerHallBookingRequests(requestHallId);
        if (generation !== generationRef.current) return;
        // Drop responses that no longer match the selected Hall.
        const scoped = next.filter((item) => item.hallId === requestHallId);
        setRequests(scoped);
        hasLoadedForHallRef.current = requestHallId;
        setStatus("ready");
        setIsRefreshing(false);
      } catch (err) {
        if (generation !== generationRef.current) return;
        if (isUnauthorizedApiError(err)) {
          await logout({ redirect: false });
          setRequests([]);
          setStatus("idle");
          setErrorKind("unauthorized");
          setErrorKey(errorMessageKey("unauthorized"));
          setIsRefreshing(false);
          return;
        }

        const kind = isForbiddenApiError(err)
          ? "forbidden"
          : mapErrorKind(err);
        setErrorKind(kind);
        setErrorKey(errorMessageKey(kind));
        if (!soft) {
          setRequests([]);
          setStatus("error");
        } else {
          // Keep previous Hall-scoped list on soft refresh failure.
          setStatus("ready");
        }
        setIsRefreshing(false);
      }
    },
    [hallId, logout],
  );

  useEffect(() => {
    generationRef.current += 1;
    // Empty hallId state is already reconciled during render above.
    if (!hallId.trim()) return;
    const timer = window.setTimeout(() => {
      void load("initial");
    }, 0);
    return () => {
      window.clearTimeout(timer);
      generationRef.current += 1;
    };
  }, [hallId, load]);

  const refetch = useCallback(() => {
    void load(
      hasLoadedForHallRef.current === hallId ? "refresh" : "initial",
    );
  }, [hallId, load]);

  useEffect(() => {
    if (!hallId.trim()) return;
    const onCancelled = (event: Event) => {
      const detail = (event as CustomEvent<BookingCancelledDetail>).detail;
      if (!detail?.bookingId) return;
      if (detail.hallId && detail.hallId !== hallId) return;
      setRequests((current) =>
        current
          .map((item) =>
            item.id === detail.bookingId ? { ...item, status: "Cancelled" as const } : item,
          )
          .filter((item) => item.status !== "Cancelled"),
      );
      void load("refresh");
    };
    window.addEventListener(BOOKING_CANCELLED_EVENT, onCancelled);
    const unsubscribeRealtime = subscribeOwnerBookingRequestEvents((event) => {
      if (event.replay || event.kind === "cancelled" || !event.id) return;
      if (event.hallId && event.hallId !== hallId) return;
      const period = parseBookingPeriodType(event.period);
      setRequests((current) => {
        if (current.some((item) => item.id === event.id)) return current;
        return [
          {
            id: event.id,
            hallId: event.hallId || hallId,
            requesterName: event.requesterName ?? "",
            date: event.date ?? "",
            periods: period ? [period] : [],
            timeRange: event.timeRange,
            status: "Pending",
            createdAt: new Date().toISOString(),
          },
          ...current,
        ];
      });
      setStatus("ready");
      void load("refresh");
    });
    return () => {
      window.removeEventListener(BOOKING_CANCELLED_EVENT, onCancelled);
      unsubscribeRealtime();
    };
  }, [hallId, load]);

  return {
    hallId,
    requests,
    status,
    errorKind,
    errorKey,
    isLoading: status === "loading",
    isError: status === "error",
    isRefreshing,
    isEmpty: status === "ready" && requests.length === 0,
    refetch,
  };
}
