"use client";

import {
  useEffect,
  useRef,
  useState,
  type AnimationEvent as ReactAnimationEvent,
} from "react";
import AiAssistantSparkIcon from "@/components/assistant/AiAssistantSparkIcon";
import AiAssistantUnavailableNotice from "@/components/assistant/AiAssistantUnavailableNotice";
import AiChatComposer from "@/components/assistant/AiChatComposer";
import AiChatErrorBoundary from "@/components/assistant/AiChatErrorBoundary";
import AiChatShell from "@/components/assistant/AiChatShell";
import AiChatThread from "@/components/assistant/AiChatThread";
import { useAiChat } from "@/hooks/useAiChat";
import { useT } from "@/i18n";
import type {
  AiAssistantPhase,
  AiSession,
  AiUnavailableReason,
} from "@/types/ai-assistant";

type AiAssistantPanelProps = {
  open: boolean;
  id: string;
  phase: AiAssistantPhase;
  session: AiSession | null;
  errorKey: string | null;
  unavailableReason: AiUnavailableReason | null;
  isRetrying: boolean;
  onClose: () => void;
  onRetry: () => void;
  onBrowseHalls: () => void;
};

/**
 * Longer than the exit animation in `ai-assistant.css`, and used only if that
 * animation never reports itself finished — a skipped frame budget, a background
 * tab, or a browser that drops `animationend`. The panel is then removed anyway,
 * so a dismissal can never hang half-open.
 */
const PANEL_EXIT_FALLBACK_MS = 320;

type PanelMotion = "closed" | "in" | "open" | "out";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Devices that have asked us not to animate, or that will not finish a compositor
 * animation honestly. Opening and closing still work; they just snap.
 */
function canPlayPanelMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (prefersReducedMotion()) return false;

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  if (nav.connection?.saveData) return false;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 1) return false;
  return true;
}

function nextMotion(open: boolean, current: PanelMotion): PanelMotion {
  if (open) {
    if (current === "in" || current === "open") return current;
    return canPlayPanelMotion() ? "in" : "open";
  }
  if (current === "closed" || current === "out") return current;
  return canPlayPanelMotion() ? "out" : "closed";
}

const STATUS_KEY: Record<AiAssistantPhase, string> = {
  idle: "assistant.status.online",
  loading: "assistant.status.connecting",
  active: "assistant.status.online",
  error: "assistant.status.offline",
  unavailable: "assistant.status.offline",
};

/** Presentation only — session lifecycle lives in `useAiAssistant`. */
export default function AiAssistantPanel({
  open,
  id,
  phase,
  session,
  errorKey,
  unavailableReason,
  isRetrying,
  onClose,
  onRetry,
  onBrowseHalls,
}: AiAssistantPanelProps) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const failed = phase === "error" || phase === "unavailable";
  // Keep the failure on screen while retrying instead of flashing back to a spinner.
  const showFailure = failed || (isRetrying && errorKey !== null);
  const sessionReady = phase === "active" && Boolean(session?.sessionId);
  const chat = useAiChat({
    sessionId: sessionReady && session ? session.sessionId : null,
    greeting: t("assistant.greeting"),
  });

  /**
   * `open` is still Lillian's source of truth. This only chooses how the panel
   * *looks* on the way in and out. Updating it during render (not in an effect)
   * lets React discard the intermediate tree before paint, so there is never a
   * frame where the panel has vanished and the exit motion has not started.
   */
  const [motion, setMotion] = useState<PanelMotion>(() => (open ? "open" : "closed"));
  const next = nextMotion(open, motion);
  if (next !== motion) setMotion(next);

  const isExiting = motion === "out";
  const isVisible = motion !== "closed";

  useEffect(() => {
    if (motion !== "in") return;
    const timer = window.setTimeout(() => setMotion("open"), PANEL_EXIT_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [motion]);

  useEffect(() => {
    if (!isExiting) return;

    const node = panelRef.current;
    const timer = window.setTimeout(() => setMotion("closed"), PANEL_EXIT_FALLBACK_MS);

    // After paint: if the stylesheet never attached an exit animation (reduced
    // motion, a dropped compositor, an older engine), snap closed immediately.
    let frame2 = 0;
    const frame1 = window.requestAnimationFrame(() => {
      frame2 = window.requestAnimationFrame(() => {
        const name = node ? getComputedStyle(node).animationName : "none";
        if (!name || name === "none") setMotion("closed");
      });
    });

    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame1);
      window.cancelAnimationFrame(frame2);
    };
  }, [isExiting]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const snap = () => {
      if (!media.matches) return;
      setMotion((current) => {
        if (current === "in") return "open";
        if (current === "out") return "closed";
        return current;
      });
    };

    media.addEventListener("change", snap);
    return () => media.removeEventListener("change", snap);
  }, []);

  const handleAnimationEnd = (event: ReactAnimationEvent<HTMLDivElement>) => {
    // The typing dots and the retry spinner bubble their own animation events.
    if (event.target !== event.currentTarget) return;
    const name = event.animationName;
    if (name.includes("panel-out")) setMotion("closed");
    else if (name.includes("panel-in")) setMotion("open");
  };

  useEffect(() => {
    if (!open) return;

    panelRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!isVisible) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      data-testid="ai-assistant-panel"
      data-motion={motion === "in" || motion === "out" ? motion : "open"}
      // On its way out it is no longer part of the page: not focusable, not clickable
      // and not announced, so the animation cannot get between the user and the app.
      inert={isExiting}
      onAnimationEnd={handleAnimationEnd}
      className="wesal-ai-panel fixed inset-x-3 bottom-[5.75rem] z-[105] flex max-h-[min(70svh,32rem)] min-w-0 flex-col overflow-hidden rounded-3xl border border-[var(--wesal-border)] bg-white shadow-[0_24px_60px_rgba(60,35,30,0.22)] outline-none sm:inset-x-auto sm:bottom-[6.5rem] sm:end-6 sm:w-[22rem] md:w-[24rem] lg:w-[26rem] lg:max-h-[min(78svh,38rem)]"
    >
      <div className="wesal-ai-panel-header flex shrink-0 items-center gap-3 px-4 py-3.5">
        <span className="wesal-ai-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white">
          <AiAssistantSparkIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id={`${id}-title`}
            className="truncate text-sm font-bold text-[var(--wesal-text)]"
          >
            {t("assistant.title")}
          </h2>
          <p
            className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] text-[var(--wesal-muted)]"
            aria-live="polite"
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${
                failed
                  ? "bg-[var(--wesal-muted)]"
                  : phase === "loading"
                    ? "bg-[var(--wesal-gold)]"
                    : "bg-[#3f9d6d]"
              }`}
            />
            {t(STATUS_KEY[phase])}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          data-testid="ai-assistant-close"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--wesal-text)] transition hover:bg-white/70"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <AiChatErrorBoundary>
        {showFailure ? (
          <div className="wesal-ai-panel-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <AiAssistantUnavailableNotice
              reason={unavailableReason}
              messageKey={errorKey}
              isRetrying={isRetrying}
              onRetry={onRetry}
              onBrowseHalls={onBrowseHalls}
            />
          </div>
        ) : phase === "loading" && !sessionReady ? (
          <AiChatShell
            surface="loading"
            canRetry={false}
            isRetrying={false}
            onRetry={() => undefined}
          />
        ) : (
          <AiChatShell
            surface={chat.surface}
            canRetry={chat.canRetry}
            isRetrying={chat.isSending}
            onRetry={() => {
              void chat.retry();
            }}
            onPrompt={
              sessionReady
                ? (text) => {
                    void chat.send(text);
                  }
                : undefined
            }
          >
            <AiChatThread
              messages={chat.messages}
              isSending={chat.isSending}
              isRecommending={chat.isRecommending}
            />
          </AiChatShell>
        )}
      </AiChatErrorBoundary>

      {showFailure ? null : (
        <AiChatComposer
          disabled={!sessionReady}
          sending={chat.isSending}
          sendState={chat.sendState}
          onSend={chat.send}
        />
      )}
    </div>
  );
}
