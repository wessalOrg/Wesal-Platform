"use client";

import type { ReactNode } from "react";
import type { DeletionVisualState } from "@/lib/owner-deletion-ui";
import "@/components/halls/schedule/owner-deletion.css";

type DeletingStateWrapperProps = {
  state?: DeletionVisualState;
  children: ReactNode;
  className?: string;
};

export default function DeletingStateWrapper({
  state = "idle",
  children,
  className = "",
}: DeletingStateWrapperProps) {
  const busy = state === "deleting" || state === "exiting";

  return (
    <div
      className={`owner-deletion-wrap relative min-w-0 ${stateClass(state)} ${className}`.trim()}
      data-testid="deleting-state-wrapper"
      data-deletion-state={state}
      aria-busy={busy || undefined}
      aria-disabled={state === "conflict" || state === "exiting" ? true : undefined}
    >
      {children}
      {state === "deleting" ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl bg-white/45"
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

function stateClass(state: DeletionVisualState): string {
  if (state === "deleting") return "owner-card-deleting";
  if (state === "exiting") return "owner-card-exiting";
  if (state === "conflict") return "owner-card-conflict";
  if (state === "failed") return "owner-card-failed";
  return "";
}
