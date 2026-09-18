"use client";

import { useT } from "@/i18n";

type PublishActionButtonProps = {
  bookingId: string;
  hallId: string;
  busy?: boolean;
  disabled?: boolean;
  describedBy?: string;
  onClick: () => void;
};

export default function PublishActionButton({
  bookingId,
  hallId,
  busy = false,
  disabled = false,
  describedBy,
  onClick,
}: PublishActionButtonProps) {
  const t = useT();
  const locked = busy || disabled;
  const label = busy ? t("owner.schedule.publishing") : t("owner.schedule.publish");

  return (
    <button
      type="button"
      className="btn-primary hall-publish-btn min-h-11 gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)] disabled:pointer-events-none disabled:translate-y-0 disabled:shadow-none disabled:opacity-60"
      data-testid={`hall-schedule-publish-${bookingId}`}
      data-hall-id={hallId}
      data-booking-id={bookingId}
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
