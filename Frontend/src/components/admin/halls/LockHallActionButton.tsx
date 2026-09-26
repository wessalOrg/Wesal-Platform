"use client";

import { useT } from "@/i18n";

type LockHallActionButtonProps = {
  disabled: boolean;
  pending: boolean;
  onLock: () => void;
  variant?: "primary" | "soft";
};

export default function LockHallActionButton({
  disabled,
  pending,
  onLock,
  variant = "primary",
}: LockHallActionButtonProps) {
  const t = useT();
  const busy = pending || disabled;

  return (
    <button
      type="button"
      className={
        variant === "soft" ? "seeker-home-soft-btn" : "btn-outline min-h-11 w-full min-w-0 sm:w-auto sm:min-w-[8.5rem]"
      }
      disabled={busy}
      aria-busy={pending || undefined}
      data-testid="admin-hall-lock"
      onClick={() => {
        if (!busy) onLock();
      }}
    >
      {pending ? t("admin.lock.submitting") : t("admin.lock.submit")}
    </button>
  );
}
