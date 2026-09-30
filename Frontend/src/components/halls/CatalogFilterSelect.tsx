"use client";

import { useEffect, useId, useRef, useState } from "react";

export type CatalogFilterOption = {
  value: string;
  label: string;
};

type CatalogFilterSelectProps = {
  id: string;
  label: string;
  value: string;
  options: CatalogFilterOption[];
  placeholder?: string;
  disabled?: boolean;
  testId: string;
  onChange: (value: string) => void;
};

export default function CatalogFilterSelect({
  id,
  label,
  value,
  options,
  placeholder,
  disabled = false,
  testId,
  onChange,
}: CatalogFilterSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const display = selected?.label || placeholder || "";
  const showingPlaceholder = !selected;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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
    <div ref={rootRef} className="relative min-w-0">
      <span id={`${id}-label`} className="mb-1.5 block text-sm font-semibold text-[var(--wesal-text)]">
        {label}
      </span>
      <button
        id={id}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        data-testid={testId}
        className="flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--wesal-border)] bg-white px-3 text-start text-sm outline-none transition focus:border-[var(--wesal-maroon)] disabled:cursor-not-allowed disabled:bg-[var(--wesal-pink-soft)]"
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
      >
        <span
          className={`min-w-0 truncate ${
            showingPlaceholder || disabled
              ? "text-[var(--wesal-muted)]"
              : "text-[var(--wesal-text)]"
          }`}
        >
          {display}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && !disabled ? (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={`${id}-label`}
          data-testid={`${testId}-list`}
          className="absolute inset-x-0 z-40 mt-2 max-h-64 overflow-y-auto rounded-xl border border-[var(--wesal-border)] bg-white py-1 shadow-[0_14px_36px_rgba(90,55,45,0.14)]"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value || "empty"}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`flex w-full items-center px-3.5 py-2.5 text-start text-sm transition ${
                    isSelected
                      ? "bg-[var(--wesal-maroon)] font-semibold text-white"
                      : "text-[var(--wesal-text)] hover:bg-[var(--wesal-pink-soft)]"
                  }`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
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
