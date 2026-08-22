"use client";

import type { ReactNode } from "react";
import { useAiAssistantControls } from "@/components/assistant/AiAssistantProvider";

type AiAssistantTriggerProps = {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
};

/** Opens the global assistant from anywhere (empty states, help links, CTAs). */
export default function AiAssistantTrigger({
  children,
  className,
  ariaLabel,
}: AiAssistantTriggerProps) {
  const { openAssistant } = useAiAssistantControls();

  return (
    <button
      type="button"
      onClick={openAssistant}
      aria-label={ariaLabel}
      className={className}
      data-testid="ai-assistant-trigger"
    >
      {children}
    </button>
  );
}
