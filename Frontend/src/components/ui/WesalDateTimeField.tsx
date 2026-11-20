"use client";

import { useEffect, useId, useRef, useState } from "react";
import AnchoredPanel from "@/components/ui/AnchoredPanel";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";

type WesalDateTimeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Overrides default trigger chrome (e.g. hallFieldClassName). */
  triggerClassName?: string;
  testId?: string;
  id?: string;
};

type ParsedLocal = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseLocal(value: string): ParsedLocal | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/,
  );
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4] ?? "0");
  const minutes = Number(match[5] ?? "0");
  if (!year || !month || !day) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { year, month, day, hours, minutes };
}

function toLocalValue(parts: ParsedLocal) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hours)}:${pad(parts.minutes)}`;
}

function sameDay(a: ParsedLocal, year: number, month: number, day: number) {
  return a.year === year && a.month === month && a.day === day;
}

function nowParts(): ParsedLocal {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hours: now.getHours(),
    minutes: now.getMinutes(),
  };
}

function formatDisplay(
  parts: ParsedLocal | null,
  empty: string,
  amLabel: string,
  pmLabel: string,
) {
  if (!parts) return empty;
  const h12 = parts.hours % 12 === 0 ? 12 : parts.hours % 12;
  const period = parts.hours >= 12 ? pmLabel : amLabel;
  return `${pad(parts.day)} / ${pad(parts.month)} / ${parts.year} · ${pad(h12)}:${pad(parts.minutes)} ${period}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export default function WesalDateTimeField({
  value,
  onChange,
  disabled = false,
  triggerClassName,
  testId,
  id,
}: WesalDateTimeFieldProps) {
  const t = useT();
  const lang = useUiLang();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const selected = parseLocal(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<ParsedLocal>(() => selected ?? nowParts());

  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(cursor.year, cursor.month - 1, 1));
  const amLabel = t("owner.management.addHall.fields.am");
  const pmLabel = t("owner.management.addHall.fields.pm");

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const firstWeekday = new Date(cursor.year, cursor.month - 1, 1).getDay();
  const daysInMonth = new Date(cursor.year, cursor.month, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(
      new Date(2024, 0, 7 + index),
    ),
  );

  const hour12 = cursor.hours % 12 === 0 ? 12 : cursor.hours % 12;
  const isPm = cursor.hours >= 12;
  const today = new Date();

  function commit(next: ParsedLocal) {
    setCursor(next);
    onChange(toLocalValue(next));
  }

  function shiftMonth(delta: number) {
    setCursor((current) => {
      const date = new Date(current.year, current.month - 1 + delta, 1);
      const maxDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      return {
        ...current,
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: Math.min(current.day, maxDay),
      };
    });
  }

  function pickDay(day: number) {
    commit({ ...cursor, day });
  }

  function pickHour(h12: number) {
    const hours24 = isPm ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12;
    commit({ ...cursor, hours: hours24 });
  }

  function pickMinute(minute: number) {
    commit({ ...cursor, minutes: minute });
  }

  function pickPeriod(pm: boolean) {
    let hours24 = cursor.hours;
    if (pm && hours24 < 12) hours24 += 12;
    if (!pm && hours24 >= 12) hours24 -= 12;
    commit({ ...cursor, hours: hours24 });
  }

  const shown = formatDisplay(
    selected,
    t("home.consult.dateTimePlaceholder"),
    amLabel,
    pmLabel,
  );

  return (
    <div className="wesal-datetime" ref={rootRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={
          triggerClassName
            ? `${triggerClassName} wesal-datetime-trigger`
            : "consult-input wesal-datetime-trigger"
        }
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        data-testid={testId}
        onClick={() => {
          if (disabled) return;
          setCursor(selected ?? nowParts());
          setOpen((current) => !current);
        }}
      >
        <span
          dir="ltr"
          className={selected ? "wesal-datetime-value" : "wesal-datetime-placeholder"}
        >
          {shown}
        </span>
        <CalendarIcon />
      </button>

      <AnchoredPanel
        open={open && !disabled}
        anchorRef={triggerRef}
        panelRef={panelRef}
        options={{ width: 360, estimateHeight: 320, preferUp: true }}
        id={panelId}
        className="wesal-datetime-panel"
        dir="ltr"
        role="dialog"
        aria-label={t("home.consult.dateTimePlaceholder")}
      >
        <div className="wesal-datetime-layout">
          <div className="wesal-datetime-calendar">
            <div className="wesal-datetime-head">
              <button
                type="button"
                className="wesal-datetime-nav"
                aria-label={t("home.consult.datePrev")}
                onClick={() => shiftMonth(-1)}
              >
                ‹
              </button>
              <p className="wesal-datetime-month">{monthLabel}</p>
              <button
                type="button"
                className="wesal-datetime-nav"
                aria-label={t("home.consult.dateNext")}
                onClick={() => shiftMonth(1)}
              >
                ›
              </button>
            </div>

            <div className="wesal-datetime-grid">
              {weekdays.map((label, index) => (
                <span key={`${label}-${index}`} className="wesal-datetime-weekday">
                  {label}
                </span>
              ))}
              {cells.map((day, index) => {
                if (!day) return <span key={`empty-${index}`} />;
                const isSelected = selected
                  ? sameDay(selected, cursor.year, cursor.month, day)
                  : false;
                const isToday =
                  today.getFullYear() === cursor.year &&
                  today.getMonth() + 1 === cursor.month &&
                  today.getDate() === day;
                return (
                  <button
                    key={day}
                    type="button"
                    className={[
                      "wesal-datetime-day",
                      isSelected ? "is-selected" : "",
                      isToday ? "is-today" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => pickDay(day)}
                    aria-pressed={isSelected}
                    aria-label={new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(
                      new Date(cursor.year, cursor.month - 1, day),
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="wesal-datetime-actions">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                {t("home.consult.dateClear")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = nowParts();
                  commit(next);
                  setOpen(false);
                }}
              >
                {t("home.consult.dateToday")}
              </button>
            </div>
          </div>

          <div
            className="wesal-datetime-time"
            aria-label={t("owner.management.addHall.fields.periodStart")}
            dir={lang === "ar" ? "rtl" : "ltr"}
          >
            <label>
              <span>{t("owner.management.addHall.fields.hour")}</span>
              <select
                aria-label={t("owner.management.addHall.fields.hour")}
                value={hour12}
                onChange={(event) => pickHour(Number(event.target.value))}
              >
                {HOURS.map((hour) => (
                  <option key={hour} value={hour}>{pad(hour)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("owner.management.addHall.fields.minute")}</span>
              <select
                aria-label={t("owner.management.addHall.fields.minute")}
                value={cursor.minutes}
                onChange={(event) => pickMinute(Number(event.target.value))}
              >
                {MINUTES.map((minute) => (
                  <option key={minute} value={minute}>{pad(minute)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("halls.catalog.period")}</span>
              <select
                aria-label={t("halls.catalog.period")}
                value={isPm ? "pm" : "am"}
                onChange={(event) => pickPeriod(event.target.value === "pm")}
              >
                <option value="am">{amLabel}</option>
                <option value="pm">{pmLabel}</option>
              </select>
            </label>
          </div>
        </div>
        <button
          type="button"
          className="wesal-datetime-done"
          onClick={() => {
            setOpen(false);
            triggerRef.current?.focus({ preventScroll: true });
          }}
        >
          {t("common.ok")}
        </button>
      </AnchoredPanel>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="wesal-datetime-icon"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4.5"
        width="14"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3 8h14M7 2.5v3M13 2.5v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
