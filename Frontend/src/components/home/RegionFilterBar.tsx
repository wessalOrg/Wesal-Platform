"use client";

import { useT } from "@/i18n";
import {
  REGION_OPTIONS,
  type HallRegion,
} from "@/types/hall";

const REGION_LABEL_KEYS: Record<HallRegion, string> = {
  all: "region.all",
  north: "region.north",
  gaza: "region.gaza",
  middle: "region.middle",
  south: "region.south",
};

type RegionFilterBarProps = {
  value: HallRegion;
  onChange: (region: HallRegion) => void;
  disabled?: boolean;
};

export default function RegionFilterBar({
  value,
  onChange,
  disabled = false,
}: RegionFilterBarProps) {
  const t = useT();

  return (
    <div
      className="mt-6 flex flex-wrap gap-2"
      role="tablist"
      aria-label={t("region.filterAria")}
      data-testid="region-filter"
    >
      {REGION_OPTIONS.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            data-testid={`region-filter-${option.id}`}
            onClick={() => onChange(option.id)}
            className={`cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 disabled:cursor-wait disabled:opacity-70 ${
              active
                ? "bg-[var(--wesal-maroon)] text-white shadow-[0_6px_16px_rgba(193,123,127,0.28)] hover:-translate-y-0.5 hover:bg-[var(--wesal-maroon-dark)]"
                : "border-[1.5px] border-[var(--wesal-maroon)] bg-white text-[var(--wesal-maroon)] hover:-translate-y-0.5 hover:bg-[var(--wesal-maroon)] hover:text-white hover:shadow-[0_8px_18px_rgba(193,123,127,0.25)] active:scale-[0.98]"
            }`}
          >
            {t(option.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
