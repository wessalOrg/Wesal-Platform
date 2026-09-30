"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/i18n";
import {
  formatBookingDateLabel,
  isFutureBookingDate,
  localTodayIso,
  parseDateIso,
  utcTodayIso,
} from "@/lib/booking-date";
import type { HallAvailabilityDay } from "@/types/hall";

export type CalendarDayStatus =
  | "available"
  | "partial"
  | "booked"
  | "blocked"
  | "past"
  | "empty";

type HallMonthCalendarProps = {
  days?: HallAvailabilityDay[];
  dayStatuses?: Record<string, CalendarDayStatus>;
  selectedDateIso: string | null;
  onSelect: (day: HallAvailabilityDay) => void;
  disabled?: boolean;
  locale: string;
  legend?: "full" | "hourly" | "owner";
  /** Owner browse: every day in the month can be selected, including booked and past days. */
  allowAnyDay?: boolean;
  onVisibleMonthChange?: (year: number, monthIndex: number) => void;
};

type Cursor = { year: number; month: number };

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toCursor(iso: string): Cursor {
  const [year, month] = iso.split("-").map(Number);
  return { year, month: month - 1 };
}

function dayStatus(
  day: HallAvailabilityDay | undefined,
  iso: string,
  overrides?: Record<string, CalendarDayStatus>,
  allowAnyDay = false,
): CalendarDayStatus {
  const override = overrides?.[iso];
  if (!allowAnyDay && !isFutureBookingDate(iso)) return "past";
  if (override) return override;
  if (allowAnyDay) return "available";
  if (!day?.periods?.length) return "available";
  const booked = day.periods.filter((period) => period.status === "booked").length;
  if (booked === day.periods.length) return "booked";
  if (booked > 0) return "partial";
  return "available";
}

function monthLabel(year: number, monthIndex: number, locale: string): string {
  return new Date(year, monthIndex, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

function sameCursor(a: Cursor, b: Cursor): boolean {
  return a.year === b.year && a.month === b.month;
}

export default function HallMonthCalendar({
  days = [],
  dayStatuses,
  selectedDateIso,
  onSelect,
  disabled = false,
  locale,
  legend = "full",
  allowAnyDay = false,
  onVisibleMonthChange,
}: HallMonthCalendarProps) {
  const t = useT();

  const byIso = useMemo(() => {
    const map = new Map<string, HallAvailabilityDay>();
    for (const day of days) {
      const iso = parseDateIso(day.dateIso);
      if (iso) map.set(iso, day);
    }
    return map;
  }, [days]);

  const anchorIso = useMemo(() => {
    if (selectedDateIso && parseDateIso(selectedDateIso)) return selectedDateIso;
    const firstAvailable = days.find((day) => {
      const iso = parseDateIso(day.dateIso);
      if (!iso || !isFutureBookingDate(iso)) return false;
      const status = dayStatus(day, iso, dayStatuses);
      return status === "available" || status === "partial";
    });
    return (
      parseDateIso(firstAvailable?.dateIso) ??
      (allowAnyDay ? localTodayIso() : utcTodayIso())
    );
  }, [allowAnyDay, days, selectedDateIso, dayStatuses]);

  const [cursor, setCursor] = useState<Cursor>(() => toCursor(anchorIso));
  const [prevAnchorIso, setPrevAnchorIso] = useState(anchorIso);
  if (prevAnchorIso !== anchorIso) {
    setPrevAnchorIso(anchorIso);
    const next = toCursor(anchorIso);
    setCursor((current) => (sameCursor(current, next) ? current : next));
  }

  const weekdays = useMemo(() => {
    // Fixed Sun→Sat order to match the mockup grid.
    const base = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(base);
      date.setDate(base.getDate() + index);
      return date.toLocaleDateString(locale, { weekday: "short" });
    });
  }, [locale]);

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const list: Array<{
      key: string;
      dayNum: number | null;
      iso: string | null;
      status: CalendarDayStatus;
      day?: HallAvailabilityDay;
    }> = [];

    for (let i = 0; i < startPad; i += 1) {
      list.push({ key: `pad-${i}`, dayNum: null, iso: null, status: "empty" });
    }

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum += 1) {
      const iso = `${cursor.year}-${pad(cursor.month + 1)}-${pad(dayNum)}`;
      const day = byIso.get(iso);
      list.push({
        key: iso,
        dayNum,
        iso,
        status: dayStatus(day, iso, dayStatuses, allowAnyDay),
        day,
      });
    }

    while (list.length % 7 !== 0) {
      list.push({
        key: `tail-${list.length}`,
        dayNum: null,
        iso: null,
        status: "empty",
      });
    }

    return list;
  }, [allowAnyDay, byIso, cursor.month, cursor.year, dayStatuses]);

  useEffect(() => {
    onVisibleMonthChange?.(cursor.year, cursor.month);
  }, [cursor.month, cursor.year, onVisibleMonthChange]);

  const shiftMonth = (delta: number) => {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const selectIso = (iso: string, day?: HallAvailabilityDay) => {
    if (disabled) return;
    if (!allowAnyDay && !isFutureBookingDate(iso)) return;
    const status = dayStatus(day, iso, dayStatuses, allowAnyDay);
    if (!allowAnyDay && (status === "booked" || status === "blocked" || status === "past")) return;

    onSelect(
      day ?? {
        dateIso: iso,
        dateLabel: formatBookingDateLabel(iso, locale),
        periods: [],
      },
    );
  };

  return (
    <div data-testid="hall-month-calendar" className="hall-month-calendar">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--wesal-border)] text-lg text-[var(--wesal-maroon)] hover:bg-[var(--wesal-pink-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)]"
            onClick={() => shiftMonth(-1)}
            aria-label={t("halls.booking.prevMonth")}
          >
            ‹
          </button>
          <p className="min-w-0 flex-1 text-center text-sm font-bold text-[var(--wesal-text)] sm:min-w-[9rem] sm:flex-none">
            {monthLabel(cursor.year, cursor.month, locale)}
          </p>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--wesal-border)] text-lg text-[var(--wesal-maroon)] hover:bg-[var(--wesal-pink-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)]"
            onClick={() => shiftMonth(1)}
            aria-label={t("halls.booking.nextMonth")}
          >
            ›
          </button>
        </div>

        <ul className="flex flex-wrap items-center gap-3 text-[0.7rem] text-[var(--wesal-muted)]">
          {legend === "owner" ? (
            <>
              <li className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--wesal-maroon)]" />
                {t("owner.calendar.legendSelected")}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1f8a4c]" />
                {t("owner.calendar.legendBooked")}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-[var(--wesal-border)] bg-white" />
                {t("owner.calendar.legendNone")}
              </li>
            </>
          ) : (
            <li className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              {t("halls.booking.legendAvailable")}
            </li>
          )}
          {legend === "full" ? (
            <>
              <li className="inline-flex items-center gap-1.5">
                <span className="hall-cal-legend-partial" aria-hidden="true" />
                {t("halls.booking.legendPartial")}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#dc4c4c]" />
                {t("halls.booking.legendBooked")}
              </li>
            </>
          ) : legend === "owner" ? null : (
            <li className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#dc4c4c]" />
              {t("halls.booking.legendBooked")}
            </li>
          )}
        </ul>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold text-[var(--wesal-muted)] sm:gap-1.5 sm:text-xs">
        {weekdays.map((label, index) => (
          <div key={`${label}-${index}`} className="truncate py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
        {cells.map((cell) => {
          if (cell.dayNum == null || !cell.iso) {
            return <div key={cell.key} className="min-h-10 sm:min-h-11" />;
          }

          const selected = cell.iso === selectedDateIso;
          const selectable =
            !disabled &&
            (allowAnyDay || cell.status === "available" || cell.status === "partial");
          const isPartial = !selected && cell.status === "partial";
          const ownerBooked = legend === "owner" && cell.status === "booked";
          const isClosed = cell.status === "booked" || cell.status === "blocked";
          const dateLabel = formatBookingDateLabel(cell.iso, locale);

          return (
            <button
              key={cell.key}
              type="button"
              disabled={!selectable}
              onClick={() => selectIso(cell.iso!, cell.day)}
              className={[
                "hall-cal-day relative inline-flex min-h-11 items-center justify-center overflow-hidden text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)] sm:min-h-11",
                selected
                  ? "hall-cal-day--selected rounded-full bg-[var(--wesal-maroon)] text-white shadow-[0_6px_14px_rgba(193,123,127,0.35)]"
                  : ownerBooked
                    ? "rounded-full border border-[var(--wesal-border)] bg-white text-[var(--wesal-text)] hover:bg-[var(--wesal-pink-soft)]"
                    : isClosed
                    ? allowAnyDay
                      ? "rounded-full bg-[#e8e1dc] text-[#6d625c] hover:bg-[#ddd4ce]"
                      : "cursor-not-allowed rounded-full bg-[#fdecea] text-[#b42318]"
                    : isPartial
                      ? "hall-cal-day--partial rounded-xl"
                      : cell.status === "available"
                        ? "rounded-full bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                        : "cursor-default rounded-full text-[#c5bbb4]",
              ].join(" ")}
              aria-pressed={selected}
              aria-label={
                ownerBooked ? `${dateLabel}, ${t("owner.calendar.legendBooked")}` : dateLabel
              }
              data-day-status={cell.status}
              data-testid={`hall-cal-day-${cell.iso}`}
            >
              {isPartial ? (
                <>
                  <span className="hall-cal-day-split" aria-hidden="true" />
                  <span className="hall-cal-day-badge">{cell.dayNum}</span>
                </>
              ) : ownerBooked ? (
                <span className="flex flex-col items-center justify-center leading-none">
                  <span>{cell.dayNum}</span>
                  <span
                    className={`mt-0.5 h-1.5 w-1.5 rounded-full ${selected ? "bg-white" : "bg-[#1f8a4c]"}`}
                    data-testid="owner-cal-booked-dot"
                    aria-hidden="true"
                  />
                </span>
              ) : (
                cell.dayNum
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
