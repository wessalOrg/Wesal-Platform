"use client";

import SubscriptionPaymentNotice from "@/components/halls/subscription/SubscriptionPaymentNotice";
import type { HallPaymentStatus } from "@/constants/hallPaymentStatus";
import { useT } from "@/i18n";

type PaymentPendingStateProps = {
  hallId?: string;
  hallName?: string;
  paymentStatus?: HallPaymentStatus;
};

export default function PaymentPendingState({
  hallId,
  hallName,
  paymentStatus = "Unpaid",
}: PaymentPendingStateProps) {
  const t = useT();

  if (hallId) {
    return (
      <SubscriptionPaymentNotice
        hallId={hallId}
        hallName={hallName ?? ""}
        paymentStatus={paymentStatus}
      />
    );
  }

  return (
    <section
      className="min-w-0 rounded-2xl border border-[rgba(196,160,92,0.45)] bg-[rgba(196,160,92,0.12)] p-4 sm:p-6"
      role="status"
      data-testid="owner-payment-pending-state"
    >
      <h2 className="text-base font-bold text-[#7a5c1f] sm:text-lg">
        {t("owner.payment.pending.title")}
      </h2>
      <p className="mt-2 break-words text-sm leading-7 text-[var(--wesal-text)]">
        {t("owner.payment.pending.body")}
      </p>
    </section>
  );
}
