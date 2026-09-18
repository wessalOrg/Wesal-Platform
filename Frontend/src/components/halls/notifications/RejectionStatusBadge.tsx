"use client";

import { useT } from "@/i18n";

type RejectionStatusBadgeProps = {
  live?: boolean;
};

export default function RejectionStatusBadge({ live = false }: RejectionStatusBadgeProps) {
  const t = useT();
  const label = t("bookings.status.rejected");

  return (
    <span
      className="max-w-[min(100%,12.5rem)] shrink-0 truncate rounded-full bg-[#fbf4f2] px-2.5 py-1 text-[0.7rem] font-bold text-[var(--wesal-maroon-dark)]"
      title={label}
      data-testid="owner-request-status"
      data-status="Rejected"
      role="status"
      aria-label={label}
      aria-live={live ? "polite" : undefined}
    >
      {label}
    </span>
  );
}
