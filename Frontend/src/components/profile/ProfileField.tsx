"use client";

import { useState, type ChangeEvent, type ReactNode } from "react";
import { useT } from "@/i18n";

type ProfileFieldProps = {
  id: string;
  label: string;
  type?: "text" | "email" | "tel" | "password";
  value: string;
  error?: string;
  disabled?: boolean;
  autoComplete?: string;
  dir?: "auto" | "ltr" | "rtl";
  icon?: ReactNode;
  /** When true on password fields, shows an eye toggle to reveal the value. */
  revealable?: boolean;
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
  revealable = false,
  onChange,
}: ProfileFieldProps) {
  const t = useT();
  const errorId = `${id}-error`;
  const [revealed, setRevealed] = useState(false);
  const canReveal = type === "password" && revealable;
  const inputType = canReveal && revealed ? "text" : type;
  const hasTrailing = canReveal;
  const paddingClass = icon
    ? hasTrailing
      ? "ps-10 pe-11"
      : "ps-10 pe-3"
    : hasTrailing
      ? "ps-3 pe-11"
      : "px-3";

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
          type={inputType}
          value={value}
          dir={dir}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
          className={`min-h-12 w-full rounded-2xl border bg-white py-2.5 text-sm outline-none transition focus:border-[var(--wesal-maroon)] disabled:cursor-not-allowed disabled:opacity-70 ${paddingClass} ${
            error ? "border-[#c45b55]" : "border-[var(--wesal-maroon)]/35"
          }`}
        />
        {canReveal ? (
          <span className="absolute inset-y-0 end-2 flex items-center">
            <button
              type="button"
              tabIndex={0}
              disabled={disabled}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8a7a70] transition hover:bg-[var(--wesal-maroon)]/8 hover:text-[var(--wesal-maroon)] disabled:cursor-not-allowed disabled:opacity-70"
              aria-label={
                revealed
                  ? t("auth.login.form.hidePassword")
                  : t("auth.login.form.showPassword")
              }
              aria-pressed={revealed}
              onClick={() => setRevealed((current) => !current)}
            >
              {revealed ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </span>
        ) : null}
      </span>
      {error ? (
        <span id={errorId} role="alert" className="mt-1.5 block text-xs leading-5 text-[#c45b55]">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12s-3.75 6.75-9.75 6.75S2.25 12 2.25 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M3 3l18 18M10.58 10.58A2.5 2.5 0 0 0 12 15.5a2.5 2.5 0 0 0 1.42-.42M6.71 6.71C4.66 8.17 3.09 10.09 2.25 12c0 0 3.75 6.75 9.75 6.75 1.73 0 3.35-.45 4.77-1.24M17.94 17.94C19.34 16.54 20.91 14.62 21.75 12c0 0-1.57-1.92-3.62-3.29"
        strokeLinecap="round"
      />
    </svg>
  );
}
