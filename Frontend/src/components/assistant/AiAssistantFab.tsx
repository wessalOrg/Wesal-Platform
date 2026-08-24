"use client";

import {
  memo,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import AiAssistantSparkIcon from "@/components/assistant/AiAssistantSparkIcon";
import { useT } from "@/i18n";
import type { AiAssistantPhase } from "@/types/ai-assistant";

type AiAssistantFabProps = {
  open: boolean;
  phase: AiAssistantPhase;
  panelId: string;
  onClick: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  /** Drag position from `useDraggableFab`; absent while the button sits in its corner. */
  style?: CSSProperties;
  isDragging?: boolean;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLElement>) => void;
};

const STATUS_DOT_CLASS: Record<AiAssistantPhase, string> = {
  idle: "bg-[#3f9d6d]",
  loading: "bg-[var(--wesal-gold)]",
  active: "bg-[#3f9d6d]",
  error: "bg-[var(--wesal-muted)]",
  unavailable: "bg-[var(--wesal-muted)]",
};

/**
 * Presentation only — every decision about sessions lives in `useAiAssistant`.
 *
 * The z-index sits above the hall details overlay (100) so the assistant is
 * reachable on every page as US-AI-01 requires, and below the booking sheet (110)
 * and the photo lightbox (120) so it never floats over a real dialog.
 */
function AiAssistantFab({
  open,
  phase,
  panelId,
  onClick,
  buttonRef,
  style,
  isDragging = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: AiAssistantFabProps) {
  const t = useT();
  const label = open ? t("assistant.fab.close") : t("assistant.fab.open");

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={style}
      aria-label={label}
      aria-expanded={open}
      // The panel leaves the DOM when it closes, and a reference to a missing id is
      // not a relationship any assistive technology can follow; `aria-expanded`
      // carries the state on its own.
      aria-controls={open ? panelId : undefined}
      aria-busy={phase === "loading"}
      title={label}
      data-testid="ai-assistant-fab"
      data-dragging={isDragging ? "true" : undefined}
      className={`wesal-ai-fab fixed bottom-5 end-5 z-[105] flex h-14 w-14 touch-none items-center justify-center rounded-full text-white outline-none focus-visible:ring-4 focus-visible:ring-[rgba(193,123,127,0.45)] sm:bottom-6 sm:end-6${
        isDragging ? " wesal-ai-fab-dragging" : ""
      }`}
    >
      <span className="wesal-ai-fab-halo" aria-hidden="true" />
      {open ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="relative h-6 w-6"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      ) : (
        <AiAssistantSparkIcon className="wesal-ai-fab-spark relative h-7 w-7" />
      )}
      <span
        aria-hidden="true"
        className={`absolute top-1 end-1 h-3 w-3 rounded-full border-2 border-white ${STATUS_DOT_CLASS[phase]}`}
      />
    </button>
  );
}

export default memo(AiAssistantFab);
