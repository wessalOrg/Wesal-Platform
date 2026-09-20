"use client";

import { useT } from "@/i18n";
import { paymentStatusMessageKey, type PaymentStatus } from "@/lib/hall-payment-status";

type PaymentStatusBadgeProps = {
  status: PaymentStatus;
  className?: string;
};

export default function PaymentStatusBadge({
  status,
  className = "",
}: PaymentStatusBadgeProps) {
  const t = useT();
  const tone = status === "Paid" ? "ok" : "wait";

  return (
    <span
      className={`owner-hall-status-badge owner-hall-status-badge--${tone} ${className}`.trim()}
      data-testid="owner-payment-status-badge"
      data-payment-status={status}
    >
      {t(paymentStatusMessageKey(status))}
    </span>
  );
}
