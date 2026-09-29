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
    <div className="overflow-hidden rounded-2xl border border-[var(--wesal-border)]" data-testid="hourly-slot-table">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-[var(--wesal-pink-soft)] text-[var(--wesal-muted)]">
          <tr>
            <th className="px-3 py-2.5 text-start font-semibold">{t("halls.hourly.time")}</th>
            <th className="px-3 py-2.5 text-start font-semibold">{t("halls.hourly.status")}</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => {
            const booked = slot.status === "booked";
            const selected = slot.start === selectedStart;
            return (
              <tr key={slot.start} className="border-t border-[var(--wesal-border)]">
                <td className="px-3 py-2.5 font-medium text-[var(--wesal-text)]">{slot.label}</td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    disabled={disabled || booked}
                    onClick={() => onSelect(slot)}
                    className={[
                      "inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition",
                      booked
                        ? "cursor-not-allowed bg-[#fdecea] text-[#dc4c4c] ring-1 ring-[#f5c2c0]"
                        : selected
                          ? "bg-[var(--wesal-maroon)] text-white"
                          : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100",
                    ].join(" ")}
                    data-testid={`hourly-slot-${slot.start}`}
                    data-slot-status={slot.status}
                  >
                    <span aria-hidden="true">{booked ? "🔴" : "🟢"}</span>
                    {booked ? t("halls.hourly.booked") : t("halls.hourly.available")}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
