"use client";

import { useT } from "@/i18n";
import type { HallAvailabilityDay, PeriodStatus, BookingSelection } from "@/types/hall";

type HallBookingCalendarProps = {
  days: HallAvailabilityDay[];
  interactive?: boolean;
  selection?: BookingSelection | null;
  onSelect?: (selection: BookingSelection) => void;
  compact?: boolean;
};

export default function HallBookingCalendar({
  days,
  interactive = false,
  selection = null,
  onSelect,
  compact = false,
}: HallBookingCalendarProps) {
  const t = useT();

  if (!days.length) {
    return (
      <section
        className="rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] p-5"
        data-testid="hall-booking-calendar-empty"
      >
        <p className="text-sm text-[var(--wesal-muted)]">
          {t("halls.booking.emptyDays")}
        </p>
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
          <p className="mt-1 text-sm text-[var(--wesal-muted)]">
            {t("halls.booking.pickHint")}
          </p>
        </>
      ) : null}

      <div className={`space-y-3 ${compact ? "" : "mt-4"}`}>
        {days.map((day) => (
          <div
            key={day.dateLabel}
            className="overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white"
          >
            <div className="border-b border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--wesal-maroon)]">
                <CalendarIcon />
                {day.dateLabel}
              </p>
            </div>
            <ul className="divide-y divide-[var(--wesal-border)]">
              {day.periods.map((period) => {
                const booked = period.status === "booked";
                const isSelected =
                  selection?.dateLabel === day.dateLabel &&
                  selection?.periodLabel === period.label;
                const canSelect = interactive && !booked;

                return (
                  <li key={`${day.dateLabel}-${period.label}`}>
                    {canSelect ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSelect?.({
                            dateLabel: day.dateLabel,
                            periodLabel: period.label,
                          })
                        }
                        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-start transition ${
                          isSelected
                            ? "bg-[rgba(193,123,127,0.12)] ring-2 ring-inset ring-[var(--wesal-maroon)]"
                            : "hover:bg-[var(--wesal-pink-soft)]"
                        }`}
                        aria-pressed={isSelected}
                      >
                        <PeriodContent label={period.label} time={period.time} />
                        <PeriodBadge status={period.status} selected={isSelected} />
                      </button>
                    ) : (
                      <div className="flex items-center justify-between gap-3 px-4 py-3">
                        <PeriodContent label={period.label} time={period.time} />
                        <PeriodBadge status={period.status} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function PeriodContent({ label, time }: { label: string; time?: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-[var(--wesal-text)]">{label}</p>
      {time ? (
        <p className="mt-0.5 text-xs text-[var(--wesal-muted)]">{time}</p>
      ) : null}
    </div>
  );
}

function PeriodBadge({
  status,
  selected = false,
}: {
  status: PeriodStatus;
  selected?: boolean;
}) {
  const t = useT();
  const booked = status === "booked";

  if (selected) {
    return (
      <span className="rounded-full bg-[var(--wesal-maroon)] px-2.5 py-1 text-[0.7rem] font-bold text-white">
        {t("halls.booking.selectedBadge")}
      </span>
    );
  }

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

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
