"use client";

import { useEffect, useId, useRef, useState } from "react";
import AnchoredPanel from "@/components/ui/AnchoredPanel";
import { useT } from "@/i18n";
import { toHoursAfterFrom } from "@/lib/hourly-slots";

type HallHourlyRangePickerProps = {
  from: string;
  to: string;
  fromHours: string[];
  toHours: string[];
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApply: () => void;
  disabled?: boolean;
};

/** 13:00 → 1, 14:00 → 2. The stored value stays HH:mm for booking. */
function hourClockLabel(value: string): string {
  const hour = Number(String(value).split(":")[0]);
  if (!Number.isFinite(hour)) return value;
  return String(hour % 12 || 12);
}

function hourPeriod(value: string): "am" | "pm" | "night" | null {
  const hour = Number(String(value).split(":")[0]);
  if (!Number.isFinite(hour)) return null;
  if (hour >= 24) return "night";
  return hour < 12 ? "am" : "pm";
}

function periodMark(period: "am" | "pm" | "night"): string {
  if (period === "pm") return "م";
  return "ص";
}

type HourMenuProps = {
  testId: string;
  value: string;
  hours: string[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

function HourMenu({ testId, value, hours, placeholder, disabled = false, onChange }: HourMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectedPeriod = value ? hourPeriod(value) : null;

  return (
    <div ref={rootRef} className="relative mt-1.5">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        data-testid={testId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-[var(--wesal-border)] bg-white px-3 py-2.5 text-sm font-semibold text-[var(--wesal-text)] outline-none transition hover:border-[var(--wesal-maroon-soft)] focus-visible:border-[var(--wesal-maroon)] disabled:opacity-60"
      >
        <span className="inline-flex items-baseline gap-1">
          <span>{value ? hourClockLabel(value) : placeholder}</span>
          {selectedPeriod ? (
            <span className="text-[0.7rem] font-bold text-[var(--wesal-maroon)]">
              {periodMark(selectedPeriod)}
            </span>
          ) : null}
        </span>
        <svg viewBox="0 0 20 20" className="size-4 text-[var(--wesal-maroon)]" aria-hidden="true">
          <path
            d="M5 7.5 10 12.5 15 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <AnchoredPanel
        open={open && !disabled}
        anchorRef={triggerRef}
        panelRef={panelRef}
        options={{ width: "anchor", estimateHeight: 300, preferUp: true }}
        className="flex flex-col-reverse overflow-hidden rounded-xl border border-[var(--wesal-border)] bg-white shadow-lg"
      >
          <div className="bg-[var(--wesal-maroon)] px-3 py-2 text-center text-sm font-bold text-white">
            {placeholder}
          </div>
          <ul
            id={listId}
            role="listbox"
            className="wesal-time-scroll max-h-64 overflow-y-auto py-1"
          >
            {hours.map((hour) => {
              const selected = hour === value;
              const period = hourPeriod(hour);
              return (
                <li key={hour}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(hour);
                      setOpen(false);
                    }}
                    className={
                      selected
                        ? "flex w-full items-baseline justify-center gap-1 bg-[var(--wesal-maroon)] px-3 py-2 text-sm font-bold text-white"
                        : "flex w-full items-baseline justify-center gap-1 px-3 py-2 text-sm font-bold text-[var(--wesal-text)] hover:bg-[var(--wesal-pink)] hover:text-[var(--wesal-maroon)]"
                    }
                  >
                    <span>{hourClockLabel(hour)}</span>
                    {period ? (
                      <span className={selected ? "text-[0.7rem] text-white/80" : "text-[0.7rem] text-[var(--wesal-maroon)]"}>
                        {periodMark(period)}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
      </AnchoredPanel>
    </div>
  );
}

export default function HallHourlyRangePicker({
  from,
  to,
  fromHours,
  toHours,
  onFromChange,
  onToChange,
  onApply,
  disabled = false,
}: HallHourlyRangePickerProps) {
  const t = useT();
  const endHours = toHoursAfterFrom(from, toHours);

  return (
    <div
      className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4"
      data-testid="hourly-range-picker"
    >
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block min-w-0 text-sm font-semibold text-[var(--wesal-text)]">
          {t("halls.hourly.fromHour")}
          <HourMenu
            testId="hourly-range-from"
            value={from}
            hours={fromHours}
            placeholder={t("halls.hourly.pickHour")}
            disabled={disabled}
            onChange={onFromChange}
          />
        </label>
        <label className="block min-w-0 text-sm font-semibold text-[var(--wesal-text)]">
          {t("halls.hourly.toHour")}
          <HourMenu
            testId="hourly-range-to"
            value={to}
            hours={endHours}
            placeholder={t("halls.hourly.pickHour")}
            disabled={disabled}
            onChange={onToChange}
          />
        </label>
      </div>
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          className="btn-primary min-h-11 disabled:opacity-60"
          disabled={disabled || !from || !to}
          onClick={onApply}
          data-testid="hourly-range-apply"
        >
          {t("halls.hourly.applyRange")}
        </button>
      </div>
    </div>
  );
}
