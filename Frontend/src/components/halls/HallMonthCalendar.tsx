"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/i18n";
import {
  formatBookingDateLabel,
  isFutureBookingDate,
  parseDateIso,
  utcTodayIso,
} from "@/lib/booking-date";
import type { HallAvailabilityDay } from "@/types/hall";

export type CalendarDayStatus =
  | "available"
  | "partial"
  | "booked"
  | "past"
  | "empty";

type HallMonthCalendarProps = {
  days: HallAvailabilityDay[];
  selectedDateIso: string | null;
  onSelect: (day: HallAvailabilityDay) => void;
  disabled?: boolean;
  locale: string;
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
): CalendarDayStatus {
  if (!isFutureBookingDate(iso)) return "past";
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
  days,
  selectedDateIso,
  onSelect,
  disabled = false,
  locale,
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
      const status = dayStatus(day, iso);
      return status === "available" || status === "partial";
    });
    return parseDateIso(firstAvailable?.dateIso) ?? utcTodayIso();
  }, [days, selectedDateIso]);

  const [cursor, setCursor] = useState<Cursor>(() => toCursor(anchorIso));

  useEffect(() => {
    const next = toCursor(anchorIso);
    setCursor((current) => (sameCursor(current, next) ? current : next));
  }, [anchorIso]);

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
        status: dayStatus(day, iso),
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
  }, [byIso, cursor.month, cursor.year]);

  const shiftMonth = (delta: number) => {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const selectIso = (iso: string, day?: HallAvailabilityDay) => {
    if (disabled || !isFutureBookingDate(iso)) return;
    const status = dayStatus(day, iso);
    if (status === "booked" || status === "past") return;

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
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wesal-border)] text-lg text-[var(--wesal-maroon)] hover:bg-[var(--wesal-pink-soft)]"
            onClick={() => shiftMonth(-1)}
            aria-label={t("halls.booking.prevMonth")}
          >
            ‹
          </button>
          <p className="min-w-[9rem] text-center text-sm font-bold text-[var(--wesal-text)]">
            {monthLabel(cursor.year, cursor.month, locale)}
          </p>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wesal-border)] text-lg text-[var(--wesal-maroon)] hover:bg-[var(--wesal-pink-soft)]"
            onClick={() => shiftMonth(1)}
            aria-label={t("halls.booking.nextMonth")}
          >
            ›
          </button>
        </div>

        <ul className="flex flex-wrap items-center gap-3 text-[0.7rem] text-[var(--wesal-muted)]">
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-[var(--wesal-border)] bg-white" />
            {t("halls.booking.legendAvailable")}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="hall-cal-legend-partial" aria-hidden="true" />
            {t("halls.booking.legendPartial")}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#d9d0cb]" />
            {t("halls.booking.legendBooked")}
          </li>
        </ul>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[0.7rem] font-semibold text-[var(--wesal-muted)] sm:gap-1.5 sm:text-xs">
        {weekdays.map((label, index) => (
          <div key={`${label}-${index}`} className="py-1">
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
            (cell.status === "available" || cell.status === "partial");
          const isPartial = !selected && cell.status === "partial";

          return (
            <button
              key={cell.key}
              type="button"
              disabled={!selectable}
              onClick={() => selectIso(cell.iso!, cell.day)}
              className={[
                "hall-cal-day relative inline-flex min-h-10 items-center justify-center overflow-hidden text-sm font-semibold transition sm:min-h-11",
                selected
                  ? "hall-cal-day--selected rounded-full bg-[var(--wesal-maroon)] text-white shadow-[0_6px_14px_rgba(193,123,127,0.35)]"
                  : cell.status === "booked"
                    ? "cursor-not-allowed rounded-full bg-[#e8e1dc] text-[#9a8e87]"
                    : isPartial
                      ? "hall-cal-day--partial rounded-xl"
                      : cell.status === "available"
                        ? "rounded-full border border-[var(--wesal-border)] bg-white text-[var(--wesal-text)] hover:bg-[var(--wesal-pink-soft)]"
                        : "cursor-default rounded-full text-[#c5bbb4]",
              ].join(" ")}
              aria-pressed={selected}
              data-day-status={cell.status}
              data-testid={`hall-cal-day-${cell.iso}`}
            >
              {isPartial ? (
                <>
                  <span className="hall-cal-day-split" aria-hidden="true" />
                  <span className="hall-cal-day-badge">{cell.dayNum}</span>
                </>
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
