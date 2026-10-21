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
  const label = busy
    ? t("owner.notifications.accepting")
    : t("owner.notifications.acceptShort");

  return (
    <button
      type="button"
      className="hall-accept-btn inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#1f8a4c] bg-[#1f8a4c] px-4 text-sm font-bold text-white transition hover:bg-[#197a42] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f8a4c] disabled:pointer-events-none disabled:opacity-60"
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
      {busy ? <Spinner /> : <CheckIcon />}
      {label}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M5.5 12.5 10 17l8.5-9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
