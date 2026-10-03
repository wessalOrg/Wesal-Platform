"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import AiAssistantFab from "@/components/assistant/AiAssistantFab";
import { useAiAssistant } from "@/hooks/useAiAssistant";
import { useDraggableFab } from "@/hooks/useDraggableFab";
import { OPEN_ASSISTANT_EVENT } from "@/lib/assistant-events";
import "@/components/assistant/ai-assistant.css";

const AiAssistantPanel = dynamic(() => import("@/components/assistant/AiAssistantPanel"), {
  ssr: false,
});

const PANEL_ID = "wesal-ai-assistant-panel";

/** Guards against a second provider being nested somewhere below the root layout. */
let mountedProviders = 0;

/**
 * Mounted once in the root layout so the button, its session and any failure state
 * stay alive across client-side navigation. `children` is a stable element, so
 * assistant state changes never re-render the page tree.
 */
export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const controls = useAiAssistant();
  const {
    isOpen,
    phase,
    session,
    errorKey,
    unavailableReason,
    isRetrying,
    openAssistant,
    closeAssistant,
    toggleAssistant,
    retry,
  } = controls;
  const pathname = usePathname();
  const fabRef = useRef<HTMLButtonElement>(null);
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
  });
  const drag = useDraggableFab(toggleAssistant, fabRef);

  useEffect(() => {
    mountedProviders += 1;
    if (process.env.NODE_ENV !== "production" && mountedProviders > 1) {
      console.warn(
        "[Wesal] AiAssistantProvider is mounted more than once. Keep it only in the root layout, otherwise duplicate floating buttons and sessions will overlap.",
      );
    }

    return () => {
      mountedProviders -= 1;
    };
  }, []);

  useEffect(() => {
    if (!isOpenRef.current) return;
    closeAssistant();
  }, [pathname, closeAssistant]);

  useEffect(() => {
    const onOpen = () => {
      if (!isOpenRef.current) openAssistant();
    };
    window.addEventListener(OPEN_ASSISTANT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, onOpen);
  }, [openAssistant]);

  const handleClose = useCallback(() => {
    closeAssistant();
    fabRef.current?.focus();
  }, [closeAssistant]);

  return (
    <>
      {children}
      {isOpen ? (
        <AiAssistantPanel
          open={isOpen}
          id={PANEL_ID}
          phase={phase}
          session={session}
          errorKey={errorKey}
          unavailableReason={unavailableReason}
          isRetrying={isRetrying}
          anchorRef={fabRef}
          onClose={handleClose}
          onRetry={retry}
          onBrowseHalls={closeAssistant}
        />
      ) : null}
      <AiAssistantFab
        open={isOpen}
        phase={phase}
        panelId={PANEL_ID}
        onClick={drag.handleClick}
        buttonRef={fabRef}
        style={drag.style}
        isDragging={drag.isDragging}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
      />
    </>
  );
}
