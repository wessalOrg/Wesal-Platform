"use client";

import { useT } from "@/i18n";
import { discoverSearchPlaceholderKey } from "@/lib/discover-filter";
import type { DiscoverFilter } from "@/types/offers";

type DiscoverSearchBoxProps = {
  filter: DiscoverFilter;
  value: string;
  busy?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
};

export default function DiscoverSearchBox({
  filter,
  value,
  busy = false,
  onChange,
  onSubmit,
  onClear,
}: DiscoverSearchBoxProps) {
  const t = useT();
  const hasValue = value.trim().length > 0;

  return (
    <form
      className="mx-auto w-full max-w-[52rem]"
      data-testid="discover-search-box"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="sr-only" htmlFor="discover-search-input">
        {t("discover.search.label")}
      </label>
      <div className="flex min-h-12 items-center gap-2 rounded-full border border-white/70 bg-white px-2 py-1.5 shadow-[0_0.75rem_2rem_rgba(90,55,45,0.08)] sm:min-h-14 sm:px-2.5">
        <span
          className="ms-2 hidden text-[var(--wesal-muted)] sm:inline-flex"
          aria-hidden="true"
        >
          <SearchIcon />
        </span>
        <input
          id="discover-search-input"
          type="search"
          value={value}
          disabled={busy}
          placeholder={t(discoverSearchPlaceholderKey(filter))}
          className="min-w-0 flex-1 bg-transparent px-2 text-sm text-[var(--wesal-text)] outline-none placeholder:text-[var(--wesal-muted)]"
          onChange={(event) => onChange(event.target.value)}
          data-testid="discover-search-input"
        />
        {hasValue ? (
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--wesal-muted)] transition hover:bg-[var(--wesal-pink-soft)] hover:text-[var(--wesal-maroon)]"
            aria-label={t("discover.search.clear")}
            onClick={onClear}
            data-testid="discover-search-clear"
          >
            <CloseIcon />
          </button>
        ) : null}
        <button
          type="submit"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-[var(--wesal-maroon)] px-3.5 text-sm font-bold text-white transition hover:bg-[var(--wesal-maroon-dark)] disabled:opacity-60 sm:px-5"
          disabled={busy}
          data-testid="discover-search-submit"
        >
          <SearchIcon className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only sm:inline">{t("discover.search.submit")}</span>
        </button>
      </div>
    </form>
  );
}

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16 16 3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
