"use client";

import { useT } from "@/i18n";

type ApproveHallActionButtonProps = {
  disabled: boolean;
  pending: boolean;
  onApprove: () => void;
};

export default function ApproveHallActionButton({
  disabled,
  pending,
  onApprove,
}: ApproveHallActionButtonProps) {
  const t = useT();
  const busy = pending || disabled;

  return (
    <button
      type="button"
      className="btn-primary min-h-11 w-full min-w-0 sm:w-auto sm:min-w-[8.5rem]"
      disabled={busy}
      aria-busy={pending || undefined}
      data-testid="admin-hall-approve"
      onClick={() => {
        if (!busy) onApprove();
      }}
    >
      {pending ? t("admin.halls.approve.submitting") : t("admin.halls.approve.action")}
    </button>
  );
}
