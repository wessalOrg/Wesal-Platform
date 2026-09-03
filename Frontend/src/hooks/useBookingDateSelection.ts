"use client";

import { useCallback, useState } from "react";
import { formatBookingDateLabel } from "@/lib/booking-date";
import type { HallAvailabilityDay } from "@/types/hall";

export function useBookingDateSelection(locale: string) {
  const [dateIso, setDateIso] = useState<string | null>(null);
  const [dateLabel, setDateLabel] = useState("");

  const selectDate = useCallback(
    (day: HallAvailabilityDay) => {
      const iso = day.dateIso;
      if (!iso) return;
      setDateIso(iso);
      setDateLabel(formatBookingDateLabel(iso, locale) || day.dateLabel);
    },
    [locale],
  );

  const reset = useCallback(() => {
    setDateIso(null);
    setDateLabel("");
  }, []);

  return { dateIso, dateLabel, selectDate, reset };
}
