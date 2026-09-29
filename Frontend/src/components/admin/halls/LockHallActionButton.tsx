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
        variant === "soft"
          ? "seeker-home-soft-btn gap-2"
          : "btn-outline inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 sm:w-auto sm:min-w-[8.5rem]"
      }
      disabled={busy}
      aria-busy={pending || undefined}
      data-testid="admin-hall-lock"
      onClick={() => {
        if (!busy) onLock();
      }}
    >
      <LockIcon />
      {pending ? t("admin.lock.submitting") : t("admin.lock.submit")}
    </button>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
      <rect x="6" y="10" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.5 10V8a3.5 3.5 0 0 1 7 0v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
