"use client";

import { useT } from "@/i18n";

type HallLockedBadgeProps = {
  variant?: "public" | "owner";
  className?: string;
};

export default function HallLockedBadge({
  variant = "public",
  className = "",
}: HallLockedBadgeProps) {
  const t = useT();
  const label =
    variant === "owner"
      ? t("hall.locked.badge.owner")
      : t("hall.locked.badge.public");

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-[#c62828] px-2 py-0.5 text-[0.68rem] font-semibold text-white ${className}`.trim()}
      data-testid="hall-locked-badge"
      data-variant={variant}
    >
      <LockIcon />
      {label}
    </span>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden="true">
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
