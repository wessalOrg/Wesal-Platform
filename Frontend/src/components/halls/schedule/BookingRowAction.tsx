"use client";

import type { ReactNode } from "react";
import "@/components/halls/schedule/owner-deletion.css";

type BookingRowActionProps = {
  children: ReactNode;
  busy?: boolean;
  className?: string;
};

export default function BookingRowAction({
  children,
  busy = false,
  className = "",
}: BookingRowActionProps) {
  return (
    <div
      className={`booking-row-actions ${className}`.trim()}
      data-testid="booking-row-actions"
      aria-busy={busy || undefined}
    >
      {children}
    </div>
  );
}
