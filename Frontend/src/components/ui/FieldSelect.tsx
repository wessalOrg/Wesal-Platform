"use client";

import { useEffect, useId, useRef, useState } from "react";

export type FieldSelectOption<T extends string> = {
  id: T;
  label: string;
};

type FieldSelectProps<T extends string> = {
  value: T;
  options: FieldSelectOption<T>[];
  onChange: (value: T) => void;
  "aria-label"?: string;
};

export default function FieldSelect<T extends string>({
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
}: FieldSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative mt-1.5">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-[var(--wesal-border)] bg-[#faf7f5] px-3 text-start text-sm font-medium text-[var(--wesal-text)] outline-none transition hover:border-[var(--wesal-maroon)]/50 focus:border-[var(--wesal-maroon)]"
      >
        <span className="min-w-0 truncate">{selected?.label}</span>
        <Chevron open={open} />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-[var(--wesal-border)] bg-white py-1.5 shadow-[0_12px_28px_rgba(90,55,45,0.12)]"
        >
          {options.map((option) => {
            const active = option.id === value;
            return (
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={`flex w-full cursor-pointer px-3 py-2.5 text-start text-sm font-medium transition ${
                    active
                      ? "bg-[var(--wesal-maroon)] text-white"
                      : "text-[var(--wesal-text)] hover:bg-[var(--wesal-pink-soft)]"
                  }`}
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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-[var(--wesal-muted)] transition ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
