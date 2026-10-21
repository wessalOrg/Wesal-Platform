"use client";

import { useT } from "@/i18n";

type RejectActionButtonProps = {
  bookingId: string;
  busy?: boolean;
  disabled?: boolean;
  describedBy?: string;
  onClick: () => void;
};

export default function RejectActionButton({
  bookingId,
  busy = false,
  disabled = false,
  describedBy,
  onClick,
}: RejectActionButtonProps) {
  const t = useT();
  const locked = busy || disabled;
  const label = busy
    ? t("owner.notifications.rejecting")
    : t("owner.notifications.rejectShort");

  return (
    <button
      type="button"
      className="hall-reject-btn inline-flex w-fit items-center justify-center gap-1 rounded-md border border-[#c0392b] bg-white px-2.5 py-1.5 text-[0.72rem] font-bold leading-none text-[#c0392b] transition hover:bg-[#fdecea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c0392b] disabled:pointer-events-none disabled:opacity-60"
      data-testid={`hall-notification-reject-${bookingId}`}
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
      {busy ? <Spinner /> : <CloseIcon />}
      {label}
    </button>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M7 7l10 10M17 7 7 17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
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
