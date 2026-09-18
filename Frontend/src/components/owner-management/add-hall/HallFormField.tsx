"use client";

import type { ReactNode } from "react";

type HallFormFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
};

export default function HallFormField({
  id,
  label,
  required = false,
  error,
  hint,
  children,
}: HallFormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="owner-add-hall-field min-w-0 max-w-full overflow-visible">
      <label
        htmlFor={id}
        className="mb-1.5 block break-words text-sm font-semibold text-[var(--wesal-text)]"
      >
        {label}
        {required ? (
          <span className="ms-1 text-[#c45b55]" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <div className="min-w-0 max-w-full">{children}</div>
      {hint && !error ? (
        <p
          id={hintId}
          className="mt-1.5 break-words text-xs leading-5 text-[var(--wesal-muted)]"
        >
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 break-words text-xs leading-5 text-[#c45b55]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function hallFieldClassName(hasError: boolean): string {
  return [
    "box-border min-h-12 w-full min-w-0 max-w-full rounded-xl border bg-white",
    "px-3.5 py-2.5 text-base outline-none transition sm:text-sm",
    "placeholder:text-[var(--wesal-muted)]",
    "focus-visible:border-[var(--wesal-maroon)] focus-visible:ring-2 focus-visible:ring-[var(--wesal-maroon)]/20",
    "disabled:cursor-not-allowed disabled:opacity-70",
    hasError
      ? "border-[#c45b55]"
      : "border-[var(--wesal-border)]",
  ].join(" ");
}
