"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookingError } from "@/lib/booking-errors";
import { BOOKING_CANCELLED_EVENT } from "@/lib/booking-events";
import { fetchPeriodAvailability } from "@/services/bookings";
import type { HallAvailabilityDay, HallDayPeriod } from "@/types/hall";

type Options = {
  hallId: string;
  dateIso: string | null;
  seedDays: HallAvailabilityDay[];
  enabled: boolean;
};

export function usePeriodAvailability({ hallId, dateIso, seedDays, enabled }: Options) {
  const [periods, setPeriods] = useState<HallDayPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const seedRef = useRef(seedDays);
  const loadedDateRef = useRef<string | null>(null);
  seedRef.current = seedDays;

  const reset = useCallback(() => {
    requestId.current += 1;
    loadedDateRef.current = null;
    setPeriods([]);
    setLoading(false);
    setError(null);
  }, []);

  const reload = useCallback(async () => {
    if (!enabled || !dateIso) {
      loadedDateRef.current = null;
      setPeriods([]);
      setLoading(false);
      setError(null);
      return [];
    }

    const id = ++requestId.current;
    const dateChanged = loadedDateRef.current !== dateIso;
    setLoading(true);
    setError(null);
    if (dateChanged) setPeriods([]);

    try {
      const next = await fetchPeriodAvailability(hallId, dateIso, seedRef.current);
      if (id !== requestId.current) return [];
      loadedDateRef.current = dateIso;
      setPeriods(next);
      return next;
    } catch (err) {
      if (id !== requestId.current) return [];
      const message =
        err instanceof BookingError ? err.message : "errors.booking.availability";
      setError(message);
      setPeriods([]);
      return [];
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [enabled, dateIso, hallId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onCancelled = (event: Event) => {
      const detail = (event as CustomEvent<{ hallId?: string; date?: string }>).detail;
      if (!detail?.hallId || detail.hallId !== hallId) return;
      if (dateIso && detail.date && detail.date !== dateIso) return;
      void reload();
    };
    window.addEventListener(BOOKING_CANCELLED_EVENT, onCancelled);
    return () => window.removeEventListener(BOOKING_CANCELLED_EVENT, onCancelled);
  }, [hallId, dateIso, reload]);

  return { periods, loading, error, reload, reset, setPeriods };
}
