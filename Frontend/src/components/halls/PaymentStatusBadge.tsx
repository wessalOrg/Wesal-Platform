"use client";

import { getHallPaymentStatusConfig } from "@/constants/hallPaymentStatus";
import type { HallPaymentStatus } from "@/constants/hallPaymentStatus";
import { useT } from "@/i18n";

type PaymentStatusBadgeProps = {
  status: HallPaymentStatus;
  className?: string;
};

export default function PaymentStatusBadge({
  status,
  className = "",
}: PaymentStatusBadgeProps) {
  const t = useT();
  const payment = getHallPaymentStatusConfig(status);

  return (
    <span
      className={`owner-hall-status-badge owner-hall-status-badge--${payment.tone} ${className}`.trim()}
      data-testid="owner-payment-status-badge"
      data-payment-status={status}
    >
      {t(payment.labelKey)}
    </span>
  );
}