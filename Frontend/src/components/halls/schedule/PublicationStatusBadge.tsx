"use client";

import { useT } from "@/i18n";

type PublicationStatusBadgeProps = {
  live?: boolean;
};

export default function PublicationStatusBadge({ live = false }: PublicationStatusBadgeProps) {
  const t = useT();
  const label = t("owner.schedule.published");

  return (
    <span
      className="max-w-[min(100%,12.5rem)] shrink-0 truncate rounded-full bg-emerald-50 px-2.5 py-1 text-[0.7rem] font-bold text-emerald-700 ring-1 ring-emerald-100"
      title={label}
      data-testid="owner-schedule-published-badge"
      data-status="published"
      role="status"
      aria-label={label}
      aria-live={live ? "polite" : undefined}
    >
      {label}
    </span>
  );
}
