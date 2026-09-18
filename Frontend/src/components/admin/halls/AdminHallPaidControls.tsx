"use client";

import AdminPaymentStatusBadge from "@/components/admin/halls/AdminPaymentStatusBadge";
import MarkPaidActionButton from "@/components/admin/halls/MarkPaidActionButton";
import { useMarkHallSubscriptionPaid } from "@/hooks/useMarkHallSubscriptionPaid";
import { canMarkHallPaid } from "@/lib/admin-halls-mapper";
import type {
  AdminHallStatus,
  AdminMarkPaidResult,
  AdminPaymentStatus,
} from "@/types/admin-halls";
import { useT } from "@/i18n";

type AdminHallPaidControlsProps = {
  hallId: string;
  status: AdminHallStatus;
  paymentStatus: AdminPaymentStatus;
  systemLocked: boolean;
  cycleEnd: string | null;
  variant?: "primary" | "soft";
  showBadge?: boolean;
  onPaid?: (result: AdminMarkPaidResult) => void;
};

export default function AdminHallPaidControls({
  hallId,
  status,
  paymentStatus,
  systemLocked,
  cycleEnd,
  variant = "primary",
  showBadge = true,
  onPaid,
}: AdminHallPaidControlsProps) {
  const t = useT();
  const paidState = useMarkHallSubscriptionPaid({
    onPaid,
  });

  const canPay = canMarkHallPaid(status, paymentStatus, systemLocked, cycleEnd);

  if (!canPay && !showBadge && !paidState.errorKey) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
      {paidState.errorKey ? (
        <p className="rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[#b42318]" role="alert">
          {t(paidState.errorKey)}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {showBadge ? <AdminPaymentStatusBadge status={paymentStatus} /> : null}
        {canPay ? (
          <MarkPaidActionButton
            disabled={paidState.pending}
            pending={paidState.pending}
            variant={variant}
            onMarkPaid={() => {
              paidState.clearError();
              void paidState.markPaid(hallId);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
