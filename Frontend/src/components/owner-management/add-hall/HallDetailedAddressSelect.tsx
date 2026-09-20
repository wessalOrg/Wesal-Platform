"use client";

import { useEffect, useId, useRef, useState } from "react";
import { hallFieldClassName } from "@/components/owner-management/add-hall/HallFormField";
import { useT } from "@/i18n";

type HallDetailedAddressSelectProps = {
  id: string;
  value: string;
  addresses: string[];
  disabled?: boolean;
  hasError?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  onChange: (value: string) => void;
};

/**
 * Searchable dropdown of the selected region's predefined detailed addresses
 * (US-HALL). The backend accepts only exact catalog entries for DetailedAddress,
 * so selection is always from this list — never free-text.
 */
export default function HallDetailedAddressSelect({
  id,
  value,
  addresses,
  disabled = false,
  hasError = false,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  onChange,
}: HallDetailedAddressSelectProps) {
  const t = useT();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const placeholder = t(
    "owner.management.addHall.fields.detailedAddressPlaceholder",
  );
  const emptyHint = t("owner.management.addHall.fields.detailedAddressEmpty");

  const filtered = query.trim()
    ? addresses.filter((address) =>
        address.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : addresses;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      // Focus the search box on the next frame so the combobox opens ready to type.
      const frame = requestAnimationFrame(() => searchRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        id={id}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        data-testid="hall-detailed-address-trigger"
        className={`${hallFieldClassName(hasError)} flex cursor-pointer items-center justify-between gap-3 text-start`}
        onClick={() => {
          if (disabled) return;
          if (!open) setQuery("");
          setOpen((current) => !current);
        }}
      >
        <span
          className={
            value
              ? "truncate text-[var(--wesal-text)]"
              : "truncate text-[var(--wesal-muted)]"
          }
        >
          {value || placeholder}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-labelledby={id}
          data-testid="hall-detailed-address-list"
          className="absolute inset-inline-start-0 z-40 mt-2 w-full min-w-0 overflow-hidden rounded-xl border border-[var(--wesal-border)] bg-white py-1 shadow-[0_14px_36px_rgba(90,55,45,0.12)]"
        >
          <div className="border-b border-[var(--wesal-border)] px-2.5 py-2">
            <input
              ref={searchRef}
              type="search"
              value={query}
              aria-label={t("owner.management.addHall.fields.detailedAddressSearch")}
              placeholder={t(
                "owner.management.addHall.fields.detailedAddressSearch",
              )}
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
              className="box-border min-h-10 w-full min-w-0 rounded-lg border border-[var(--wesal-border)] bg-white px-3 py-2 text-sm outline-none transition focus-visible:border-[var(--wesal-maroon)] focus-visible:ring-2 focus-visible:ring-[var(--wesal-maroon)]/20"
            />
          </div>

          <ul className="max-h-56 min-w-0 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3.5 py-2.5 text-sm text-[var(--wesal-muted)]">
                {query.trim() ? emptyHint : placeholder}
              </li>
            ) : (
              filtered.map((address) => {
                const selected = value === address;
                return (
                  <li key={address}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`flex w-full items-center px-3.5 py-2.5 text-start text-sm transition ${
                        selected
                          ? "bg-[var(--wesal-maroon)] font-semibold text-white"
                          : "text-[var(--wesal-text)] hover:bg-[var(--wesal-pink-soft)]"
                      }`}
                      onClick={() => {
                        onChange(address);
                        setOpen(false);
                      }}
                    >
                      {address}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <li className="sr-only" role="status">
            {t("owner.management.addHall.fields.detailedAddressCount", {
              count: filtered.length,
            })}
          </li>
        </div>
      ) : null}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-4 w-4 shrink-0 text-[var(--wesal-muted)] transition-transform ${
        open ? "rotate-180" : ""
      }`}
      aria-hidden="true"
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}