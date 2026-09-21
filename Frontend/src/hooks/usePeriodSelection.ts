"use client";

import { useCallback, useState } from "react";
import { dropBookedSelections } from "@/lib/booking-commands";
import { inferBookingPeriodType } from "@/lib/booking-period";
import { isPeriodSelectable } from "@/lib/booking-ui-state";
import type { BookingPeriodType } from "@/types/booking";
import type { HallDayPeriod } from "@/types/hall";

export function usePeriodSelection(periods: HallDayPeriod[], dateIso: string | null = null) {
  const [selected, setSelected] = useState<BookingPeriodType[]>([]);
  const [prevDateIso, setPrevDateIso] = useState(dateIso);
  if (prevDateIso !== dateIso) {
    setPrevDateIso(dateIso);
    setSelected([]);
  }
  const [prevPeriods, setPrevPeriods] = useState(periods);
  if (prevPeriods !== periods) {
    setPrevPeriods(periods);
    if (periods.length > 0) {
      setSelected((current) => dropBookedSelections(current, periods));
    }
  }

  const toggle = useCallback(
    (type: BookingPeriodType) => {
      const period = periods.find(
        (item) => (item.periodType ?? inferBookingPeriodType(item)) === type,
      );
      if (!period || !isPeriodSelectable(period)) return;

      setSelected((current) =>
        current.includes(type)
          ? current.filter((item) => item !== type)
          : [...current, type],
      );
    },
    [periods],
  );

  const reset = useCallback(() => {
    setSelected([]);
  }, []);

  const replace = useCallback((next: BookingPeriodType[]) => {
    setSelected(next);
  }, []);

  return { selected, toggle, reset, replace };
}
