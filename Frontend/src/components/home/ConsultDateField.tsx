"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";

type ConsultDateFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

function parseIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toIso(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function ConsultDateField({ value, onChange }: ConsultDateFieldProps) {
  const t = useT();
  const lang = useUiLang();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = parseIso(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => selected ?? new Date());

  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(cursor);

  useEffect(() => {
    if (!open) return;

    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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

  const firstWeekday = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(2024, 0, 7 + index)),
  );

  function pick(day: number) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth(), day);
    onChange(toIso(next));
    setOpen(false);
  }

  const shown = selected
    ? `${String(selected.getDate()).padStart(2, "0")} / ${String(selected.getMonth() + 1).padStart(2, "0")} / ${selected.getFullYear()}`
    : t("home.consult.datePlaceholder");

  return (
    <div className="consult-date" ref={rootRef}>
      <button
        type="button"
        className="consult-input consult-date-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setCursor(selected ?? new Date());
          setOpen((current) => !current);
        }}
      >
        <span dir="ltr" className={selected ? "consult-date-value" : "consult-date-placeholder"}>
          {shown}
        </span>
      </button>
      {open ? (
        <div id={panelId} className="consult-date-panel" dir="ltr">
          <div className="consult-date-head">
            <button
              type="button"
              className="consult-date-nav"
              aria-label={t("home.consult.datePrev")}
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <p className="consult-date-month">{monthLabel}</p>
            <button
              type="button"
              className="consult-date-nav"
              aria-label={t("home.consult.dateNext")}
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              ›
            </button>
          </div>
          <div className="consult-date-grid">
            {weekdays.map((label, index) => (
              <span key={`${label}-${index}`} className="consult-date-weekday">
                {label}
              </span>
            ))}
            {cells.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />;
              const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
              const isSelected = selected ? sameDay(date, selected) : false;
              const isToday = sameDay(date, new Date());
              return (
                <button
                  key={day}
                  type="button"
                  className={[
                    "consult-date-day",
                    isSelected ? "is-selected" : "",
                    isToday ? "is-today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => pick(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="consult-date-actions">
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
                const today = new Date();
                setCursor(today);
                onChange(toIso(today));
                setOpen(false);
              }}
            >
              {t("home.consult.dateToday")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
