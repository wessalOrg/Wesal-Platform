"use client";

import type { ReactNode } from "react";
import { useT } from "@/i18n";
import type { HallDeletionVisualState } from "@/lib/owner-hall-deletion-ui";
import "@/components/halls/hall-deletion.css";

type HallDeletionStateWrapperProps = {
  state?: HallDeletionVisualState;
  children: ReactNode;
  className?: string;
};

export default function HallDeletionStateWrapper({
  state = "idle",
  children,
  className = "",
}: HallDeletionStateWrapperProps) {
  const t = useT();
  const busy = state === "deleting" || state === "exiting";

  return (
    <div
      className={`hall-delete-wrap relative min-w-0 ${stateClass(state)} ${className}`.trim()}
      data-testid="hall-deletion-state"
      data-deletion-state={state}
      aria-busy={busy || undefined}
      aria-disabled={
        state === "blocked" || state === "unavailable" || state === "exiting" ? true : undefined
      }
    >
      {children}
      {state === "deleting" ? (
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-white/40" aria-hidden="true" />
      ) : null}
      {state === "exiting" ? (
        <p className="sr-only" role="status" aria-live="polite">
          {t("owner.hall.deletedLive")}
        </p>
      ) : null}
    </div>
  );
}

function stateClass(state: HallDeletionVisualState): string {
  if (state === "deleting") return "hall-delete-deleting";
  if (state === "exiting") return "hall-delete-exiting";
  if (state === "blocked") return "hall-delete-blocked";
  if (state === "unavailable") return "hall-delete-unavailable";
  if (state === "failed") return "hall-delete-failed";
  return "hall-delete-idle";
}
