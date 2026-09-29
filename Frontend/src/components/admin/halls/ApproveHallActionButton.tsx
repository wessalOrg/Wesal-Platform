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
      className="btn-outline inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 sm:w-auto sm:min-w-[8.5rem]"
      disabled={busy}
      aria-busy={pending || undefined}
      data-testid="admin-hall-approve"
      onClick={() => {
        if (!busy) onApprove();
      }}
    >
      <CheckIcon />
      {pending ? t("admin.halls.approve.submitting") : t("admin.halls.approve.action")}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        d="m6.5 12.5 3.2 3.2 7.8-7.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
