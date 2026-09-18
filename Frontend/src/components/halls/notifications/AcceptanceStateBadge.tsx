"use client";

import { useT } from "@/i18n";
import { ownerRequestStatusMessageKey } from "@/lib/owner-booking-status";
import type { OwnerBookingRequestStatus } from "@/types/hall-notifications";

type AcceptanceStateBadgeProps = {
  status: OwnerBookingRequestStatus;
  live?: boolean;
};

const styles: Record<OwnerBookingRequestStatus, string> = {
  Pending: "bg-[rgba(193,123,127,0.16)] text-[var(--wesal-maroon)]",
  AcceptedPendingDeposit:
    "bg-[rgba(196,160,92,0.22)] text-[#8a6a2a] ring-1 ring-[rgba(196,160,92,0.35)]",
  FullyBooked: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-[#fbf4f2] text-[var(--wesal-maroon-dark)]",
  Cancelled: "bg-[var(--wesal-pink-soft)] text-[var(--wesal-muted)]",
};

export default function AcceptanceStateBadge({
  status,
  live = false,
}: AcceptanceStateBadgeProps) {
  const t = useT();
  const label = t(ownerRequestStatusMessageKey(status));
  const hint =
    status === "AcceptedPendingDeposit" ? t("owner.notifications.depositHint") : label;
  const announce = live || status === "AcceptedPendingDeposit";

  return (
    <span
      className={`max-w-[min(100%,12.5rem)] shrink-0 truncate rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${styles[status]}`}
      title={hint}
      data-testid="owner-request-status"
      data-status={status}
      role="status"
      aria-label={hint}
      aria-live={announce ? "polite" : undefined}
    >
      {label}
    </span>
  );
}
