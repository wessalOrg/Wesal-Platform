"use client";

import { useT } from "@/i18n";

type RejectHallActionButtonProps = {
  disabled: boolean;
  pending: boolean;
  onReject: () => void;
  variant?: "primary" | "soft";
};

export default function RejectHallActionButton({
  disabled,
  pending,
  onReject,
  variant = "primary",
}: RejectHallActionButtonProps) {
  const t = useT();
  const busy = pending || disabled;

  return (
    <button
      type="button"
      className={
        variant === "soft"
          ? "seeker-home-soft-btn"
          : "btn-outline min-h-11 min-w-[8.5rem]"
      }
      disabled={busy}
      aria-busy={pending || undefined}
      data-testid="admin-hall-reject"
      onClick={() => {
        if (!busy) onReject();
      }}
    >
      {pending ? t("admin.reject.submitting") : t("admin.reject.submit")}
    </button>
  );
}
