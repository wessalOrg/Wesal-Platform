"use client";

import { useT } from "@/i18n";

type DiscoverEmptyStateProps = {
  variant: "idle" | "loading" | "noResults";
  onClear?: () => void;
};

export default function DiscoverEmptyState({
  variant,
  onClear,
}: DiscoverEmptyStateProps) {
  const t = useT();

  if (variant === "loading") {
    return (
      <div
        className="flex flex-col items-center justify-center px-4 py-16 text-center"
        data-testid="discover-loading"
        aria-busy="true"
      >
        <span className="flex h-28 w-28 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--wesal-maroon)_8%,white)] text-[var(--wesal-maroon)]">
          <ClockIcon />
        </span>
        <p className="mt-5 text-sm font-bold text-[var(--wesal-muted)]">
          {t("discover.searching")}
        </p>
      </div>
    );
  }

  if (variant === "noResults") {
    return (
      <div
        className="flex flex-col items-center justify-center px-4 py-16 text-center"
        data-testid="discover-no-results"
      >
        <span className="flex h-28 w-28 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--wesal-maroon)_8%,white)] text-[var(--wesal-maroon)]">
          <NoResultsIcon />
        </span>
        <p className="mt-5 text-base font-extrabold text-[var(--wesal-maroon-dark)]">
          {t("discover.noResults.title")}
        </p>
        <p className="mt-1 text-sm text-[var(--wesal-muted)]">
          {t("discover.noResults.hint")}
        </p>
        {onClear ? (
          <button
            type="button"
            className="btn-primary mt-5 inline-flex min-h-11 items-center gap-2 px-5"
            onClick={onClear}
            data-testid="discover-clear-search"
          >
            <RefreshIcon />
            {t("discover.noResults.clear")}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center px-4 py-16 text-center"
      data-testid="discover-idle"
    >
      <span className="flex h-28 w-28 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--wesal-maroon)_8%,white)] text-[var(--wesal-maroon)]">
        <SearchIcon />
      </span>
      <p className="mt-5 text-sm font-bold text-[var(--wesal-muted)]">
        {t("discover.idleHint")}
      </p>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m16 16 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v4.5l3 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function NoResultsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4.5 12a7.5 7.5 0 0 1 12.7-5.4M19.5 12a7.5 7.5 0 0 1-12.7 5.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M16 4.5v4h4M8 19.5v-4H4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
