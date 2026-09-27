"use client";

import HallLockedState from "@/components/halls/HallLockedState";
import PaymentPendingState from "@/components/halls/PaymentPendingState";
import SystemLockedState from "@/components/halls/SystemLockedState";
import type { HallPaymentStatus } from "@/constants/hallPaymentStatus";
import type { ManagementAccessReason } from "@/lib/hall-access";

type ManagementAccessBlockedStateProps = {
  reason: ManagementAccessReason;
  hallId?: string;
  hallName?: string;
  paymentStatus?: HallPaymentStatus;
};

export default function ManagementAccessBlockedState({
  reason,
  hallId,
  hallName,
  paymentStatus,
}: ManagementAccessBlockedStateProps) {
  if (reason === "PAYMENT_REQUIRED") {
    return (
      <PaymentPendingState
        hallId={hallId}
        hallName={hallName}
        paymentStatus={paymentStatus}
      />
    );
  }
  if (reason === "SYSTEM_LOCKED") return <SystemLockedState />;
  if (reason === "ADMIN_AND_SYSTEM_LOCKED") {
    return (
      <div className="space-y-3">
        <SystemLockedState />
        <HallLockedState reason="admin" />
      </div>
    );
  }
  return <HallLockedState reason="admin" />;
}
