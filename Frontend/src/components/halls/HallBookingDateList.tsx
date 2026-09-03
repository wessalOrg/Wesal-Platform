"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/i18n";
import { formatBookingDateChip, formatBookingDateLabel } from "@/lib/booking-date";
import type { BookingViewport } from "@/hooks/useBookingViewport";
import type { HallAvailabilityDay } from "@/types/hall";

type HallBookingDateListProps = {
  days: HallAvailabilityDay[];
  selectedDateIso: string | null;
  onSelect: (day: HallAvailabilityDay) => void;
  disabled?: boolean;
  locale: string;
  viewport?: BookingViewport;
};

export default function HallBookingDateList({
  days,
  selectedDateIso,
  onSelect,
  disabled = false,
  locale,
  viewport = "mobile",
}: HallBookingDateListProps) {
  const t = useT();

  if (!days.length) {
    return (
      <p className="text-sm text-[var(--wesal-muted)]" data-testid="hall-booking-dates-empty">
        {t("halls.booking.emptyDays")}
      </p>
    );
  }

  return (
    <div data-testid="hall-booking-dates" data-layout={viewport}>
      <p className="mb-2 text-sm font-semibold text-[var(--wesal-maroon)]">
        {t("halls.booking.pickDate")}
      </p>
      <ul
        className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin] snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3"
        data-testid="hall-booking-date-row"
      >
        {days.map((day) => {
          const iso = day.dateIso ?? day.dateLabel;
          const selected = selectedDateIso === day.dateIso;
          const compact = viewport === "mobile";
          const label = day.dateIso
            ? compact
              ? formatBookingDateChip(day.dateIso, locale)
              : formatBookingDateLabel(day.dateIso, locale)
            : day.dateLabel;

          return (
            <li key={iso} className="min-w-[8.75rem] snap-start sm:min-w-0">
              <DateChip
                label={label}
                selected={selected}
                disabled={disabled || !day.dateIso}
                onSelect={() => onSelect(day)}
                testId={`hall-booking-date-${day.dateIso ?? "unknown"}`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DateChip({
  label,
  selected,
  disabled,
  onSelect,
  testId,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  testId: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!selected) return;
    ref.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      data-testid={testId}
      className={`flex h-[3.25rem] w-full items-center justify-start gap-2 rounded-2xl border px-3 text-start text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 sm:h-[3.5rem] sm:px-4 ${
        selected
          ? "border-[var(--wesal-maroon)] bg-[rgba(193,123,127,0.12)] text-[var(--wesal-maroon)] ring-2 ring-inset ring-[var(--wesal-maroon)]"
          : "border-[var(--wesal-border)] bg-white text-[var(--wesal-text)] hover:bg-[var(--wesal-pink-soft)]"
      }`}
    >
      <CalendarIcon />
      <span className="min-w-0 truncate">{label}</span>
    </button>
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
