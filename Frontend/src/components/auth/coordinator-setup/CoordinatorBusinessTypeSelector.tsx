"use client";

import type { ReactNode } from "react";
import { useT } from "@/i18n";
import type { CoordinatorBusinessType } from "@/types/coordinator-setup";

type CoordinatorBusinessTypeSelectorProps = {
  value: CoordinatorBusinessType | null;
  error?: string;
  onChange: (value: CoordinatorBusinessType) => void;
};

export default function CoordinatorBusinessTypeSelector({
  value,
  error,
  onChange,
}: CoordinatorBusinessTypeSelectorProps) {
  const t = useT();

  return (
    <div>
      <p className="wesal-text-bold mb-2 text-[0.82rem] font-extrabold text-[var(--wesal-maroon)]">
        {t("auth.coordinator.setup.businessQuestion")}
      </p>
      <div
        role="radiogroup"
        aria-label={t("auth.coordinator.setup.businessQuestion")}
        className="grid grid-cols-2 gap-2"
      >
        <TypeCard
          selected={value === "Shop"}
          title={t("auth.coordinator.setup.shopOption")}
          onSelect={() => onChange("Shop")}
          testId="coordinator-type-shop"
          icon={<ShopIcon />}
        />
        <TypeCard
          selected={value === "Freelance"}
          title={t("auth.coordinator.setup.freelanceOption")}
          onSelect={() => onChange("Freelance")}
          testId="coordinator-type-freelance"
          icon={<BriefcaseIcon />}
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
      <span className="wesal-text-bold text-[0.78rem] font-extrabold leading-snug text-[var(--wesal-maroon)] sm:text-[0.82rem]">
        {title}
      </span>
    </button>
  );
}

function ShopIcon() {
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

function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 12.5h17" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
