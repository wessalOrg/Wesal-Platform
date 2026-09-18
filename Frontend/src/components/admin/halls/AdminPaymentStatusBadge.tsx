"use client";

import { useT } from "@/i18n";
import type { AdminPaymentStatus } from "@/types/admin-halls";

type AdminPaymentStatusBadgeProps = {
  status: AdminPaymentStatus;
};

export default function AdminPaymentStatusBadge({ status }: AdminPaymentStatusBadgeProps) {
  const t = useT();
  const paid = status === "Paid";

  return (
    <span
      className={
        paid
          ? "inline-flex max-w-full min-h-7 items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[0.7rem] font-bold leading-4 text-emerald-800 ring-1 ring-emerald-200"
          : "inline-flex max-w-full min-h-7 items-center rounded-full bg-[rgba(196,160,92,0.2)] px-2.5 py-1 text-[0.7rem] font-bold leading-4 text-[#7a5c1f] ring-1 ring-[rgba(196,160,92,0.45)]"
      }
      data-testid="admin-payment-status-badge"
      data-status={status}
      role="status"
    >
      {paid ? t("admin.halls.paid.badge.paid") : t("admin.halls.paid.badge.unpaid")}
    </span>
  );
}
