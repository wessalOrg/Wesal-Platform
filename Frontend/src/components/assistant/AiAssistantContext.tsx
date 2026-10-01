"use client";

import { createContext, useContext } from "react";
import type { AiAssistantControls } from "@/hooks/useAiAssistant";
import type { AiChatControls } from "@/hooks/useAiChat";
import type { AiPinnedHall } from "@/types/ai-assistant";
import type { AiNavigateAction } from "@/types/ai-chat";

/** What another part of the app may ask Mabrouk to pin ("ask about this hall"). */
export type AiHallContextInput = {
  id: string;
  name?: string | null;
};

export type AiAssistantLauncher = {
  /** Opens Mabrouk without changing the pinned context. */
  open: () => void;
  /**
   * Opens Mabrouk and pins a hall as the conversation's subject. A previously pinned
   * hall is REPLACED (never mixed). Does not send a message or call the model: the
   * user's next question simply uses the pinned hall.
   */
  openWithContext: (hall: AiHallContextInput) => void;
  /** Removes the pinned hall. */
  clearPinnedContext: () => void;
  /** The currently pinned hall, if any. */
  pinned: AiPinnedHall | null;
  /** True while the assistant session is still starting. */
  isStarting: boolean;
};

/** Internal wiring consumed by the panel and message bubbles. */
export type AiAssistantInternals = {
  controls: AiAssistantControls;
  chat: AiChatControls;
  launcher: AiAssistantLauncher;
  /** Increments whenever the composer should take focus (for example after pinning). */
  focusToken: number;
  /** Follows a validated navigation action with the Next router. */
  followAction: (action: AiNavigateAction) => void;
};

const noopLauncher: AiAssistantLauncher = {
  open: () => undefined,
  openWithContext: () => undefined,
  clearPinnedContext: () => undefined,
  pinned: null,
  isStarting: false,
};

export const AiAssistantLauncherContext = createContext<AiAssistantLauncher>(noopLauncher);
export const AiAssistantInternalsContext = createContext<AiAssistantInternals | null>(null);

/**
 * Public API for opening Mabrouk from anywhere under the root layout, e.g. the
 * "Ask Mabrouk about this hall" button. Outside the provider it is a harmless no-op.
 */
export function useAiAssistantLauncher(): AiAssistantLauncher {
  return useContext(AiAssistantLauncherContext);
}

export function useAiAssistantInternals(): AiAssistantInternals | null {
  return useContext(AiAssistantInternalsContext);
}
