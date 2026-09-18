"use client";

import { useT } from "@/i18n";

type UnlockHallActionButtonProps = {
  disabled: boolean;
  pending: boolean;
  onUnlock: () => void;
  variant?: "primary" | "soft";
};

export default function UnlockHallActionButton({
  disabled,
  pending,
  onUnlock,
  variant = "primary",
}: UnlockHallActionButtonProps) {
  const t = useT();
  const busy = pending || disabled;

  return (
    <button
      type="button"
      className={
        variant === "soft" ? "seeker-home-soft-btn" : "btn-primary min-h-11 min-w-[8.5rem]"
      }
      disabled={busy}
      aria-busy={pending || undefined}
      data-testid="admin-hall-unlock"
      onClick={() => {
        if (!busy) onUnlock();
      }}
    >
      {pending ? t("admin.halls.unlock.submitting") : t("admin.halls.unlock.action")}
    </button>
  );
}
