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
      <p className="mb-2 text-sm font-semibold text-[var(--wesal-maroon)]">
        {t("halls.booking.pickPeriods")}
      </p>
      <p className="mb-3 text-xs leading-6 text-[var(--wesal-muted)]">
        {t("halls.booking.periodsHint")}
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
          className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3"
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
                    <PeriodContent label={period.label} time={period.time} />
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
                    <PeriodContent label={period.label} time={period.time} />
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
    "flex min-h-[4.75rem] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-start transition";

  if (visual === "selected") {
    return `${base} border-[var(--wesal-maroon)] bg-[rgba(193,123,127,0.12)] ring-2 ring-inset ring-[var(--wesal-maroon)]`;
  }
  if (visual === "unavailable") {
    return `${base} pointer-events-none cursor-not-allowed border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] opacity-70`;
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
      <div className="h-[4.75rem] animate-pulse rounded-2xl bg-[var(--wesal-pink-soft)]" />
      <div className="h-[4.75rem] animate-pulse rounded-2xl bg-[var(--wesal-pink-soft)]" />
    </div>
  );
}

function PeriodContent({ label, time }: { label: string; time?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-[var(--wesal-text)]">{label}</p>
      {time ? (
        <p className="mt-0.5 truncate text-xs text-[var(--wesal-muted)]">{time}</p>
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
      <span className="shrink-0 rounded-full bg-[var(--wesal-maroon)] px-2.5 py-1 text-[0.7rem] font-bold text-white">
        {t("halls.booking.selectedBadge")}
      </span>
    );
  }

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${
        booked
          ? "bg-[rgba(193,123,127,0.16)] text-[var(--wesal-maroon-dark)]"
          : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {booked ? t("halls.booking.bookedBadge") : t("halls.booking.availableBadge")}
    </span>
  );
}
