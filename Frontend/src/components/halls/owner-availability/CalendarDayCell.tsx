"use client";

import { memo } from "react";
import PeriodToggleControl from "@/components/halls/owner-availability/PeriodToggleControl";
import { ownerAvailabilityPeriodKey } from "@/lib/owner-availability";
import type { BookingPeriodType } from "@/types/booking";
import type { OwnerAvailabilityDay } from "@/types/owner-availability";
import "@/components/halls/owner-availability/owner-availability.css";

type CalendarDayCellProps = {
  day: OwnerAvailabilityDay;
  savingKeys: Set<string>;
  errorByKey: Record<string, string>;
  onTogglePeriod: (dateIso: string, periodType: BookingPeriodType) => void;
};

function CalendarDayCell({
  day,
  savingKeys,
  errorByKey,
  onTogglePeriod,
}: CalendarDayCellProps) {
  return (
    <article
      className="owner-availability-day overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white"
      data-testid={`owner-availability-day-${day.dateIso}`}
      data-date={day.dateIso}
    >
      <header className="border-b border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-3 py-3 sm:px-4">
        <p className="min-w-0 break-words text-sm font-semibold leading-6 text-[var(--wesal-maroon)] [overflow-wrap:anywhere]">
          {day.dateLabel}
        </p>
        <p className="mt-0.5 break-all text-[0.68rem] text-[var(--wesal-muted)]" dir="ltr">
          {day.dateIso}
        </p>
      </header>
      <ul className="divide-y divide-[var(--wesal-border)]">
        {day.periods.map((period) => {
          const key = ownerAvailabilityPeriodKey(day.dateIso, period.periodType);
          return (
            <li key={key} className="px-3 py-2.5 sm:px-4">
              <PeriodToggleControl
                dateIso={day.dateIso}
                dateLabel={day.dateLabel}
                periodType={period.periodType}
                periodLabel={period.label}
                periodTime={period.time}
                status={period.status}
                saving={savingKeys.has(key)}
                error={errorByKey[key] ?? null}
                onToggle={() => onTogglePeriod(day.dateIso, period.periodType)}
              />
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export default memo(CalendarDayCell, (prev, next) => {
  if (prev.day.dateIso !== next.day.dateIso) return false;
  if (prev.day.dateLabel !== next.day.dateLabel) return false;
  if (prev.day.periods.length !== next.day.periods.length) return false;
  for (let index = 0; index < prev.day.periods.length; index += 1) {
    const left = prev.day.periods[index];
    const right = next.day.periods[index];
    if (
      left.periodType !== right.periodType ||
      left.status !== right.status ||
      left.label !== right.label ||
      left.time !== right.time
    ) {
      return false;
    }
    const key = ownerAvailabilityPeriodKey(prev.day.dateIso, left.periodType);
    if (prev.savingKeys.has(key) !== next.savingKeys.has(key)) return false;
    if ((prev.errorByKey[key] ?? null) !== (next.errorByKey[key] ?? null)) return false;
  }
  return true;
});
