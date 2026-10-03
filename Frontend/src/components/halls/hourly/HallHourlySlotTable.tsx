"use client";

import { useT } from "@/i18n";
import type { HourlySlot } from "@/types/hourly-booking";

type HallHourlySlotTableProps = {
  slots: HourlySlot[];
  selectedStart: string | null;
  onSelect: (slot: HourlySlot) => void;
  disabled?: boolean;
};

export default function HallHourlySlotTable({
  slots,
  selectedStart,
  onSelect,
  disabled = false,
}: HallHourlySlotTableProps) {
  const t = useT();

  if (slots.length === 0) {
    return (
      <p className="text-sm text-[var(--wesal-muted)]" data-testid="hourly-slots-empty">
        {t("halls.hourly.empty")}
      </p>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white"
      data-testid="hourly-slot-table"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-[var(--wesal-pink-soft)] px-4 py-3 text-sm font-semibold text-[var(--wesal-muted)]">
        <span>{t("halls.hourly.time")}</span>
        <span className="justify-self-end">{t("halls.hourly.status")}</span>
      </div>
      <ul className="m-0 list-none p-0">
        {slots.map((slot) => {
          const booked = slot.status === "booked";
          const selected = slot.start === selectedStart;
          return (
            <li
              key={slot.start}
              className={[
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-[var(--wesal-border)] px-4 py-3",
                selected ? "bg-[var(--wesal-pink-soft)]" : "",
              ].join(" ")}
            >
              <span
                dir="ltr"
                className="justify-self-start whitespace-nowrap text-sm font-semibold tabular-nums tracking-wide text-[var(--wesal-text)]"
              >
                {slot.label}
              </span>
              <button
                type="button"
                disabled={disabled && !booked}
                onClick={() => onSelect(slot)}
                className={[
                  "inline-flex min-h-9 justify-self-end items-center gap-2 rounded-full px-3.5 text-xs font-semibold transition",
                  booked
                    ? "bg-[#fdecea] text-[#b42318] ring-1 ring-[#f5c2c0]"
                    : selected
                      ? "bg-[var(--wesal-maroon)] text-white"
                      : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100",
                ].join(" ")}
                data-testid={`hourly-slot-${slot.start}`}
                data-slot-status={slot.status}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "size-2 shrink-0 rounded-full",
                    booked ? "bg-[#b42318]" : selected ? "bg-white" : "bg-emerald-500",
                  ].join(" ")}
                />
                {booked ? t("halls.hourly.booked") : t("halls.hourly.available")}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
