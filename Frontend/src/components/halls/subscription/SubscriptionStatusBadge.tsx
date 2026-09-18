"use client";

import { useT } from "@/i18n";
import { subscriptionStatusMessageKey } from "@/lib/hall-subscription";
import type { HallSubscriptionStatus } from "@/types/hall-subscription";

type SubscriptionStatusBadgeProps = {
  status: HallSubscriptionStatus;
};

const styles: Record<HallSubscriptionStatus, string> = {
  active:
    "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  unpaid:
    "bg-[rgba(196,160,92,0.2)] text-[#7a5c1f] ring-1 ring-[rgba(196,160,92,0.45)]",
  expired:
    "bg-[#fff4e8] text-[#9a4a12] ring-1 ring-[#f3d2b0]",
  locked:
    "bg-[var(--wesal-pink)] text-[var(--wesal-maroon-dark)] ring-1 ring-[rgba(168,98,103,0.35)]",
};

export default function SubscriptionStatusBadge({ status }: SubscriptionStatusBadgeProps) {
  const t = useT();
  const label = t(subscriptionStatusMessageKey(status));

  return (
    <span
      className={`inline-flex max-w-full min-h-7 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-bold leading-4 sm:max-w-[15rem] ${styles[status]}`}
      title={label}
      data-testid="hall-subscription-badge"
      data-status={status}
      role="status"
      aria-label={label}
      aria-live="polite"
    >
      <StatusIcon status={status} />
      <span className="min-w-0 [overflow-wrap:anywhere] sm:truncate">{label}</span>
    </span>
  );
}

function StatusIcon({ status }: { status: HallSubscriptionStatus }) {
  const className = "h-3.5 w-3.5 shrink-0";
  if (status === "active") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 12.2 10.8 15 16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "unpaid") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 7.5v5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 16.4h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "expired") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 8.6v4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 16.6h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M11.1 4.8 2.8 18.2A1.1 1.1 0 0 0 3.7 20h16.6a1.1 1.1 0 0 0 1-1.8L12.9 4.8a1.1 1.1 0 0 0-1.8 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V8.2a4 4 0 0 1 8 0V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
