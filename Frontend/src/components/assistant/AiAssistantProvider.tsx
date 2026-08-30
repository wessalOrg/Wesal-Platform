"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import AiAssistantFab from "@/components/assistant/AiAssistantFab";
import AiAssistantInvitation from "@/components/assistant/AiAssistantInvitation";
import AiAssistantPanel from "@/components/assistant/AiAssistantPanel";
import { useAiAssistant, type AiAssistantControls } from "@/hooks/useAiAssistant";
import { useAiInvitation } from "@/hooks/useAiInvitation";
import { useDraggableFab } from "@/hooks/useDraggableFab";
import "@/components/assistant/ai-assistant.css";

const PANEL_ID = "wesal-ai-assistant-panel";

const IDLE_CONTROLS: AiAssistantControls = {
  isOpen: false,
  phase: "idle",
  session: null,
  errorKey: null,
  unavailableReason: null,
  isRetrying: false,
  openAssistant: () => undefined,
  closeAssistant: () => undefined,
  toggleAssistant: () => undefined,
  retry: () => undefined,
};

const AiAssistantContext = createContext<AiAssistantControls | null>(null);

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
  isOpenRef.current = isOpen;
  const drag = useDraggableFab(toggleAssistant, fabRef);
  const {
    isVisible: invitationVisible,
    messageKey: invitationMessage,
    handleShown: onInvitationShown,
    handleExpired: onInvitationExpired,
    dismiss: dismissInvitation,
    accept: acceptInvitation,
  } = useAiInvitation({
    isOpen,
    isDragging: drag.isDragging,
    anchorRef: fabRef,
  });

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

  const handleClose = useCallback(() => {
    closeAssistant();
    fabRef.current?.focus();
  }, [closeAssistant]);

  const handleInvitationOpen = useCallback(() => {
    acceptInvitation();
    openAssistant();
  }, [acceptInvitation, openAssistant]);

  return (
    <AiAssistantContext.Provider value={controls}>
      {children}
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
      {/*
        Gated here as well as in the hook so the bubble leaves the screen the
        instant the panel opens or a drag starts, with no frame of overlap.
      */}
      {invitationVisible && !isOpen && !drag.isDragging ? (
        <AiAssistantInvitation
          anchorRef={fabRef}
          messageKey={invitationMessage}
          onOpen={handleInvitationOpen}
          onDismiss={dismissInvitation}
          onShown={onInvitationShown}
          onExpired={onInvitationExpired}
        />
      ) : null}
    </AiAssistantContext.Provider>
  );
}

/** Lets any component open the assistant; falls back to a no-op outside the provider. */
export function useAiAssistantControls(): AiAssistantControls {
  return useContext(AiAssistantContext) ?? IDLE_CONTROLS;
}
