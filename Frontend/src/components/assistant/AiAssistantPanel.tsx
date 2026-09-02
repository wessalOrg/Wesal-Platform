"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent as ReactAnimationEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import AiAssistantAvatar from "@/components/assistant/AiAssistantAvatar";
import AiAssistantUnavailableNotice from "@/components/assistant/AiAssistantUnavailableNotice";
import AiChatComposer from "@/components/assistant/AiChatComposer";
import AiChatErrorBoundary from "@/components/assistant/AiChatErrorBoundary";
import AiChatShell from "@/components/assistant/AiChatShell";
import AiChatThread from "@/components/assistant/AiChatThread";
import { useAiChat } from "@/hooks/useAiChat";
import { useT } from "@/i18n";
import { placeBubble, type Rect } from "@/lib/bubble-placement";
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
  /** Floating button the chat should open beside — follows wherever the user left it. */
  anchorRef: RefObject<HTMLElement | null>;
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
/** Prefer rising out of the FAB; fall back to the sides when there is no room above. */
const PANEL_SIDES = ["above", "left", "right", "below"] as const;
const CRITICAL_UI_SELECTOR = "header.wesal-navbar, [data-wesal-critical]";
const PANEL_MIN_WIDTH_PX = 280;
const PANEL_MIN_HEIGHT_PX = 320;
const PANEL_EDGE_GAP_PX = 12;

type PanelMotion = "closed" | "in" | "open" | "out";
type PanelSize = { width: number; height: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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

function readCriticalUiRects(): Rect[] {
  return Array.from(document.querySelectorAll(CRITICAL_UI_SELECTOR))
    .map((element) => {
      const { left, top, width, height } = element.getBoundingClientRect();
      return { left, top, width, height };
    })
    .filter((rect) => rect.width > 0 && rect.height > 0);
}

function panelWidthForViewport(viewportWidth: number): number {
  if (viewportWidth < 640) return Math.min(viewportWidth - 24, viewportWidth * 0.94);
  if (viewportWidth < 1024) return Math.min(384, viewportWidth - 48);
  return Math.min(416, viewportWidth - 48);
}

function panelMaxHeightForViewport(
  viewport: { width: number; height: number },
  anchorRect: DOMRect,
): number {
  const gapAbove = Math.max(160, anchorRect.top - 24);
  const gapBelow = Math.max(
    160,
    viewport.height - (anchorRect.top + anchorRect.height) - 24,
  );
  return Math.min(
    viewport.width < 640 ? viewport.height * 0.7 : viewport.height * 0.78,
    608,
    Math.max(gapAbove, gapBelow, 280),
  );
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
  anchorRef,
  onClose,
  onRetry,
  onBrowseHalls,
}: AiAssistantPanelProps) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const userSizeRef = useRef<PanelSize | null>(null);
  const resizingRef = useRef(false);
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

  const place = useCallback(() => {
    const panel = panelRef.current;
    const anchor = anchorRef.current;
    if (!panel || !anchor) return;

    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const anchorRect = anchor.getBoundingClientRect();
    const maxWidth = Math.max(PANEL_MIN_WIDTH_PX, viewport.width - PANEL_EDGE_GAP_PX * 2);
    const maxHeight = Math.max(
      PANEL_MIN_HEIGHT_PX,
      viewport.height - PANEL_EDGE_GAP_PX * 2,
    );
    const defaultWidth = panelWidthForViewport(viewport.width);
    const defaultMaxHeight = panelMaxHeightForViewport(viewport, anchorRect);
    const custom = userSizeRef.current;

    const width = custom
      ? clamp(custom.width, PANEL_MIN_WIDTH_PX, maxWidth)
      : defaultWidth;
    panel.style.width = `${width}px`;

    if (custom) {
      const height = clamp(custom.height, PANEL_MIN_HEIGHT_PX, maxHeight);
      panel.style.height = `${height}px`;
      panel.style.maxHeight = `${height}px`;
    } else {
      panel.style.height = "";
      panel.style.maxHeight = `${defaultMaxHeight}px`;
    }

    // Prefer offset sizes so an in-progress scale animation does not shrink the box
    // used for placement and pull the panel into the FAB.
    const size = {
      width: panel.offsetWidth || width,
      height: panel.offsetHeight || (custom?.height ?? defaultMaxHeight),
    };
    const placement = placeBubble({
      anchor: {
        left: anchorRect.left,
        top: anchorRect.top,
        width: anchorRect.width,
        height: anchorRect.height,
      },
      bubble: size,
      viewport,
      avoid: readCriticalUiRects(),
      preferredSides: [...PANEL_SIDES],
    });

    if (!placement) {
      const left = Math.min(
        Math.max(PANEL_EDGE_GAP_PX, anchorRect.left + anchorRect.width / 2 - width / 2),
        viewport.width - width - PANEL_EDGE_GAP_PX,
      );
      const top = Math.max(PANEL_EDGE_GAP_PX, anchorRect.top - size.height - PANEL_EDGE_GAP_PX);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.dataset.placement = "above";
      panel.dataset.anchored = "true";
      return;
    }

    panel.style.left = `${placement.left}px`;
    panel.style.top = `${placement.top}px`;
    panel.dataset.placement = placement.side;
    panel.dataset.anchored = "true";
  }, [anchorRef]);

  const reposition = useCallback(() => {
    if (resizingRef.current) return;
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(place);
  }, [place]);

  const onResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const panel = panelRef.current;
    if (!panel) return;

    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = panel.offsetWidth;
    const startHeight = panel.offsetHeight;
    const isRtl = document.documentElement.dir === "rtl";
    const maxWidth = () =>
      Math.max(PANEL_MIN_WIDTH_PX, window.innerWidth - PANEL_EDGE_GAP_PX * 2);
    const maxHeight = () =>
      Math.max(PANEL_MIN_HEIGHT_PX, window.innerHeight - PANEL_EDGE_GAP_PX * 2);

    resizingRef.current = true;
    panel.dataset.resizing = "true";
    handle.setPointerCapture(event.pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      // Handle sits at top-inline-start: grow when dragging away from the FAB side.
      const widthDelta = isRtl ? moveEvent.clientX - startX : startX - moveEvent.clientX;
      const heightDelta = startY - moveEvent.clientY;
      const nextSize: PanelSize = {
        width: clamp(startWidth + widthDelta, PANEL_MIN_WIDTH_PX, maxWidth()),
        height: clamp(startHeight + heightDelta, PANEL_MIN_HEIGHT_PX, maxHeight()),
      };
      userSizeRef.current = nextSize;
      panel.style.width = `${nextSize.width}px`;
      panel.style.height = `${nextSize.height}px`;
      panel.style.maxHeight = `${nextSize.height}px`;
      place();
    };

    const onUp = (upEvent: PointerEvent) => {
      resizingRef.current = false;
      panel.dataset.resizing = "false";
      try {
        handle.releasePointerCapture(upEvent.pointerId);
      } catch {
        /* already released */
      }
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      place();
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  useLayoutEffect(() => {
    if (!isVisible) return;
    place();
    return () => window.cancelAnimationFrame(frameRef.current);
  }, [isVisible, place, motion, showFailure, sessionReady, chat.messages.length]);

  useEffect(() => {
    if (!isVisible) return;
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(reposition);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [isVisible, reposition]);

  useEffect(() => {
    if (!isVisible) return;
    window.addEventListener("resize", reposition);
    window.addEventListener("orientationchange", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("orientationchange", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [isVisible, reposition]);

  useEffect(() => {
    if (!isVisible) return;
    const anchor = anchorRef.current;
    if (!anchor) return;

    let last = "";
    const track = () => {
      const rect = anchor.getBoundingClientRect();
      const key = `${Math.round(rect.left)}|${Math.round(rect.top)}|${Math.round(rect.width)}`;
      if (key === last) return;
      last = key;
      reposition();
    };

    track();
    const pulse = window.setInterval(track, 250);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(track);
    observer?.observe(anchor);

    return () => {
      window.clearInterval(pulse);
      observer?.disconnect();
    };
  }, [anchorRef, isVisible, reposition]);

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
      className="wesal-ai-panel wesal-ai-panel--anchored fixed z-[105] flex min-w-0 flex-col overflow-hidden rounded-3xl border border-[var(--wesal-border)] bg-white shadow-[0_24px_60px_rgba(60,35,30,0.22)] outline-none"
    >
      <button
        type="button"
        aria-label={t("assistant.panel.resize")}
        data-testid="ai-assistant-resize"
        onPointerDown={onResizePointerDown}
        className="wesal-ai-panel-resize"
      />
      <div className="wesal-ai-panel-header flex shrink-0 items-center gap-3 px-4 py-3.5">
        <span className="wesal-ai-avatar flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#f3e4e2] ring-2 ring-white/80">
          <AiAssistantAvatar />
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
