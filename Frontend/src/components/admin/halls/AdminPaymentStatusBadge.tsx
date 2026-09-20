"use client";

import { useT } from "@/i18n";
import type { AdminPaymentStatus } from "@/types/admin-halls";

type AdminPaymentStatusBadgeProps = {
  status: AdminPaymentStatus;
};

export default function AdminPaymentStatusBadge({ status }: AdminPaymentStatusBadgeProps) {
  const t = useT();

  const tone =
    status === "Paid"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : status === "ReceiptUploaded"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-[rgba(196,160,92,0.2)] text-[#7a5c1f] ring-[rgba(196,160,92,0.45)]";

  const labelKey =
    status === "Paid"
      ? "admin.halls.paid.badge.paid"
      : status === "ReceiptUploaded"
        ? "admin.halls.paid.badge.receiptUploaded"
        : "admin.halls.paid.badge.unpaid";

  return (
    <span
      className={`inline-flex max-w-full min-h-7 items-center rounded-full px-2.5 py-1 text-[0.7rem] font-bold leading-4 ring-1 ${tone}`}
      data-testid="admin-payment-status-badge"
      data-status={status}
      role="status"
    >
      {t(labelKey)}
    </span>
  );
}