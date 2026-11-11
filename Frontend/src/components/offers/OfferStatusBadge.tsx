"use client";

import { useT } from "@/i18n";
import type { OfferLifecycleStatus } from "@/types/offers";

const TONE: Record<OfferLifecycleStatus, string> = {
  active:
    "bg-[color-mix(in_srgb,#16a34a_14%,white)] text-[#15803d] ring-[#16a34a]/25",
  scheduled:
    "bg-[color-mix(in_srgb,#d97706_14%,white)] text-[#b45309] ring-[#d97706]/25",
  expired: "bg-[color-mix(in_srgb,#78716c_12%,white)] text-[#57534e] ring-[#a8a29e]/30",
  stopped:
    "bg-[color-mix(in_srgb,var(--wesal-maroon)_14%,white)] text-[var(--wesal-maroon-dark)] ring-[color-mix(in_srgb,var(--wesal-maroon)_28%,transparent)]",
};

const DOT: Record<OfferLifecycleStatus, string> = {
  active: "bg-[#16a34a]",
  scheduled: "bg-[#d97706]",
  expired: "bg-[#a8a29e]",
  stopped: "bg-[var(--wesal-maroon)]",
};

type OfferStatusBadgeProps = {
  status: OfferLifecycleStatus;
  className?: string;
};

export default function OfferStatusBadge({
  status,
  className = "",
}: OfferStatusBadgeProps) {
  const t = useT();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-bold ring-1 ${TONE[status]} ${className}`.trim()}
      data-testid={`offer-status-${status}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} aria-hidden="true" />
      {t(`offers.status.${status}`)}
    </span>
  );
}
