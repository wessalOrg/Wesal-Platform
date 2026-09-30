"use client";

import { useMemo, useState } from "react";
import HallMonthCalendar, {
  type CalendarDayStatus,
} from "@/components/halls/HallMonthCalendar";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useOwnerBookingsCalendar } from "@/hooks/useOwnerBookingsCalendar";
import { useT } from "@/i18n";
import { formatBookingDateLong } from "@/lib/booking-date";
import { formatHourlyRange } from "@/lib/hourly-slots";
import { bookedHourRanges } from "@/lib/owner-bookings-calendar";
import type {
  OwnerBookingsCalendarDay,
  OwnerBookingsCalendarStatus,
} from "@/types/owner-bookings-calendar";

type OwnerHallBookingsCalendarProps = {
  hallId: string;
  enabled: boolean;
  /** Standalone page labels the details column. The hall notifications card already has its own title. */
  detailsTitle?: boolean;
};

type MonthRange = { fromDate: string; toDate: string };

export default function OwnerHallBookingsCalendar({
  hallId,
  enabled,
  detailsTitle = false,
}: OwnerHallBookingsCalendarProps) {
  const t = useT();
  const locale = useUiLang();
  const { load, range, onVisibleMonthChange, retry } = useOwnerBookingsCalendar(hallId, enabled);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const dayStatuses = useMemo(() => {
    if (load.status !== "ready") return undefined;
    const statuses: Record<string, CalendarDayStatus> = {};
    for (const day of load.calendar.days) {
      statuses[day.date] = day.hasBookedHours ? "booked" : "available";
    }
    return statuses;
  }, [load]);

  const selectedInView = isDateInRange(selectedDate, range);

  return (
    <div
      className="grid min-w-0 grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(17rem,0.75fr)] lg:gap-8"
      data-testid="owner-bookings-calendar"
      data-hall-id={hallId}
    >
      <HallMonthCalendar
        dayStatuses={dayStatuses}
        selectedDateIso={selectedInView ? selectedDate : null}
        onSelect={(day) => {
          const iso = day.dateIso ?? null;
          if (iso) setSelectedDate(iso);
        }}
        disabled={!enabled}
        locale={locale}
        legend="owner"
        allowAnyDay
        onVisibleMonthChange={onVisibleMonthChange}
      />

      <div className="flex min-w-0 flex-col">
        {detailsTitle ? (
          <h2 className="mb-3 text-base font-extrabold text-[var(--wesal-maroon)]">
            {t("owner.calendar.dayDetails")}
          </h2>
        ) : null}
        <SelectedDayBookingStatus
          className="min-h-40 flex-1"
          selectedDate={selectedInView ? selectedDate : null}
          load={load}
          locale={locale}
          onRetry={retry}
        />
      </div>
    </div>
  );
}

function SelectedDayBookingStatus({
  selectedDate,
  load,
  locale,
  onRetry,
  className = "",
}: {
  selectedDate: string | null;
  load: OwnerBookingsCalendarStatus;
  locale: string;
  onRetry: () => void;
  className?: string;
}) {
  const t = useT();

  if (load.status === "error") {
    return (
      <CalendarDayError
        className={className}
        heading={selectedDate ? formatBookingDateLong(selectedDate, locale) : null}
        onRetry={onRetry}
      />
    );
  }

  if (!selectedDate) {
    return (
      <p
        className={`flex flex-col justify-center rounded-2xl border border-dashed border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-6 text-sm leading-7 text-[var(--wesal-muted)] ${className}`}
        data-testid="owner-calendar-idle"
      >
        {t("owner.calendar.pickDay")}
      </p>
    );
  }

  const heading = formatBookingDateLong(selectedDate, locale);

  if (load.status === "loading" || load.status === "idle") {
    return (
      <section
        className={`flex flex-col justify-center rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-5 ${className}`}
        aria-busy="true"
        aria-live="polite"
        data-testid="owner-calendar-loading"
      >
        <h4 className="text-base font-extrabold text-[var(--wesal-maroon)]">{heading}</h4>
        <p className="mt-3 text-sm leading-7 text-[var(--wesal-muted)]">{t("owner.calendar.loading")}</p>
      </section>
    );
  }

  const day = load.calendar.days.find((item) => item.date === selectedDate);
  if (!day) {
    return <CalendarDayError className={className} heading={heading} onRetry={onRetry} />;
  }

  if (day.hasBookedHours) {
    return <BookedDay className={className} heading={heading} day={day} locale={locale} />;
  }

  return (
    <section
      className={`flex flex-col justify-center rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-5 ${className}`}
      role="status"
      aria-live="polite"
      data-testid="owner-calendar-empty"
    >
      <h4 className="text-base font-extrabold text-[var(--wesal-maroon)]">{heading}</h4>
      <p className="mt-3 text-sm font-semibold leading-7 text-[var(--wesal-text)]">
        {t("owner.calendar.empty")}
      </p>
    </section>
  );
}

function BookedDay({
  heading,
  day,
  locale,
  className = "",
}: {
  heading: string;
  day: OwnerBookingsCalendarDay;
  locale: string;
  className?: string;
}) {
  const t = useT();
  const ranges = bookedHourRanges(day.bookedHours).map((range) =>
    formatHourlyRange(range.start, range.end, locale),
  );

  return (
    <section
      className={`flex flex-col justify-center rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-5 ${className}`}
      role="status"
      aria-live="polite"
      data-testid="owner-calendar-booked"
    >
      <h4 className="text-base font-extrabold text-[var(--wesal-maroon)]">{heading}</h4>
      <p className="mt-3 text-sm font-bold leading-7 text-[var(--wesal-text)]">
        {t("owner.calendar.hasBooked")}
      </p>
      {ranges.length > 0 ? (
        <ul className="mt-3 space-y-2" aria-label={t("owner.calendar.hasBooked")}>
          {ranges.map((label, index) => (
            <li
              key={`${label}-${index}`}
              dir="ltr"
              className="rounded-xl bg-[var(--wesal-pink-soft)] px-3 py-2 text-sm font-semibold text-[var(--wesal-text)]"
            >
              {label}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function CalendarDayError({
  heading,
  onRetry,
  className = "",
}: {
  heading: string | null;
  onRetry: () => void;
  className?: string;
}) {
  const t = useT();

  return (
    <section
      className={`flex flex-col justify-center rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-5 ${className}`}
      role="alert"
      data-testid="owner-calendar-error"
    >
      {heading ? (
        <h4 className="text-base font-extrabold text-[var(--wesal-maroon)]">{heading}</h4>
      ) : null}
      <p className={`${heading ? "mt-3" : ""} text-sm leading-7 text-[var(--wesal-muted)]`}>
        {t("owner.calendar.error")}
      </p>
      <button
        type="button"
        className="btn-outline mt-4 inline-flex min-h-11 items-center px-4"
        onClick={onRetry}
      >
        {t("common.retry")}
      </button>
    </section>
  );
}

function isDateInRange(date: string | null, range: MonthRange | null): boolean {
  if (!date || !range) return false;
  return date >= range.fromDate && date <= range.toDate;
}
