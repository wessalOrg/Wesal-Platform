"use client";

import type { ReactNode } from "react";
import { useT } from "@/i18n";

type PhotographerStudioTypeSelectorProps = {
  value: boolean | null;
  error?: string;
  onChange: (hasStudio: boolean) => void;
};

export default function PhotographerStudioTypeSelector({
  value,
  error,
  onChange,
}: PhotographerStudioTypeSelectorProps) {
  const t = useT();

  return (
    <div>
      <p className="wesal-text-bold mb-2 text-[0.82rem] font-extrabold text-[var(--wesal-maroon)]">
        {t("auth.photographer.setup.studioQuestion")}
      </p>
      <div
        role="radiogroup"
        aria-label={t("auth.photographer.setup.studioQuestion")}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <TypeCard
          selected={value === true}
          title={t("auth.photographer.setup.studioYes")}
          onSelect={() => onChange(true)}
          testId="photographer-type-studio"
          icon={<StudioIcon />}
        />
        <TypeCard
          selected={value === false}
          title={t("auth.photographer.setup.studioNo")}
          onSelect={() => onChange(false)}
          testId="photographer-type-independent"
          icon={<IndependentIcon />}
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TypeCard({
  selected,
  title,
  onSelect,
  testId,
  icon,
}: {
  selected: boolean;
  title: string;
  onSelect: () => void;
  testId: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-testid={testId}
      onClick={onSelect}
      className={`wesal-role-setup-type-card relative flex min-h-[3.5rem] flex-row items-center justify-center gap-2 px-3 py-2.5 text-center ${
        selected ? "wesal-role-setup-type-card--active" : ""
      }`}
    >
      <span
        className={`absolute start-2 top-2 grid size-3.5 place-items-center rounded-full border ${
          selected
            ? "border-[var(--wesal-maroon)] bg-[var(--wesal-maroon)] text-white"
            : "border-[color-mix(in_srgb,var(--wesal-maroon)_35%,var(--wesal-border))] bg-white"
        }`}
        aria-hidden="true"
      >
        {selected ? <span className="size-1 rounded-full bg-white" /> : null}
      </span>
      <span className="shrink-0 text-[var(--wesal-maroon)]" aria-hidden="true">
        {icon}
      </span>
      <span className="wesal-text-bold text-[0.72rem] font-extrabold leading-snug text-[var(--wesal-maroon)] sm:text-[0.78rem]">
        {title}
      </span>
    </button>
  );
}

function StudioIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M4.4 20.2V10.8L12 5.2l7.6 5.6v9.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9.4 20.2v-5h5.2v5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function IndependentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5.5 19.2c1.4-3.2 3.7-4.8 6.5-4.8s5.1 1.6 6.5 4.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
