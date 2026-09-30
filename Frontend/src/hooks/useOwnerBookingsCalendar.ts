"use client";

import { useCallback, useEffect, useState } from "react";
import { monthRangeIso } from "@/lib/owner-bookings-calendar";
import { fetchOwnerBookingsCalendar } from "@/services/owner-bookings-calendar";
import type { OwnerBookingsCalendarStatus } from "@/types/owner-bookings-calendar";

type MonthRange = { fromDate: string; toDate: string };

/**
 * Loads one owned hall's bookings calendar for the visible month.
 * The request key is hall + range, so an older hall or month cannot overwrite the current one.
 */
export function useOwnerBookingsCalendar(hallId: string, enabled: boolean) {
  const scopedId = enabled && hallId.trim() ? hallId.trim() : "";
  const [range, setRange] = useState<MonthRange | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const requestKey =
    scopedId && range ? `${scopedId}|${range.fromDate}|${range.toDate}|${retryTick}` : "";
  const [seenKey, setSeenKey] = useState(requestKey);
  const [load, setLoad] = useState<OwnerBookingsCalendarStatus>({ status: "idle" });

  if (requestKey !== seenKey) {
    setSeenKey(requestKey);
    setLoad(requestKey ? { status: "loading" } : { status: "idle" });
  }

  const onVisibleMonthChange = useCallback((year: number, monthIndex: number) => {
    const next = monthRangeIso(year, monthIndex);
    setRange((current) =>
      current?.fromDate === next.fromDate && current.toDate === next.toDate ? current : next,
    );
  }, []);

  const retry = useCallback(() => {
    setRetryTick((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!scopedId || !range) return;

    const controller = new AbortController();
    const requestedHallId = scopedId;
    const requestedFrom = range.fromDate;
    const requestedTo = range.toDate;
    let active = true;

    void fetchOwnerBookingsCalendar(requestedHallId, requestedFrom, requestedTo, controller.signal)
      .then((calendar) => {
        if (!active) return;
        if (
          calendar.hallId &&
          calendar.hallId.localeCompare(requestedHallId, undefined, { sensitivity: "accent" }) !== 0
        ) {
          setLoad({ status: "error" });
          return;
        }
        if (calendar.fromDate !== requestedFrom || calendar.toDate !== requestedTo) {
          setLoad({ status: "error" });
          return;
        }
        setLoad({ status: "ready", calendar });
      })
      .catch(() => {
        if (!active || controller.signal.aborted) return;
        setLoad({ status: "error" });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [scopedId, range, retryTick]);

  return { load, range, onVisibleMonthChange, retry };
}
