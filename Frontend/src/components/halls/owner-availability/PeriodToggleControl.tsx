"use client";

import { memo } from "react";
import { useT } from "@/i18n";
import { ownerPeriodStatusMessageKey } from "@/lib/owner-availability";
import {
  ownerPeriodIsInteractive,
  ownerPeriodVisualState,
  type OwnerPeriodVisualState,
} from "@/lib/owner-availability-ui";
import type { BookingPeriodType } from "@/types/booking";
import type { OwnerPeriodAvailabilityStatus } from "@/types/owner-availability";
import "@/components/halls/owner-availability/owner-availability.css";

export type PeriodToggleControlProps = {
  dateIso: string;
  dateLabel: string;
  periodType: BookingPeriodType;
  periodLabel: string;
  periodTime?: string;
  status: OwnerPeriodAvailabilityStatus;
  saving?: boolean;
  error?: string | null;
  onToggle: () => void;
};

function PeriodToggleControl({
  dateIso,
  dateLabel,
  periodType,
  periodLabel,
  periodTime,
  status,
  saving = false,
  error = null,
  onToggle,
}: PeriodToggleControlProps) {
  const t = useT();
  const visual = ownerPeriodVisualState({ status, saving, error });
  const interactive = ownerPeriodIsInteractive(visual);
  const statusLabel = t(ownerPeriodStatusMessageKey(status));
  const actionLabel =
    visual === "booked"
      ? t("owner.availability.bookedLabel", { day: dateLabel, period: periodLabel })
      : t("owner.availability.toggleLabel", { day: dateLabel, period: periodLabel });

  return (
    <div
      className="owner-period-row min-w-0"
      data-testid={`owner-period-${dateIso}-${periodType}`}
      data-visual-state={visual}
    >
      <div className="flex min-h-11 items-center justify-between gap-3 sm:min-h-[3.5rem]">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold leading-6 text-[var(--wesal-text)] [overflow-wrap:anywhere]">
            {periodLabel}
          </p>
          {periodTime ? (
            <p className="mt-0.5 break-words text-xs leading-5 text-[var(--wesal-muted)] [overflow-wrap:anywhere]">
              {periodTime}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className={`owner-period-switch inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[0.7rem] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)] disabled:pointer-events-none disabled:opacity-70 ${switchClass(visual, status)}`}
          data-testid="owner-period-toggle"
          data-status={status}
          data-saving={saving || undefined}
          role="switch"
          aria-checked={status === "available"}
          aria-busy={saving || undefined}
          aria-disabled={!interactive || undefined}
          aria-label={
            visual === "blocked"
              ? `${actionLabel}. ${t("owner.availability.blockedHint")}`
              : visual === "booked"
                ? `${actionLabel}. ${t("owner.availability.bookedHint")}`
                : actionLabel
          }
          disabled={!interactive || saving}
          onClick={() => {
            if (!interactive || saving) return;
            onToggle();
          }}
        >
          {saving ? (
            <Spinner />
          ) : status === "booked" ? (
            <LockIcon />
          ) : status === "unavailable" ? (
            <BlockIcon />
          ) : (
            <CheckIcon />
          )}
          {saving ? t("owner.availability.saving") : statusLabel}
        </button>
      </div>
      {error ? (
        <div
          className="mt-2 flex flex-col gap-2 rounded-xl bg-red-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
          data-testid="owner-period-error"
        >
          <p className="min-w-0 break-words text-xs leading-5 text-red-700 [overflow-wrap:anywhere]">
            {error.startsWith("errors.") || error.startsWith("owner.") ? t(error) : error}
          </p>
          <button
            type="button"
            className="btn-outline min-h-11 shrink-0 px-3 text-xs sm:min-h-10"
            onClick={() => {
              if (saving) return;
              onToggle();
            }}
          >
            {t("owner.availability.retryPeriod")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function switchClass(
  state: OwnerPeriodVisualState,
  status: OwnerPeriodAvailabilityStatus,
): string {
  if (state === "error") return "owner-period-error";
  const tone =
    status === "booked"
      ? "owner-period-booked"
      : status === "unavailable"
        ? "owner-period-blocked"
        : "owner-period-available";
  if (state === "updating") return `${tone} owner-period-updating`;
  return tone;
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.5 12.2 10.2 16 17.5 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BlockIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.2 7.2 16.8 16.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V8.2a4 4 0 0 1 8 0V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function periodToggleEqual(prev: PeriodToggleControlProps, next: PeriodToggleControlProps) {
  return (
    prev.dateIso === next.dateIso &&
    prev.dateLabel === next.dateLabel &&
    prev.periodType === next.periodType &&
    prev.periodLabel === next.periodLabel &&
    prev.periodTime === next.periodTime &&
    prev.status === next.status &&
    prev.saving === next.saving &&
    prev.error === next.error
  );
}

export default memo(PeriodToggleControl, periodToggleEqual);
