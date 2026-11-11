"use client";

import type { ReactNode } from "react";

export type StatCardProps = {
  title: string;
  value: string;
  icon: ReactNode;
  /** Optional change label, e.g. "+12%". Omitted when the API has no period comparison. */
  changeLabel?: string | null;
  testId?: string;
};

export default function StatCard({
  title,
  value,
  icon,
  changeLabel = null,
  testId,
}: StatCardProps) {
  return (
    <article
      className="flex min-h-[7.5rem] flex-col justify-between rounded-[1.25rem] border border-[var(--wesal-border)] bg-white p-4 shadow-[0_0.5rem_1.5rem_rgba(90,55,45,0.05)] sm:p-5"
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--wesal-muted)]">{title}</p>
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--wesal-maroon)_12%,white)] text-[var(--wesal-maroon-dark)]"
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <p className="text-3xl font-extrabold tracking-tight text-[var(--wesal-text)] sm:text-[2rem]">
          {value}
        </p>
        {changeLabel ? (
          <span className="mb-1 text-xs font-bold text-[#12b76a]">{changeLabel}</span>
        ) : null}
      </div>
    </article>
  );
}
