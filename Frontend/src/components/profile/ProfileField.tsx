"use client";

import type { ChangeEvent, ReactNode } from "react";

type ProfileFieldProps = {
  id: string;
  label: string;
  type?: "text" | "email" | "tel";
  value: string;
  error?: string;
  disabled?: boolean;
  autoComplete?: string;
  dir?: "auto" | "ltr" | "rtl";
  icon?: ReactNode;
  onChange: (value: string) => void;
};

export default function ProfileField({
  id,
  label,
  type = "text",
  value,
  error,
  disabled = false,
  autoComplete,
  dir = "auto",
  icon,
  onChange,
}: ProfileFieldProps) {
  const errorId = `${id}-error`;

  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="mb-1.5 block text-xs font-medium text-[var(--wesal-muted)]">{label}</span>
      <span className="relative block">
        {icon ? (
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[var(--wesal-maroon)]">
            {icon}
          </span>
        ) : null}
        <input
          id={id}
          type={type}
          value={value}
          dir={dir}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
          className={`min-h-12 w-full rounded-2xl border bg-white py-2.5 text-sm outline-none transition focus:border-[var(--wesal-maroon)] disabled:cursor-not-allowed disabled:opacity-70 ${
            icon ? "ps-10 pe-3" : "px-3"
          } ${error ? "border-[#c45b55]" : "border-[var(--wesal-maroon)]/35"}`}
        />
      </span>
      {error ? (
        <span id={errorId} role="alert" className="mt-1.5 block text-xs leading-5 text-[#c45b55]">
          {error}
        </span>
      ) : null}
    </label>
  );
}
