"use client";

import AvailabilityCalendarError from "@/components/halls/owner-availability/AvailabilityCalendarError";
import AvailabilityCalendarSkeleton from "@/components/halls/owner-availability/AvailabilityCalendarSkeleton";
import HallLockedState from "@/components/halls/HallLockedState";
import ResponsiveCalendarGrid from "@/components/halls/owner-availability/ResponsiveCalendarGrid";
import { useT } from "@/i18n";
import type { BookingPeriodType } from "@/types/booking";
import type {
  OwnerAvailabilityDay,
  OwnerAvailabilityLoadStatus,
} from "@/types/owner-availability";

export type AvailabilityCalendarProps = {
  loadStatus: OwnerAvailabilityLoadStatus;
  days: OwnerAvailabilityDay[];
  savingKeys: Set<string>;
  errorByKey: Record<string, string>;
  errorMessage?: string | null;
  onRetryLoad: () => void;
  onTogglePeriod: (dateIso: string, periodType: BookingPeriodType) => void;
};

export default function AvailabilityCalendar({
  loadStatus,
  days,
  savingKeys,
  errorByKey,
  errorMessage,
  onRetryLoad,
  onTogglePeriod,
}: AvailabilityCalendarProps) {
  const t = useT();
  const isError =
    loadStatus === "unauthorized" ||
    loadStatus === "not_found" ||
    loadStatus === "error";

  if (loadStatus === "loading" || loadStatus === "idle") {
    return <AvailabilityCalendarSkeleton />;
  }

  if (loadStatus === "forbidden") {
    return <HallLockedState reason="both" />;
  }

  if (isError) {
    return (
      <AvailabilityCalendarError
        message={errorMessage || t("errors.owner.availability.load")}
        onRetry={onRetryLoad}
      />
    );
  }

  if (loadStatus === "empty" || days.length === 0) {
    return (
      <div
        className="rounded-2xl bg-[var(--wesal-pink-soft)] px-4 py-8 text-center sm:px-6"
        data-testid="owner-availability-empty"
      >
        <p className="break-words text-sm font-semibold leading-7 text-[var(--wesal-maroon)] [overflow-wrap:anywhere]">
          {t("owner.availability.empty")}
        </p>
      </div>
    );
  }

  return (
    <ResponsiveCalendarGrid
      days={days}
      savingKeys={savingKeys}
      errorByKey={errorByKey}
      onTogglePeriod={onTogglePeriod}
    />
  );
}
