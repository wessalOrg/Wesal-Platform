"use client";

import { useT } from "@/i18n";
import { inferBookingPeriodType } from "@/lib/booking-period";
import { isPeriodSelectable } from "@/lib/booking-ui-state";
import type { BookingPeriodType } from "@/types/booking";
import type { BookingUiPhase, PeriodAvailabilityKind } from "@/lib/booking-ui-state";
import type { HallDayPeriod, PeriodStatus } from "@/types/hall";

type HallBookingPeriodListProps = {
  periods: HallDayPeriod[];
  selected: BookingPeriodType[];
  onToggle: (period: BookingPeriodType) => void;
  loading?: boolean;
  disabled?: boolean;
  error?: string | null;
  phase?: BookingUiPhase;
  availabilityKind?: PeriodAvailabilityKind;
  selectedDateLabel?: string | null;
};

export default function HallBookingPeriodList({
  periods,
  selected,
  onToggle,
  loading = false,
  disabled = false,
  error = null,
  phase = "period_selection",
  availabilityKind = "both",
  selectedDateLabel = null,
}: HallBookingPeriodListProps) {
  const t = useT();
  const showSkeleton = loading && periods.length === 0;

  return (
    <div
      className="min-h-[9.5rem] sm:min-h-[8.25rem]"
      data-testid="hall-booking-period-area"
      data-phase={phase}
      data-availability={availabilityKind}
      aria-busy={loading}
    >
      <p className="mb-3 text-sm font-semibold text-[var(--wesal-maroon)]">
        {selectedDateLabel
          ? t("halls.booking.pickPeriodsFor", { date: selectedDateLabel })
          : t("halls.booking.pickPeriods")}
      </p>

      {showSkeleton ? <PeriodSkeleton /> : null}

      {!showSkeleton && error ? (
        <p className="text-sm text-red-700" role="alert" data-testid="hall-booking-periods-error">
          {error.startsWith("errors.") || error.startsWith("halls.") ? t(error) : error}
        </p>
      ) : null}

      {!showSkeleton && !error && phase === "empty" ? (
        <p className="text-sm text-[var(--wesal-muted)]" data-testid="hall-booking-periods-empty">
          {t("halls.booking.noPeriods")}
        </p>
      ) : null}

      {!showSkeleton && !error && phase === "all_unavailable" ? (
        <p
          className="mb-3 rounded-xl bg-[var(--wesal-pink-soft)] px-3 py-2 text-sm leading-6 text-[var(--wesal-maroon)]"
          role="status"
          data-testid="hall-booking-all-unavailable"
        >
          {t("halls.booking.allUnavailable")}
        </p>
      ) : null}

      {!showSkeleton && !error && periods.length > 0 ? (
        <ul
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3"
          data-testid="hall-booking-periods"
        >
          {periods.map((period, index) => {
            const type = period.periodType ?? inferBookingPeriodType(period);
            const booked = !isPeriodSelectable(period);
            const isSelected = Boolean(type && selected.includes(type));
            const canSelect = !disabled && !booked && Boolean(type);
            const visual: PeriodVisual = booked
              ? "unavailable"
              : isSelected
                ? "selected"
                : "unselected";
            const iconKind =
              type === "SecondPeriod" || /ثاني|evening|ليل|مساء/i.test(period.label)
                ? "moon"
                : "sun";

            return (
              <li key={`${type ?? period.label}-${index}`} className="min-w-0">
                {canSelect && type ? (
                  <button
                    type="button"
                    onClick={() => onToggle(type)}
                    aria-pressed={isSelected}
                    data-testid={`hall-booking-period-${type}`}
                    data-period-state={visual}
                    className={periodCardClass(visual)}
                  >
                    <PeriodContent
                      label={period.label}
                      time={period.time}
                      iconKind={iconKind}
                    />
                    <PeriodBadge status={period.status} selected={isSelected} />
                  </button>
                ) : (
                  <div
                    role="group"
                    aria-disabled="true"
                    data-testid={`hall-booking-period-${type ?? "unknown"}-disabled`}
                    data-period-state="unavailable"
                    className={periodCardClass("unavailable")}
                  >
                    <PeriodContent
                      label={period.label}
                      time={period.time}
                      iconKind={iconKind}
                    />
                    <PeriodBadge status={booked ? "booked" : period.status} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

type PeriodVisual = "selected" | "unselected" | "unavailable";

function periodCardClass(visual: PeriodVisual): string {
  const base =
    "flex min-h-[5rem] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-start transition";

  if (visual === "selected") {
    return `${base} border-[var(--wesal-maroon)] bg-[var(--wesal-pink)] shadow-[0_8px_18px_rgba(193,123,127,0.18)]`;
  }
  if (visual === "unavailable") {
    return `${base} pointer-events-none cursor-not-allowed border-[#e5ddd7] bg-[#f3eeea] opacity-80`;
  }
  return `${base} border-[var(--wesal-border)] bg-white hover:bg-[var(--wesal-pink-soft)]`;
}

function PeriodSkeleton() {
  const t = useT();
  return (
    <div
      className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3"
      aria-busy="true"
      data-testid="hall-booking-periods-loading"
    >
      <span className="sr-only">{t("halls.booking.loadingPeriods")}</span>
      <div className="h-[5rem] animate-pulse rounded-2xl bg-[var(--wesal-pink-soft)]" />
      <div className="h-[5rem] animate-pulse rounded-2xl bg-[var(--wesal-pink-soft)]" />
    </div>
  );
}

function PeriodContent({
  label,
  time,
  iconKind,
}: {
  label: string;
  time?: string;
  iconKind: "sun" | "moon";
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--wesal-maroon)] shadow-sm"
        aria-hidden="true"
      >
        {iconKind === "moon" ? <MoonIcon /> : <SunIcon />}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-[var(--wesal-text)]">{label}</p>
        {time ? (
          <p className="mt-0.5 truncate text-xs text-[var(--wesal-muted)]">{time}</p>
        ) : null}
      </div>
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
      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-white"
        aria-hidden="true"
      >
        <CheckIcon />
      </span>
    );
  }

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${
        booked
          ? "bg-[#ddd5cf] text-[#6f6460]"
          : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {booked ? t("halls.booking.bookedBadge") : t("halls.booking.availableBadge")}
    </span>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M19 13.5A7.5 7.5 0 1 1 10.5 5 6 6 0 0 0 19 13.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-3.5 w-3.5">
      <path d="m5 12.5 4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
