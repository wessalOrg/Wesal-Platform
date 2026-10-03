"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import AiAssistantFab from "@/components/assistant/AiAssistantFab";
import {
  AiAssistantInternalsContext,
  AiAssistantLauncherContext,
  type AiAssistantInternals,
  type AiAssistantLauncher,
  type AiHallContextInput,
} from "@/components/assistant/AiAssistantContext";
import { useLanguage } from "@/components/layout/LanguageProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAiAssistant } from "@/hooks/useAiAssistant";
import { useAiChat } from "@/hooks/useAiChat";
import { useDraggableFab } from "@/hooks/useDraggableFab";
import { useT } from "@/i18n";
import {
  clearChatSnapshot,
  readChatSnapshotForOwner,
  writeChatSnapshot,
} from "@/lib/ai-chat-storage";
import { getStoredAuth } from "@/lib/auth-storage";
import {
  buildAssistantPageContext,
  isValidHallId,
  sanitizeAssistantHref,
} from "@/lib/wesal-routes";
import type { AiPinnedHall } from "@/types/ai-assistant";
import type { AiNavigateAction } from "@/types/ai-chat";
import { OPEN_ASSISTANT_EVENT } from "@/lib/assistant-events";
import "@/components/assistant/ai-assistant.css";

const AiAssistantPanel = dynamic(() => import("@/components/assistant/AiAssistantPanel"), {
  ssr: false,
});

const PANEL_ID = "wesal-ai-assistant-panel";
/** Brief pause so an auto-navigation message is readable before the page changes. */
const AUTO_NAVIGATE_DELAY_MS = 450;
const PERSIST_DEBOUNCE_MS = 250;

/** Guards against a second provider being nested somewhere below the root layout. */
let mountedProviders = 0;

/**
 * Mounted once in the root layout so the button, its session, the conversation and the
 * pinned context stay alive across client-side navigation AND across the panel being
 * closed: the thread lives here, not inside the (unmountable) panel. `children` is a
 * stable element, so assistant state changes never re-render the page tree.
 */
export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const { session, status } = useAuth();
  const storedUserId = session.isAuthenticated ? getStoredAuth()?.user.id ?? null : null;
  const ownerKey = status !== "ready"
    ? "auth-loading"
    : session.isAuthenticated
      ? `user:${storedUserId ?? "unknown"}`
      : "guest";
  const previousOwnerRef = useRef<string | null>(null);

  useEffect(() => {
    const nextOwner = status !== "ready" || !session.isAuthenticated ? null : storedUserId;
    const previousOwner = previousOwnerRef.current;
    if (previousOwner && previousOwner !== nextOwner) clearChatSnapshot(previousOwner);
    previousOwnerRef.current = nextOwner;
  }, [status, session.isAuthenticated, storedUserId]);

  return (
    <AssistantRuntime
      key={ownerKey}
      ownerId={status === "ready" && session.isAuthenticated ? storedUserId : null}
      storageReady={status === "ready" && (!session.isAuthenticated || Boolean(storedUserId))}
    >
      {children}
    </AssistantRuntime>
  );
}

function AssistantRuntime({
  children,
  ownerId,
  storageReady,
}: {
  children: ReactNode;
  ownerId: string | null;
  storageReady: boolean;
}) {
  const controls = useAiAssistant();
  const { lang, status: langStatus } = useLanguage();
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const {
    isOpen,
    phase,
    session,
    errorKey,
    unavailableReason,
    isRetrying,
    closeAssistant,
    toggleAssistant,
    openAssistant,
    retry,
  } = controls;

  // Lazily restored from this tab's stored snapshot (it only feeds the panel chip, never
  // server-rendered markup, so there is no hydration mismatch).
  const [pinned, setPinned] = useState<AiPinnedHall | null>(
    () => storageReady ? readChatSnapshotForOwner(undefined, ownerId)?.pinned ?? null : null,
  );
  const [focusToken, setFocusToken] = useState(0);

  const pathnameRef = useRef(pathname);
  const pinnedRef = useRef<AiPinnedHall | null>(null);
  const hydratedRef = useRef(false);
  const handledAutoRef = useRef<Set<string>>(new Set());
  const navigatingToRef = useRef<string | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
    pinnedRef.current = pinned;
  });

  const sessionReady = phase === "active" && Boolean(session?.sessionId);

  const getContext = useCallback(
    () => ({
      page: buildAssistantPageContext(pathnameRef.current),
      pinned: pinnedRef.current,
    }),
    [],
  );

  const chat = useAiChat({
    sessionId: sessionReady && session ? session.sessionId : null,
    greeting: t("assistant.greeting"),
    getContext,
    renewSession: controls.renewSession,
    onTurnSuccess: controls.touchSession,
  });

  const fabRef = useRef<HTMLButtonElement>(null);
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

  // ── restore the thread / pinned hall / session id for this browser tab ──
  const { hydrate } = chat;
  const { restoreSession } = controls;
  useEffect(() => {
    // Wait for the stored UI language to be applied: a language flip right after mount
    // would otherwise reset the thread we are about to restore.
    if (hydratedRef.current || langStatus !== "ready") return;
    hydratedRef.current = true;
    if (!storageReady) return;
    const snapshot = readChatSnapshotForOwner(lang, ownerId);
    if (!snapshot) return;
    hydrate(snapshot.messages);
    if (snapshot.sessionId) restoreSession(snapshot.sessionId, snapshot.savedAt);
  }, [lang, langStatus, hydrate, restoreSession, ownerId, storageReady]);

  // ── persist (debounced, bounded, no secrets) ──
  const messages = chat.messages;
  const sessionId = session?.sessionId ?? null;
  useEffect(() => {
    if (!hydratedRef.current || !storageReady) return;
    const hasConversation = messages.some((message) => message.id !== "greeting");
    if (!hasConversation && !pinned) return;

    const timer = window.setTimeout(() => {
      writeChatSnapshot({ lang, sessionId, messages, pinned }, ownerId);
    }, PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [messages, pinned, sessionId, lang, ownerId, storageReady]);

  // ── navigation actions (Mabrouk never owns routing; it asks, the router follows) ──
  const followAction = useCallback(
    (action: AiNavigateAction) => {
      const href = sanitizeAssistantHref(action.href);
      if (!href) return;
      if (href === pathnameRef.current || navigatingToRef.current === href) return;
      navigatingToRef.current = href;
      router.push(href);
    },
    [router],
  );

  // The navigation finished (or was a no-op): allow the same destination again later.
  useEffect(() => {
    navigatingToRef.current = null;
  }, [pathname]);

  // Auto-navigation: exactly once per assistant message, only for `mode: "auto"`.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || last.actions.length === 0) return;
    if (handledAutoRef.current.has(last.id)) return;

    const auto = last.actions.find((action) => action.mode === "auto");
    if (!auto) return;
    handledAutoRef.current.add(last.id);

    const timer = window.setTimeout(() => followAction(auto), AUTO_NAVIGATE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [messages, followAction]);

  // ── launcher API ──
  const openWithContext = useCallback(
    (hall: AiHallContextInput) => {
      const id = typeof hall.id === "string" ? hall.id.trim() : "";
      if (!isValidHallId(id)) {
        openAssistant();
        return;
      }
      // A newly pinned hall REPLACES the old one — never mixed.
      setPinned({ type: "hall", id, name: hall.name?.trim() || null });
      setFocusToken((value) => value + 1);
      openAssistant();
    },
    [openAssistant],
  );

  const clearPinnedContext = useCallback(() => {
    setPinned(null);
    clearChatSnapshot(ownerId);
  }, [ownerId]);

  const launcher = useMemo<AiAssistantLauncher>(
    () => ({
      open: () => {
        setFocusToken((value) => value + 1);
        openAssistant();
      },
      openWithContext,
      clearPinnedContext,
      pinned,
      isStarting: phase === "loading",
    }),
    [openAssistant, openWithContext, clearPinnedContext, pinned, phase],
  );

  const internals = useMemo<AiAssistantInternals>(
    () => ({ controls, chat, launcher, focusToken, followAction }),
    [controls, chat, launcher, focusToken, followAction],
  );

  useEffect(() => {
    const onOpen = () => {
      if (!isOpen) openAssistant();
    };
    window.addEventListener(OPEN_ASSISTANT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, onOpen);
  }, [isOpen, openAssistant]);

  const handleClose = useCallback(() => {
    closeAssistant();
    fabRef.current?.focus();
  }, [closeAssistant]);

  return (
    <AiAssistantLauncherContext.Provider value={launcher}>
      <AiAssistantInternalsContext.Provider value={internals}>
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
      </AiAssistantInternalsContext.Provider>
    </AiAssistantLauncherContext.Provider>
  );
}
