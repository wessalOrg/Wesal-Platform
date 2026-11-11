"use client";

import { useT } from "@/i18n";
import { DISCOVER_FILTERS } from "@/lib/discover-filter";
import type { DiscoverFilter } from "@/types/offers";

type DiscoverFilterTabsProps = {
  value: DiscoverFilter;
  onChange: (filter: DiscoverFilter) => void;
};

export default function DiscoverFilterTabs({
  value,
  onChange,
}: DiscoverFilterTabsProps) {
  const t = useT();

  return (
    <div
      className="-mx-1 flex flex-nowrap justify-start gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:pb-0"
      role="tablist"
      aria-label={t("discover.filtersLabel")}
      data-testid="discover-filter-tabs"
    >
      {DISCOVER_FILTERS.map((key) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${
              active
                ? "bg-[var(--wesal-maroon)] text-white shadow-[0_0.35rem_1rem_rgba(141,68,72,0.28)]"
                : "bg-[color-mix(in_srgb,var(--wesal-maroon)_8%,white)] text-[var(--wesal-maroon-dark)] hover:bg-[color-mix(in_srgb,var(--wesal-maroon)_14%,white)]"
            }`}
            onClick={() => onChange(key)}
            data-testid={`discover-filter-${key}`}
          >
            <FilterIcon id={key} />
            {t(`discover.filter.${key}`)}
          </button>
        );
      })}
    </div>
  );
}

function FilterIcon({ id }: { id: DiscoverFilter }) {
  const className = "h-3.5 w-3.5 shrink-0";
  switch (id) {
    case "All":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
          <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
          <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
          <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case "Halls":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M4 20V8.5L12 4l8 4.5V20H4Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case "EventCoordinators":
    case "Coordinators":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M5.5 19c1.1-3.2 3.4-4.8 6.5-4.8s5.4 1.6 6.5 4.8"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case "Photographers":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="3.5" y="7" width="17" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8 7 9.5 4.5h5L16 7" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case "Offers":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M12.5 3.5 20.5 11.5a2.1 2.1 0 0 1 0 3L14.5 20.5a2.1 2.1 0 0 1-3 0L3.5 12.5V3.5h9Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <circle cx="8.2" cy="8.2" r="1.2" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}
