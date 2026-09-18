"use client";

import { useT } from "@/i18n";

type AcceptActionButtonProps = {
  bookingId: string;
  busy?: boolean;
  disabled?: boolean;
  describedBy?: string;
  onClick: () => void;
};

export default function AcceptActionButton({
  bookingId,
  busy = false,
  disabled = false,
  describedBy,
  onClick,
}: AcceptActionButtonProps) {
  const t = useT();
  const locked = busy || disabled;
  const label = busy ? t("owner.notifications.accepting") : t("owner.notifications.accept");

  return (
    <button
      type="button"
      className="btn-primary hall-accept-btn min-h-11 gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)] disabled:pointer-events-none disabled:translate-y-0 disabled:shadow-none disabled:opacity-60"
      data-testid={`hall-notification-accept-${bookingId}`}
      data-state={busy ? "loading" : locked ? "disabled" : "default"}
      disabled={locked}
      aria-busy={busy || undefined}
      aria-disabled={locked || undefined}
      aria-label={label}
      aria-describedby={describedBy}
      onClick={() => {
        if (locked) return;
        onClick();
      }}
    >
      {busy ? <Spinner /> : null}
      {label}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
