"use client";

import { useEffect, useId, useRef, useState } from "react";
import { hallFieldClassName } from "@/components/owner-management/add-hall/HallFormField";
import { useT } from "@/i18n";
import { parseHallPeriodTime } from "@/lib/hall-period-time";

const UPCOMING = 5;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

type DayPeriod = "am" | "pm";

type TimeParts = {
  hour12: number;
  minute: number;
  period: DayPeriod;
};

function toParts(raw: string): TimeParts | null {
  const parsed = parseHallPeriodTime(raw);
  if (!parsed) return null;
  const period: DayPeriod = parsed.hours >= 12 ? "pm" : "am";
  const hour = parsed.hours % 12;
  return {
    hour12: hour === 0 ? 12 : hour,
    minute: parsed.minutes,
    period,
  };
}

function toHhMm(parts: TimeParts): string {
  let hours = parts.hour12 % 12;
  if (parts.period === "pm") hours += 12;
  return `${pad2(hours)}:${pad2(parts.minute)}`;
}

function wrap(value: number, min: number, max: number, delta: number): number {
  const span = max - min + 1;
  return min + ((((value - min + delta) % span) + span) % span);
}

function upcoming(current: number, min: number, max: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) =>
    wrap(current, min, max, index + 1),
  );
}

type HallTimePickerProps = {
  id: string;
  value: string;
  disabled?: boolean;
  hasError?: boolean;
  placeholder?: string;
  describedBy?: string;
  onChange: (value: string) => void;
};

export default function HallTimePicker({
  id,
  value,
  disabled = false,
  hasError = false,
  placeholder = "14:00",
  describedBy,
  onChange,
}: HallTimePickerProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const parts = toParts(value);
  const amLabel = t("owner.management.addHall.fields.am");
  const pmLabel = t("owner.management.addHall.fields.pm");
  const current: TimeParts = parts ?? { hour12: 12, minute: 0, period: "am" };
  const hourLabel = t("owner.management.addHall.fields.hour");
  const minuteLabel = t("owner.management.addHall.fields.minute");
  const nextHours = upcoming(current.hour12, 1, 12, UPCOMING).map(pad2);
  const nextMinutes = upcoming(current.minute, 0, 59, UPCOMING).map(pad2);
  const nextPeriods = [current.period === "am" ? pmLabel : amLabel, ...Array(UPCOMING - 1).fill("")];

  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commit = (next: TimeParts) => {
    onChange(toHhMm(next));
  };

  return (
    <div ref={rootRef} className="owner-add-hall-time relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        onClick={() => {
          if (!disabled) setOpen((currentOpen) => !currentOpen);
        }}
        className={`${hallFieldClassName(hasError)} flex cursor-pointer items-center justify-between gap-3 text-start`}
      >
        <span
          className={`font-medium tabular-nums tracking-wide ${
            parts ? "text-[var(--wesal-text)]" : "text-[var(--wesal-muted)]"
          }`}
          dir="ltr"
        >
          {parts
            ? `${pad2(parts.hour12)}:${pad2(parts.minute)} ${
                parts.period === "am" ? amLabel : pmLabel
              }`
            : placeholder}
        </span>
        <ClockIcon />
      </button>

      {open ? (
        <div
          id={listId}
          role="dialog"
          dir="ltr"
          className="wesal-time-spinner absolute bottom-full left-1/2 z-50 mb-2 w-[16.5rem] -translate-x-1/2 rounded-2xl border border-[var(--wesal-border)] bg-white p-2.5 shadow-[0_16px_36px_rgba(90,55,45,0.16)]"
        >
          <div className="wesal-time-grid">
            <StepButton label={`${hourLabel} +`} onClick={() => commit({ ...current, hour12: wrap(current.hour12, 1, 12, -1) })} dir="up" />
            <StepButton label={`${minuteLabel} +`} onClick={() => commit({ ...current, minute: wrap(current.minute, 0, 59, -1) })} dir="up" />
            <StepButton
              label={amLabel}
              onClick={() => commit({ ...current, period: current.period === "am" ? "pm" : "am" })}
              dir="up"
            />

            <SelectedCell>{pad2(current.hour12)}</SelectedCell>
            <SelectedCell>{pad2(current.minute)}</SelectedCell>
            <SelectedCell>{current.period === "am" ? amLabel : pmLabel}</SelectedCell>

            {Array.from({ length: UPCOMING }, (_, row) => (
              <UpcomingRow
                key={row}
                hour={nextHours[row]}
                minute={nextMinutes[row]}
                period={nextPeriods[row]}
                onHour={() => commit({ ...current, hour12: Number(nextHours[row]) })}
                onMinute={() => commit({ ...current, minute: Number(nextMinutes[row]) })}
                onPeriod={() =>
                  commit({
                    ...current,
                    period: nextPeriods[row] === pmLabel ? "pm" : "am",
                  })
                }
              />
            ))}

            <StepButton label={`${hourLabel} -`} onClick={() => commit({ ...current, hour12: wrap(current.hour12, 1, 12, 1) })} dir="down" />
            <StepButton label={`${minuteLabel} -`} onClick={() => commit({ ...current, minute: wrap(current.minute, 0, 59, 1) })} dir="down" />
            <StepButton
              label={pmLabel}
              onClick={() => commit({ ...current, period: current.period === "am" ? "pm" : "am" })}
              dir="down"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UpcomingRow({
  hour,
  minute,
  period,
  onHour,
  onMinute,
  onPeriod,
}: {
  hour: string;
  minute: string;
  period: string;
  onHour: () => void;
  onMinute: () => void;
  onPeriod: () => void;
}) {
  return (
    <>
      <UpcomingCell onClick={onHour}>{hour}</UpcomingCell>
      <UpcomingCell onClick={onMinute}>{minute}</UpcomingCell>
      {period ? (
        <UpcomingCell onClick={onPeriod}>{period}</UpcomingCell>
      ) : (
        <span className="wesal-time-cell" aria-hidden="true" />
      )}
    </>
  );
}

function SelectedCell({ children }: { children: string }) {
  return <div className="wesal-time-cell wesal-time-cell--active">{children}</div>;
}

function UpcomingCell({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="wesal-time-cell wesal-time-cell--next">
      {children}
    </button>
  );
}

function StepButton({
  label,
  onClick,
  dir,
}: {
  label: string;
  onClick: () => void;
  dir: "up" | "down";
}) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="wesal-time-step">
      <Chevron dir={dir} />
    </button>
  );
}

function Chevron({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d={dir === "up" ? "M2.5 8 6 4.5 9.5 8" : "M2.5 4 6 7.5 9.5 4"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-[var(--wesal-maroon)]"
    >
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 7.5V12l3.2 2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
