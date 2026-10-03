"use client";

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

  return (
    <div
      className="rounded-2xl border border-[var(--wesal-border)] bg-white p-4"
      data-testid="hourly-range-picker"
    >
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block min-w-0 text-sm font-semibold text-[var(--wesal-text)]">
          {t("halls.hourly.fromHour")}
          <select
            value={from}
            disabled={disabled}
            onChange={(event) => onFromChange(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--wesal-maroon)]"
            data-testid="hourly-range-from"
          >
            <option value="">{t("halls.hourly.pickHour")}</option>
            {fromHours.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0 text-sm font-semibold text-[var(--wesal-text)]">
          {t("halls.hourly.toHour")}
          <select
            value={to}
            disabled={disabled}
            onChange={(event) => onToChange(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--wesal-maroon)]"
            data-testid="hourly-range-to"
          >
            <option value="">{t("halls.hourly.pickHour")}</option>
            {toHours.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        className="btn-primary mt-4 min-h-11 w-full sm:w-auto disabled:opacity-60"
        disabled={disabled || !from || !to}
        onClick={onApply}
        data-testid="hourly-range-apply"
      >
        {t("halls.hourly.applyRange")}
      </button>
    </div>
  );
}
