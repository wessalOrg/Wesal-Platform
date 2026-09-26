"use client";

import { useT } from "@/i18n";

type MarkPaidActionButtonProps = {
  disabled: boolean;
  pending: boolean;
  onMarkPaid: () => void;
  variant?: "primary" | "soft";
};

export default function MarkPaidActionButton({
  disabled,
  pending,
  onMarkPaid,
  variant = "primary",
}: MarkPaidActionButtonProps) {
  const t = useT();
  const busy = pending || disabled;

  return (
    <button
      type="button"
      className={
        variant === "soft" ? "seeker-home-soft-btn" : "btn-primary min-h-11 w-full min-w-0 sm:w-auto sm:min-w-[8.5rem]"
      }
      disabled={busy}
      aria-busy={pending || undefined}
      data-testid="admin-hall-mark-paid"
      onClick={() => {
        if (!busy) onMarkPaid();
      }}
    >
      {pending ? t("admin.halls.paid.submitting") : t("admin.halls.paid.action")}
    </button>
  );
}
