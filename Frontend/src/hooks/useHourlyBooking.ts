"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUserIdentity } from "@/hooks/useUserIdentity";
import { ApiError } from "@/lib/api-error";
import { formatBookingDateLabel, isFutureBookingDate } from "@/lib/booking-date";
import { emitBookingSubmitted } from "@/lib/booking-events";
import { isValidRegisterPhone } from "@/lib/register-validation";
import { pushPlatformNotification } from "@/lib/platform-notifications-store";
import {
  formatClockRange,
  formatHourlyRange,
  hourChoicesFromSlots,
  resolveHourlyDayStatus,
  slotStartsBetween,
} from "@/lib/hourly-slots";
import { rememberUserBookings } from "@/lib/user-bookings-store";
import {
  fetchHourlyDay,
  fetchHourlyMonth,
  hourlyUsesLiveApi,
  submitHourlyBooking,
} from "@/services/hourly-bookings";
import type { HourlyDay, HourlyDayStatus, HourlySlot } from "@/types/hourly-booking";

export type HourlySummarySelection = {
  dateLabel: string;
  timeLabel: string;
};

type Options = {
  hallId: string;
  hallName?: string;
  locale: string;
  canSubmit: boolean;
  onConfirmed?: (selection: HourlySummarySelection | null) => void;
};

type VisibleMonth = { year: number; monthIndex: number };

function accountDisplayName(
  displayName: string | null | undefined,
  email: string | null | undefined,
): string {
  const name = displayName?.trim() ?? "";
  if (name && !name.includes("@")) return name;
  const source = name || email?.trim() || "";
  const at = source.indexOf("@");
  return (at > 0 ? source.slice(0, at) : source).trim();
}

function mergeDay(days: HourlyDay[], next: HourlyDay): HourlyDay[] {
  const index = days.findIndex((day) => day.dateIso === next.dateIso);
  if (index < 0) return [...days, next];
  const copy = [...days];
  copy[index] = next;
  return copy;
}

export function useHourlyBooking({ hallId, hallName, locale, canSubmit, onConfirmed }: Options) {
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
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [confirmedStarts, setConfirmedStarts] = useState<string[]>([]);
  // The booking name always comes from the signed-in account (never typed); the phone is
  // prefilled from the account and may be edited for this booking.
  const accountName = accountDisplayName(identity.displayName, identity.email);
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const phone = phoneDraft ?? identity.phoneNumber?.trim() ?? "";
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

  const hourChoices = useMemo(
    () => hourChoicesFromSlots(selectedDay?.slots ?? []),
    [selectedDay],
  );

  const selectedSlots = useMemo(() => {
    if (!selectedDay || confirmedStarts.length === 0) return [];
    const byStart = new Map(selectedDay.slots.map((slot) => [slot.start, slot]));
    return confirmedStarts
      .map((start) => byStart.get(start))
      .filter((slot): slot is HourlySlot => Boolean(slot));
  }, [selectedDay, confirmedStarts]);

  const selectedRangeLabel = useMemo(() => {
    if (confirmedStarts.length === 0) return "";
    const first = selectedSlots[0];
    const last = selectedSlots[selectedSlots.length - 1];
    if (first && last) return formatHourlyRange(first.start, last.end, locale);
    return formatHourlyRange(confirmedStarts[0], rangeTo, locale);
  }, [confirmedStarts, selectedSlots, locale, rangeTo]);

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
      setRangeFrom("");
      setRangeTo("");
      setConfirmedStarts([]);
      setErrorKey(null);
      onConfirmed?.(null);
      void loadCatalog(iso);
    },
    [days, loadCatalog, onConfirmed],
  );

  const confirmRange = useCallback((): boolean => {
    if (submitting || !dateIso) return false;
    const starts = slotStartsBetween(rangeFrom, rangeTo);
    if (starts.length === 0) {
      setErrorKey("halls.hourly.rangeInvalid");
      setConfirmedStarts([]);
      onConfirmed?.(null);
      return false;
    }

    const catalog = selectedDay?.slots ?? [];
    const byStart = new Map(catalog.map((slot) => [slot.start, slot]));
    const unavailable = starts.some((start) => {
      const slot = byStart.get(start);
      return !slot || slot.status === "booked";
    });
    if (unavailable) {
      setConfirmedStarts([]);
      setErrorKey("errors.hourly.slotBooked");
      onConfirmed?.(null);
      return false;
    }

    setConfirmedStarts(starts);
    setErrorKey(null);
    onConfirmed?.({
      dateLabel: formatBookingDateLabel(dateIso, locale),
      timeLabel: formatClockRange(rangeFrom, rangeTo, locale),
    });
    return true;
  }, [submitting, rangeFrom, rangeTo, selectedDay, dateIso, locale, onConfirmed]);

  const openPrompt = useCallback(() => {
    if (submitting || !canSubmit || confirmedStarts.length === 0) return;
    setErrorKey(null);
    setPromptOpen(true);
  }, [submitting, canSubmit, confirmedStarts.length]);

  const closePrompt = useCallback(() => {
    if (submitting) return;
    setPromptOpen(false);
  }, [submitting]);

  const submit = useCallback(async () => {
    if (!canSubmit || !dateIso || confirmedStarts.length === 0 || submitting) return false;
    const customerName = accountName;
    const customerPhone = phone.trim();
    if (!customerName) {
      setErrorKey("errors.hourly.nameRequired");
      return false;
    }
    if (!customerPhone) {
      setErrorKey("errors.hourly.phoneRequired");
      return false;
    }
    if (!isValidRegisterPhone(customerPhone)) {
      setErrorKey("errors.hourly.phoneInvalid");
      return false;
    }

    setSubmitting(true);
    setErrorKey(null);
    try {
      const result = await submitHourlyBooking({
        hallId,
        date: dateIso,
        slotTime: confirmedStarts[0],
        slotTimes: confirmedStarts,
        customerName,
        phoneNumber: customerPhone,
        contactPhone: customerPhone,
        requesterName: customerName,
      });
      if (result.bookingId) {
        rememberUserBookings([
          {
            bookingId: result.bookingId,
            hallId,
            hallName: hallName?.trim() || "",
            date: dateIso,
            slotStart: confirmedStarts[0],
            timeRange: selectedRangeLabel,
            status: "Pending",
          },
        ]);
        emitBookingSubmitted({
          hallId,
          hallName: hallName?.trim() || "",
          date: dateIso,
          bookingId: result.bookingId,
          timeRange: selectedRangeLabel,
        });
        if (!hourlyUsesLiveApi(hallId)) {
          pushPlatformNotification({
            type: "booking_submitted",
            audience: "owner",
            titleKey: "notify.ownerBookingRequest.title",
            bodyKey: "notify.ownerBookingRequest.bodyPhone",
            actionLabelKey: "notify.ownerBookingRequest.action",
            params: {
              userName: customerName,
              hallName: hallName?.trim() || "",
              date: formatBookingDateLabel(dateIso, locale),
              period: selectedRangeLabel,
              phone: customerPhone,
            },
            metadata: {
              hall_id: hallId,
              booking_id: result.bookingId,
              hall_name: hallName?.trim() || "",
              date: dateIso,
            },
          });
        }
      }
      setPromptOpen(false);
      setPhoneDraft(null);
      setConfirmedStarts([]);
      onConfirmed?.(null);
      await reload();
      return true;
    } catch (err) {
      const key =
        err instanceof ApiError && err.message.startsWith("errors.")
          ? err.message
          : "errors.hourly.generic";
      setErrorKey(key);
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    dateIso,
    confirmedStarts,
    submitting,
    accountName,
    phone,
    hallId,
    hallName,
    locale,
    selectedRangeLabel,
    reload,
    onConfirmed,
  ]);

  const shiftMonth = useCallback((delta: number) => {
    setVisibleMonth((current) => {
      const next = new Date(current.year, current.monthIndex + delta, 1);
      return { year: next.getFullYear(), monthIndex: next.getMonth() };
    });
    setDateIso(null);
    setRangeFrom("");
    setRangeTo("");
    setConfirmedStarts([]);
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
    hourChoices,
    rangeFrom,
    rangeTo,
    setRangeFrom,
    setRangeTo,
    confirmRange,
    openPrompt,
    selectedRangeLabel,
    promptOpen,
    closePrompt,
    accountName,
    phone,
    setPhone: setPhoneDraft,
    submit,
    submitting,
    errorKey,
    clearError: () => setErrorKey(null),
    showBookedSlots,
    canSubmit,
  };
}
