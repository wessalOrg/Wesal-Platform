"use client";

import { useT } from "@/i18n";

type AdminMessageSearchProps = {
  value: string;
  onChange: (next: string) => void;
};

export default function AdminMessageSearch({ value, onChange }: AdminMessageSearchProps) {
  const t = useT();

  return (
    <label className="relative block" data-testid="admin-message-search">
      <span className="sr-only">{t("admin.messages.searchLabel")}</span>
      <span
        className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[var(--wesal-muted)]"
        aria-hidden="true"
      >
        <SearchIcon />
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("admin.messages.searchPlaceholder")}
        className="w-full rounded-xl border border-[var(--wesal-border)] bg-white py-2.5 pe-3 ps-9 text-sm text-[var(--wesal-text)] outline-none placeholder:text-[var(--wesal-muted)] focus:border-[var(--wesal-maroon-dark)]"
        data-testid="admin-message-search-input"
      />
    </label>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16.2 16.2 20 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
