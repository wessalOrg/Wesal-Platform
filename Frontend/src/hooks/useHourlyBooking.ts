"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { ApiError } from "@/lib/api-error";
import { formatBookingDateLabel, isFutureBookingDate } from "@/lib/booking-date";
import { emitBookingSubmitted } from "@/lib/booking-events";
import { resolveHourlyDayStatus, visibleHourlySlots } from "@/lib/hourly-slots";
import { rememberUserBookings } from "@/lib/user-bookings-store";
import {
  fetchHourlyDay,
  fetchHourlyMonth,
  submitHourlyBooking,
} from "@/services/hourly-bookings";
import type { HourlyDay, HourlyDayStatus, HourlySlot } from "@/types/hourly-booking";

type Options = {
  hallId: string;
  hallName?: string;
  locale: string;
  canSubmit: boolean;
};

type VisibleMonth = { year: number; monthIndex: number };

function mergeDay(days: HourlyDay[], next: HourlyDay): HourlyDay[] {
  const index = days.findIndex((day) => day.dateIso === next.dateIso);
  if (index < 0) return [...days, next];
  const copy = [...days];
  copy[index] = next;
  return copy;
}

export function useHourlyBooking({ hallId, hallName, locale, canSubmit }: Options) {
  const identity = useUserIdentity();
  const [visibleMonth, setVisibleMonth] = useState<VisibleMonth>(() => {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  });
  const { year, monthIndex } = visibleMonth;
  const [days, setDays] = useState<HourlyDay[]>([]);
  const [showBookedSlots, setShowBookedSlots] = useState(true);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [dateIso, setDateIso] = useState<string | null>(null);
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [promptOpen, setPromptOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const loadCatalog = useCallback(
    async (iso: string) => {
      setSlotsLoading(true);
      try {
        const catalog = await fetchHourlyDay(hallId, iso, locale);
        setDays((current) => mergeDay(current, catalog));
        return catalog;
      } catch {
        setErrorKey("errors.hourly.load");
        return null;
      } finally {
        setSlotsLoading(false);
      }
    },
    [hallId, locale],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await fetchHourlyMonth(hallId, year, monthIndex, locale);
      setDays(snapshot.days);
      setShowBookedSlots(snapshot.showBookedSlots);
      if (dateIso) {
        const catalog = await fetchHourlyDay(hallId, dateIso, locale);
        setDays((current) => mergeDay(current.length ? current : snapshot.days, catalog));
      }
    } catch {
      setErrorKey("errors.hourly.load");
    } finally {
      setLoading(false);
    }
  }, [hallId, year, monthIndex, locale, dateIso]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const snapshot = await fetchHourlyMonth(hallId, year, monthIndex, locale);
        if (cancelled) return;
        setDays(snapshot.days);
        setShowBookedSlots(snapshot.showBookedSlots);
      } catch {
        if (!cancelled) setErrorKey("errors.hourly.load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [hallId, year, monthIndex, locale]);

  const selectedDay = useMemo(
    () => days.find((day) => day.dateIso === dateIso) ?? null,
    [days, dateIso],
  );

  const slots = useMemo(() => {
    if (!selectedDay || selectedDay.blocked) return [];
    return visibleHourlySlots(selectedDay.slots, showBookedSlots);
  }, [selectedDay, showBookedSlots]);

  const selectedSlot = slots.find((slot) => slot.start === slotStart) ?? null;
  const dateLabel = dateIso ? formatBookingDateLabel(dateIso, locale) : "";

  const dayStatuses = useMemo(() => {
    const map: Record<string, HourlyDayStatus> = {};
    for (const day of days) {
      map[day.dateIso] = resolveHourlyDayStatus(day, day.dateIso);
    }
    return map;
  }, [days]);

  const selectDate = useCallback(
    (iso: string) => {
      if (!isFutureBookingDate(iso)) return;
      const day = days.find((item) => item.dateIso === iso);
      if (day?.blocked) return;
      setDateIso(iso);
      setSlotStart(null);
      setErrorKey(null);
      void loadCatalog(iso);
    },
    [days, loadCatalog],
  );

  const selectSlot = useCallback(
    (slot: HourlySlot) => {
      if (submitting) return;
      if (slot.status !== "available") {
        setErrorKey("errors.hourly.slotBooked");
        return;
      }
      if (!canSubmit) return;
      setSlotStart(slot.start);
      setPromptOpen(true);
      setErrorKey(null);
    },
    [canSubmit, submitting],
  );

  const closePrompt = useCallback(() => {
    if (submitting) return;
    setPromptOpen(false);
  }, [submitting]);

  const submit = useCallback(async () => {
    if (!canSubmit || !dateIso || !selectedSlot || submitting) return;
    const customerName = name.trim();
    if (!customerName) {
      setErrorKey("errors.hourly.nameRequired");
      return;
    }

    setSubmitting(true);
    setErrorKey(null);
    try {
      const result = await submitHourlyBooking({
        hallId,
        date: dateIso,
        slotTime: selectedSlot.start,
        customerName,
        requesterName: identity.displayName?.trim() || customerName,
      });
      if (result.bookingId) {
        rememberUserBookings([
          {
            bookingId: result.bookingId,
            hallId,
            hallName: hallName?.trim() || "",
            date: dateIso,
            slotStart: selectedSlot.start,
            timeRange: selectedSlot.label,
            status: "Pending",
          },
        ]);
        emitBookingSubmitted({
          hallId,
          hallName: hallName?.trim() || "",
          date: dateIso,
          bookingId: result.bookingId,
          timeRange: selectedSlot.label,
        });
      }
      setPromptOpen(false);
      setName("");
      await reload();
    } catch (err) {
      const key =
        err instanceof ApiError && err.message.startsWith("errors.")
          ? err.message
          : "errors.hourly.generic";
      setErrorKey(key);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, dateIso, selectedSlot, submitting, name, hallId, hallName, identity.displayName, reload]);

  const shiftMonth = useCallback((delta: number) => {
    setVisibleMonth((current) => {
      const next = new Date(current.year, current.monthIndex + delta, 1);
      return { year: next.getFullYear(), monthIndex: next.getMonth() };
    });
    setDateIso(null);
    setSlotStart(null);
  }, []);

  return {
    year,
    monthIndex,
    shiftMonth,
    loading,
    slotsLoading,
    days,
    dayStatuses,
    dateIso,
    dateLabel,
    selectDate,
    slots,
    selectedSlot,
    selectSlot,
    promptOpen,
    closePrompt,
    name,
    setName,
    submit,
    submitting,
    errorKey,
    showBookedSlots,
    canSubmit,
  };
}
