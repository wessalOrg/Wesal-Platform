"use client";

import { useT } from "@/i18n";
import type { HallAvailabilityDay, PeriodStatus } from "@/types/hall";

type HallBookingCalendarProps = {
  days: HallAvailabilityDay[];
  compact?: boolean;
};

export default function HallBookingCalendar({
  days,
  compact = false,
}: HallBookingCalendarProps) {
  const t = useT();

  if (!days.length) {
    return (
      <section
        className="rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] p-5"
        data-testid="hall-booking-calendar-empty"
      >
        <p className="text-sm text-[var(--wesal-muted)]">{t("halls.booking.emptyDays")}</p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={compact ? undefined : "hall-booking-heading"}
      data-testid="hall-booking-calendar"
    >
      {!compact ? (
        <>
          <h2
            id="hall-booking-heading"
            className="text-lg font-bold text-[var(--wesal-maroon)] sm:text-xl"
          >
            {t("halls.booking.availability")}
          </h2>
          <p className="mt-1 text-sm text-[var(--wesal-muted)]">{t("halls.booking.pickHint")}</p>
        </>
      ) : null}

      <div className={`space-y-3 ${compact ? "" : "mt-4"}`}>
        {days.map((day) => (
          <div
            key={day.dateIso ?? day.dateLabel}
            className="overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white"
          >
            <div className="border-b border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--wesal-maroon)]">{day.dateLabel}</p>
            </div>
            <ul className="divide-y divide-[var(--wesal-border)]">
              {day.periods.map((period) => (
                <li
                  key={`${day.dateIso ?? day.dateLabel}-${period.periodType ?? period.label}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--wesal-text)]">{period.label}</p>
                    {period.time ? (
                      <p className="mt-0.5 text-xs text-[var(--wesal-muted)]">{period.time}</p>
                    ) : null}
                  </div>
                  <PeriodBadge status={period.status} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function PeriodBadge({ status }: { status: PeriodStatus }) {
  const t = useT();
  const booked = status === "booked";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${
        booked
          ? "bg-[rgba(193,123,127,0.16)] text-[var(--wesal-maroon-dark)]"
          : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {booked ? t("halls.booking.bookedBadge") : t("halls.booking.availableBadge")}
    </span>
  );
}
