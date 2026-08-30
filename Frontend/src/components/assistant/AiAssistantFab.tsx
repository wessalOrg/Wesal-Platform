"use client";

import {
  memo,
  useEffect,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import AiAssistantAvatar from "@/components/assistant/AiAssistantAvatar";
import AiAssistantSparkIcon from "@/components/assistant/AiAssistantSparkIcon";
import { useT } from "@/i18n";
import type { AiAssistantPhase } from "@/types/ai-assistant";

type AiAssistantFabProps = {
  open: boolean;
  phase: AiAssistantPhase;
  panelId: string;
  onClick: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  style?: CSSProperties;
  isDragging?: boolean;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLElement>) => void;
};

const GREET_KEYS = [
  "assistant.fab.greet1",
  "assistant.fab.greet2",
  "assistant.fab.greet3",
] as const;

const GREET_CYCLE_MS = 4200;

const STATUS_DOT_CLASS: Record<AiAssistantPhase, string> = {
  idle: "bg-[#3f9d6d]",
  loading: "bg-[var(--wesal-gold)]",
  active: "bg-[#3f9d6d]",
  error: "bg-[var(--wesal-muted)]",
  unavailable: "bg-[var(--wesal-muted)]",
};

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
  const [greetIndex, setGreetIndex] = useState(0);

  useEffect(() => {
    if (open) return;
    const timer = window.setInterval(() => {
      setGreetIndex((current) => (current + 1) % GREET_KEYS.length);
    }, GREET_CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [open]);

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
      aria-controls={open ? panelId : undefined}
      aria-busy={phase === "loading"}
      title={label}
      data-testid="ai-assistant-fab"
      data-open={open ? "true" : undefined}
      data-dragging={isDragging ? "true" : undefined}
      className={`wesal-ai-fab wesal-ai-fab--figure fixed bottom-2 end-3 z-[105] flex h-[10.75rem] w-[6.5rem] touch-none flex-col items-center justify-end outline-none focus-visible:ring-4 focus-visible:ring-[rgba(193,123,127,0.35)] sm:bottom-3 sm:end-4 sm:h-[13.5rem] sm:w-[8rem]${
        isDragging ? " wesal-ai-fab-dragging" : ""
      }`}
    >
      <span className="wesal-ai-fab-aura" aria-hidden="true" />
      <span className="wesal-ai-fab-ring" aria-hidden="true" />
      <span className="wesal-ai-fab-tab" aria-hidden="true" key={greetIndex}>
        {t(GREET_KEYS[greetIndex])}
      </span>
      <span className="relative z-[1] flex h-full w-full items-end justify-center">
        <AiAssistantAvatar pose="full" />
        <span className="wesal-ai-fab-scan" aria-hidden="true" />
        <span className="wesal-ai-fab-orbit" aria-hidden="true">
          <span className="wesal-ai-fab-orbit-item" style={{ animationDelay: "0s" }}>
            <AiAssistantSparkIcon className="wesal-ai-fab-sparkle" />
          </span>
          <span className="wesal-ai-fab-orbit-item" style={{ animationDelay: "-3.4s" }}>
            <AiAssistantSparkIcon className="wesal-ai-fab-sparkle" />
          </span>
          <span className="wesal-ai-fab-orbit-item" style={{ animationDelay: "-6.8s" }}>
            <AiAssistantSparkIcon className="wesal-ai-fab-sparkle" />
          </span>
        </span>
        <span className="wesal-ai-fab-motes" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        {open ? (
          <span className="absolute start-1/2 top-1 z-[2] flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-white shadow-md">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className={`absolute z-[2] top-2 end-1 h-3.5 w-3.5 rounded-full border-2 border-white ${STATUS_DOT_CLASS[phase]}`}
      />
    </button>
  );
}

export default memo(AiAssistantFab);
