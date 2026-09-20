"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import AvailabilityCalendar from "@/components/halls/owner-availability/AvailabilityCalendar";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useHallAvailability } from "@/hooks/useHallAvailability";
import { useUpdatePeriodStatus } from "@/hooks/useUpdatePeriodStatus";
import { useT } from "@/i18n";
import {
  currentUtcMonth,
  nextOwnerPeriodToggle,
  shiftUtcMonth,
} from "@/lib/owner-availability";
import type { BookingPeriodType } from "@/types/booking";
import type { OwnerAvailabilityDay } from "@/types/owner-availability";

type OwnerAvailabilityCalendarProps = {
  hallId: string;
  enabled?: boolean;
};

type OwnerAvailabilityMonthSessionProps = {
  hallId: string;
  days: OwnerAvailabilityDay[];
  loadStatus: ReturnType<typeof useHallAvailability>["status"];
  errorKey: string | null;
  onRetryLoad: () => void;
  applyPeriod: ReturnType<typeof useHallAvailability>["applyPeriod"];
};

export default function OwnerAvailabilityCalendar({
  hallId,
  enabled = true,
}: OwnerAvailabilityCalendarProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const [month, setMonth] = useState(currentUtcMonth);
  const availability = useHallAvailability(hallId, month, enabled);

  const monthLabel = useMemo(() => {
    const [year, monthIndex] = month.split("-").map(Number);
    return new Date(year, monthIndex - 1, 1).toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });
  }, [month, locale]);

  return (
    <section
      className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4 shadow-[0_10px_28px_rgba(90,55,45,0.06)] sm:p-5"
      aria-labelledby="owner-availability-calendar-heading"
      data-testid="owner-availability-manager"
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2
            id="owner-availability-calendar-heading"
            className="break-words text-base font-bold text-[var(--wesal-text)] [overflow-wrap:anywhere] sm:text-lg"
          >
            {t("owner.availability.title")}
          </h2>
          <p className="mt-1 break-words text-sm leading-6 text-[var(--wesal-muted)] [overflow-wrap:anywhere]">
            {t("owner.availability.hint")}
          </p>
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <button
            type="button"
            className="btn-outline min-h-11 min-w-11 px-3 sm:min-h-10"
            onClick={() => setMonth((current) => shiftUtcMonth(current, -1))}
            aria-label={t("owner.availability.prevMonth")}
          >
            ‹
          </button>
          <p className="min-w-0 flex-1 break-words text-center text-sm font-semibold text-[var(--wesal-text)] [overflow-wrap:anywhere] sm:min-w-28 sm:flex-none">
            {monthLabel}
          </p>
          <button
            type="button"
            className="btn-outline min-h-11 min-w-11 px-3 sm:min-h-10"
            onClick={() => setMonth((current) => shiftUtcMonth(current, 1))}
            aria-label={t("owner.availability.nextMonth")}
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 min-w-0">
        <OwnerAvailabilityMonthSession
          key={month}
          hallId={hallId}
          days={availability.days}
          loadStatus={availability.status}
          errorKey={availability.errorKey}
          onRetryLoad={availability.retry}
          applyPeriod={availability.applyPeriod}
        />
      </div>
    </section>
  );
}

function OwnerAvailabilityMonthSession({
  hallId,
  days,
  loadStatus,
  errorKey,
  onRetryLoad,
  applyPeriod,
}: OwnerAvailabilityMonthSessionProps) {
  const t = useT();
  const daysRef = useRef(days);
  daysRef.current = days;

  const { update, savingKeys, errorByKey } = useUpdatePeriodStatus({
    onOptimistic: applyPeriod,
    onUpdated: applyPeriod,
    onRevert: applyPeriod,
  });

  const handleToggle = useCallback(
    (dateIso: string, periodType: BookingPeriodType) => {
      const day = daysRef.current.find((item) => item.dateIso === dateIso);
      const period = day?.periods.find((item) => item.periodType === periodType);
      if (!period) return;
      void update({
        hallId,
        dateIso,
        period,
        nextStatus: nextOwnerPeriodToggle(period.status),
      });
    },
    [hallId, update],
  );

  return (
    <AvailabilityCalendar
      loadStatus={loadStatus}
      days={days}
      savingKeys={savingKeys}
      errorByKey={errorByKey}
      errorMessage={t(errorKey ?? "errors.owner.availability.load")}
      onRetryLoad={onRetryLoad}
      onTogglePeriod={handleToggle}
    />
  );
}
