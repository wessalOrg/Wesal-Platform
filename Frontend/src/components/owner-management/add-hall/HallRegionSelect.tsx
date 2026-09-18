"use client";

import { useEffect, useId, useRef, useState } from "react";
import { hallFieldClassName } from "@/components/owner-management/add-hall/HallFormField";
import {
  HALL_REGION_LABEL_KEYS,
  HALL_REGIONS,
  isHallRegion,
  type HallRegion,
} from "@/constants/hallRegions";
import { useT } from "@/i18n";

type HallRegionSelectProps = {
  id: string;
  value: HallRegion | "";
  disabled?: boolean;
  hasError?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  onChange: (region: HallRegion | "") => void;
};

export default function HallRegionSelect({
  id,
  value,
  disabled = false,
  hasError = false,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  onChange,
}: HallRegionSelectProps) {
  const t = useT();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const placeholder = t("owner.management.addHall.fields.regionPlaceholder");
  const displayLabel = value
    ? t(HALL_REGION_LABEL_KEYS[value])
    : placeholder;

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

  return (
    <div ref={rootRef} className="owner-add-hall-region-select relative min-w-0">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        data-testid="hall-region-trigger"
        className={`${hallFieldClassName(hasError)} flex cursor-pointer items-center justify-between gap-3 text-start`}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
      >
        <span
          className={
            value
              ? "truncate text-[var(--wesal-text)]"
              : "truncate text-[var(--wesal-muted)]"
          }
        >
          {displayLabel}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={id}
          data-testid="hall-region-list"
          className="absolute inset-inline-start-0 z-40 mt-2 w-full overflow-hidden rounded-xl border border-[var(--wesal-border)] bg-white py-1 shadow-[0_14px_36px_rgba(90,55,45,0.12)]"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={`flex w-full items-center px-3.5 py-2.5 text-start text-sm transition ${
                !value
                  ? "bg-[var(--wesal-maroon)] font-semibold text-white"
                  : "text-[var(--wesal-muted)] hover:bg-[var(--wesal-pink-soft)]"
              }`}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {placeholder}
            </button>
          </li>
          {HALL_REGIONS.map((region) => {
            const selected = value === region;
            return (
              <li key={region}>
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
                    if (isHallRegion(region)) onChange(region);
                    setOpen(false);
                  }}
                >
                  {t(HALL_REGION_LABEL_KEYS[region])}
                </button>
              </li>
            );
          })}
        </ul>
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
