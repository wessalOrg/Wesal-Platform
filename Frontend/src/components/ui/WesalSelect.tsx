"use client";

import { useEffect, useId, useRef, useState } from "react";
import AnchoredPanel from "@/components/ui/AnchoredPanel";

export type WesalSelectOption = {
  value: string;
  label: string;
};

type WesalSelectProps = {
  id?: string;
  label?: string;
  labelHidden?: boolean;
  value: string;
  options: WesalSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  testId?: string;
  onChange: (value: string) => void;
};

/**
 * Branded listbox replacing native `<select>` so open/selected states use
 * Wesal maroon and the menu stays flush under the trigger at matching width.
 */
export default function WesalSelect({
  id,
  label,
  labelHidden = false,
  value,
  options,
  placeholder,
  disabled = false,
  className = "",
  triggerClassName = "",
  testId,
  onChange,
}: WesalSelectProps) {
  const listId = useId();
  const autoId = useId();
  const fieldId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const display = selected?.label || placeholder || "";
  const showingPlaceholder = !selected;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
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
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      {label ? (
        <span
          id={`${fieldId}-label`}
          className={
            labelHidden
              ? "sr-only"
              : "mb-1 block text-xs font-semibold text-[var(--wesal-text)] sm:text-sm"
          }
        >
          {label}
        </span>
      ) : null}
      <button
        ref={triggerRef}
        id={fieldId}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-labelledby={label ? `${fieldId}-label` : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        data-testid={testId}
        className={
          triggerClassName ||
          "flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-[var(--wesal-border)] bg-white px-3 text-start text-sm text-[var(--wesal-text)] outline-none transition focus:border-[var(--wesal-maroon)] disabled:cursor-not-allowed disabled:opacity-60"
        }
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

      <AnchoredPanel
        as="ul"
        open={open && !disabled}
        anchorRef={triggerRef}
        panelRef={panelRef}
        options={{ width: "anchor", estimateHeight: 280 }}
        id={listId}
        role="listbox"
        aria-labelledby={label ? `${fieldId}-label` : undefined}
        data-testid={testId ? `${testId}-list` : undefined}
        className="m-0 list-none rounded-xl border border-[var(--wesal-border)] bg-white py-1 shadow-[0_14px_36px_rgba(90,55,45,0.14)]"
      >
        {placeholder ? (
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
        ) : null}
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
      </AnchoredPanel>
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
