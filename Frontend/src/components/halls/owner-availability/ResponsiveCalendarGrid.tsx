"use client";

import CalendarDayCell from "@/components/halls/owner-availability/CalendarDayCell";
import type { BookingPeriodType } from "@/types/booking";
import type { OwnerAvailabilityDay } from "@/types/owner-availability";
import "@/components/halls/owner-availability/owner-availability.css";

export type ResponsiveCalendarGridProps = {
  days: OwnerAvailabilityDay[];
  savingKeys: Set<string>;
  errorByKey: Record<string, string>;
  onTogglePeriod: (dateIso: string, periodType: BookingPeriodType) => void;
};

export default function ResponsiveCalendarGrid({
  days,
  savingKeys,
  errorByKey,
  onTogglePeriod,
}: ResponsiveCalendarGridProps) {
  return (
    <div className="owner-availability-grid" data-testid="owner-availability-calendar">
      {days.map((day) => (
        <CalendarDayCell
          key={day.dateIso}
          day={day}
          savingKeys={savingKeys}
          errorByKey={errorByKey}
          onTogglePeriod={onTogglePeriod}
        />
      ))}
    </div>
  );
}
