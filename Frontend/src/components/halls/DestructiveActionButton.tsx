"use client";

import { useT } from "@/i18n";
import "@/components/halls/hall-deletion.css";

export type DestructiveActionButtonProps = {
  hallId: string;
  busy?: boolean;
  disabled?: boolean;
  describedBy?: string;
  expanded?: boolean;
  onClick: () => void;
};

export default function DestructiveActionButton({
  hallId,
  busy = false,
  disabled = false,
  describedBy,
  expanded = false,
  onClick,
}: DestructiveActionButtonProps) {
  const t = useT();
  const locked = busy || disabled;
  const label = busy ? t("owner.hall.deleting") : t("owner.hall.delete");

  return (
    <button
      type="button"
      className="btn-outline hall-destructive-btn min-h-11 w-full gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800 disabled:pointer-events-none disabled:translate-y-0 disabled:shadow-none"
      data-testid="hall-delete-trigger"
      data-hall-id={hallId}
      data-state={busy ? "loading" : locked ? "disabled" : "default"}
      disabled={locked}
      aria-busy={busy || undefined}
      aria-disabled={locked || undefined}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-label={label}
      aria-describedby={describedBy}
      onClick={() => {
        if (locked) return;
        onClick();
      }}
    >
      {busy ? <Spinner /> : <TrashIcon />}
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

function TrashIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16" />
      <path d="M9 7V5.4A1.4 1.4 0 0 1 10.4 4h3.2A1.4 1.4 0 0 1 15 5.4V7" />
      <path d="M6.4 7l.8 12.2A1.6 1.6 0 0 0 8.8 21h6.4a1.6 1.6 0 0 0 1.6-1.8L17.6 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
