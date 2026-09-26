"use client";

import { formatUnreadCount } from "@/lib/unread-badge";

type UnreadBadgeProps = {
  count: number;
  /** Accessible name, e.g. "3 unread messages". */
  label?: string;
  className?: string;
  "data-testid"?: string;
};

/**
 * Presentational unread counter.
 * Hides at 0; shows the number for 1–99; shows 99+ above that.
 */
export default function UnreadBadge({
  count,
  label,
  className = "",
  "data-testid": testId = "unread-badge",
}: UnreadBadgeProps) {
  const display = formatUnreadCount(count);
  if (!display) return null;

  return (
    <span
      className={`inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#c45b55] px-1.5 text-[0.65rem] font-bold leading-none text-white tabular-nums ${className}`.trim()}
      aria-label={label}
      data-testid={testId}
    >
      <span aria-hidden="true">{display}</span>
    </span>
  );
}
