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
import { BUBBLE_GAP_PX, placeBubble, type Rect } from "@/lib/bubble-placement";
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
/** Expanded stays beside Mabrouk — never centered over the figure. */
const EXPANDED_PANEL_SIDES = ["left", "right", "above", "below"] as const;
const CRITICAL_UI_SELECTOR = "header.wesal-navbar, [data-wesal-critical]";
const PANEL_MIN_WIDTH_PX = 280;
const PANEL_MIN_HEIGHT_PX = 320;
const PANEL_EDGE_GAP_PX = 12;
const PANEL_SIZE_STORAGE_KEY = "wesal_ai_panel_size";
const PANEL_WIDE_BREAKPOINT_PX = 520;
const DRAG_THRESHOLD_PX = 5;

type PanelMotion = "closed" | "in" | "open" | "out";
type PanelSize = { width: number; height: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readStoredPanelSize(): PanelSize | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PANEL_SIZE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PanelSize>;
    if (
      typeof parsed.width !== "number" ||
      typeof parsed.height !== "number" ||
      !Number.isFinite(parsed.width) ||
      !Number.isFinite(parsed.height)
    ) {
      return null;
    }
    return {
      width: clamp(parsed.width, PANEL_MIN_WIDTH_PX, 1200),
      height: clamp(parsed.height, PANEL_MIN_HEIGHT_PX, 1200),
    };
  } catch {
    return null;
  }
}

function storePanelSize(size: PanelSize): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PANEL_SIZE_STORAGE_KEY, JSON.stringify(size));
  } catch {
    /* ignore quota / private mode */
  }
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

/**
 * Wide chat that still leaves a lane for the FAB figure beside it.
 * Centering over Mabrouk is intentionally avoided — the figure stays a side companion.
 */
function expandedSizeForViewport(
  viewportWidth: number,
  viewportHeight: number,
  anchorWidth: number,
): PanelSize {
  const fabLane = Math.ceil(anchorWidth + BUBBLE_GAP_PX + PANEL_EDGE_GAP_PX);
  const maxWidth = Math.max(
    PANEL_MIN_WIDTH_PX,
    viewportWidth - PANEL_EDGE_GAP_PX * 2 - fabLane,
  );
  const maxHeight = Math.max(PANEL_MIN_HEIGHT_PX, viewportHeight - PANEL_EDGE_GAP_PX * 2);
  const targetWidth =
    viewportWidth < 640
      ? maxWidth
      : Math.round(Math.min(Math.max(viewportWidth * 0.62, 520), 760));
  const width = clamp(targetWidth, PANEL_MIN_WIDTH_PX, maxWidth);
  const height = clamp(
    Math.round(Math.min(viewportHeight * 0.72, viewportWidth < 640 ? 520 : 560)),
    PANEL_MIN_HEIGHT_PX,
    maxHeight,
  );
  return { width, height };
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
  const userSizeRef = useRef<PanelSize | null>(readStoredPanelSize());
  const compactBeforeExpandRef = useRef<PanelSize | null>(null);
  const resizingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const [isExpanded, setIsExpanded] = useState(() => {
    const stored = readStoredPanelSize();
    return Boolean(stored && stored.width >= PANEL_WIDE_BREAKPOINT_PX);
  });
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
    const fabLane = Math.ceil(anchorRect.width + BUBBLE_GAP_PX + PANEL_EDGE_GAP_PX);
    const maxWidth = Math.max(
      PANEL_MIN_WIDTH_PX,
      viewport.width - PANEL_EDGE_GAP_PX * 2,
    );
    const maxHeight = Math.max(
      PANEL_MIN_HEIGHT_PX,
      viewport.height - PANEL_EDGE_GAP_PX * 2,
    );
    const defaultWidth = panelWidthForViewport(viewport.width);
    const defaultMaxHeight = panelMaxHeightForViewport(viewport, anchorRect);
    const custom = userSizeRef.current;
    const expanded = Boolean(
      custom && custom.width >= PANEL_WIDE_BREAKPOINT_PX,
    );
    // Expanded must leave a side lane for Mabrouk so the figure never sits inside the chat.
    const widthCap = expanded
      ? Math.max(PANEL_MIN_WIDTH_PX, maxWidth - fabLane)
      : maxWidth;

    const width = custom
      ? clamp(custom.width, PANEL_MIN_WIDTH_PX, widthCap)
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

    panel.dataset.expanded = expanded ? "true" : "false";

    const fabAvoid: Rect = {
      left: anchorRect.left - BUBBLE_GAP_PX / 2,
      top: anchorRect.top - BUBBLE_GAP_PX / 2,
      width: anchorRect.width + BUBBLE_GAP_PX,
      height: anchorRect.height + BUBBLE_GAP_PX,
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
      avoid: [...readCriticalUiRects(), fabAvoid],
      preferredSides: [...(expanded ? EXPANDED_PANEL_SIDES : PANEL_SIDES)],
    });

    if (!placement) {
      // Last resort: sit on the roomier horizontal side of Mabrouk, never centered over him.
      const roomLeft = anchorRect.left;
      const roomRight = viewport.width - (anchorRect.left + anchorRect.width);
      const preferLeft = roomLeft >= roomRight;
      const left = preferLeft
        ? clamp(
            anchorRect.left - BUBBLE_GAP_PX - size.width,
            PANEL_EDGE_GAP_PX,
            Math.max(PANEL_EDGE_GAP_PX, viewport.width - size.width - PANEL_EDGE_GAP_PX),
          )
        : clamp(
            anchorRect.left + anchorRect.width + BUBBLE_GAP_PX,
            PANEL_EDGE_GAP_PX,
            Math.max(PANEL_EDGE_GAP_PX, viewport.width - size.width - PANEL_EDGE_GAP_PX),
          );
      const top = clamp(
        anchorRect.top + anchorRect.height / 2 - size.height / 2,
        PANEL_EDGE_GAP_PX,
        Math.max(PANEL_EDGE_GAP_PX, viewport.height - size.height - PANEL_EDGE_GAP_PX),
      );
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.dataset.placement = preferLeft ? "left" : "right";
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

  const toggleExpand = useCallback(() => {
    const panel = panelRef.current;
    if (!panel || typeof window === "undefined") return;

    if (isExpanded) {
      userSizeRef.current = compactBeforeExpandRef.current;
      if (userSizeRef.current) storePanelSize(userSizeRef.current);
      else {
        try {
          window.sessionStorage.removeItem(PANEL_SIZE_STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }
      setIsExpanded(false);
      place();
      return;
    }

    const currentWidth = panel.offsetWidth || PANEL_MIN_WIDTH_PX;
    const currentHeight = panel.offsetHeight || PANEL_MIN_HEIGHT_PX;
    compactBeforeExpandRef.current = userSizeRef.current ?? {
      width: currentWidth,
      height: currentHeight,
    };
    const anchor = anchorRef.current;
    const expanded = expandedSizeForViewport(
      window.innerWidth,
      window.innerHeight,
      anchor?.offsetWidth || 128,
    );
    userSizeRef.current = expanded;
    storePanelSize(expanded);
    setIsExpanded(true);
    place();
  }, [anchorRef, isExpanded, place]);

  const onResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const panel = panelRef.current;
    if (!panel) return;

    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const startRect = panel.getBoundingClientRect();
    const startWidth = startRect.width;
    const startHeight = startRect.height;
    const isRtl = document.documentElement.dir === "rtl";
    // Handle sits beside the close button (top-inline-end). Pin the opposite
    // bottom-inline-start corner so drag grows/shrinks under the cursor.
    const pinnedBottom = startRect.bottom;
    const pinnedInlineStart = isRtl ? startRect.right : startRect.left;
    const maxWidth = () =>
      Math.max(PANEL_MIN_WIDTH_PX, window.innerWidth - PANEL_EDGE_GAP_PX * 2);
    const maxHeight = () =>
      Math.max(PANEL_MIN_HEIGHT_PX, window.innerHeight - PANEL_EDGE_GAP_PX * 2);

    dragMovedRef.current = false;
    resizingRef.current = true;
    panel.dataset.resizing = "true";
    handle.setPointerCapture(event.pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      const absX = Math.abs(moveEvent.clientX - startX);
      const absY = Math.abs(moveEvent.clientY - startY);
      if (!dragMovedRef.current) {
        if (absX < DRAG_THRESHOLD_PX && absY < DRAG_THRESHOLD_PX) return;
        dragMovedRef.current = true;
        document.body.style.cursor = isRtl ? "nesw-resize" : "nwse-resize";
        document.body.style.userSelect = "none";
      }

      const widthDelta = isRtl ? startX - moveEvent.clientX : moveEvent.clientX - startX;
      const heightDelta = startY - moveEvent.clientY;
      const nextSize: PanelSize = {
        width: clamp(startWidth + widthDelta, PANEL_MIN_WIDTH_PX, maxWidth()),
        height: clamp(startHeight + heightDelta, PANEL_MIN_HEIGHT_PX, maxHeight()),
      };
      const nextTop = clamp(
        pinnedBottom - nextSize.height,
        PANEL_EDGE_GAP_PX,
        window.innerHeight - PANEL_MIN_HEIGHT_PX - PANEL_EDGE_GAP_PX,
      );
      const nextLeft = isRtl
        ? clamp(
            pinnedInlineStart - nextSize.width,
            PANEL_EDGE_GAP_PX,
            window.innerWidth - PANEL_MIN_WIDTH_PX - PANEL_EDGE_GAP_PX,
          )
        : clamp(
            pinnedInlineStart,
            PANEL_EDGE_GAP_PX,
            window.innerWidth - PANEL_MIN_WIDTH_PX - PANEL_EDGE_GAP_PX,
          );

      userSizeRef.current = nextSize;
      panel.style.width = `${nextSize.width}px`;
      panel.style.height = `${nextSize.height}px`;
      panel.style.maxHeight = `${nextSize.height}px`;
      panel.style.left = `${nextLeft}px`;
      panel.style.top = `${nextTop}px`;
    };

    const onUp = (upEvent: PointerEvent) => {
      resizingRef.current = false;
      panel.dataset.resizing = "false";
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        handle.releasePointerCapture(upEvent.pointerId);
      } catch {
        /* already released */
      }
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);

      if (!dragMovedRef.current) {
        toggleExpand();
        return;
      }

      if (userSizeRef.current) {
        storePanelSize(userSizeRef.current);
        setIsExpanded(userSizeRef.current.width >= PANEL_WIDE_BREAKPOINT_PX);
      }
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
      data-size={isExpanded ? "expanded" : "compact"}
    >
      <div
        className={`wesal-ai-panel-header flex shrink-0 items-center gap-3 px-4 ${
          isExpanded ? "py-4 sm:gap-4 sm:px-5" : "py-3.5"
        }`}
      >
        <span
          className={`wesal-ai-avatar flex shrink-0 overflow-hidden rounded-full bg-[#f3e4e2] ring-2 ring-white/80 ${
            isExpanded ? "h-14 w-14 sm:h-16 sm:w-16" : "h-10 w-10"
          }`}
        >
          <AiAssistantAvatar pose="bust" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id={`${id}-title`}
            className={`font-extrabold tracking-wide text-[var(--wesal-maroon-dark)] ${
              isExpanded
                ? "text-lg sm:text-xl"
                : "truncate text-base"
            }`}
          >
            {t("assistant.title")}
          </h2>
          <p
            className={`mt-0.5 flex items-center gap-1.5 text-[var(--wesal-muted)] ${
              isExpanded ? "text-xs sm:text-sm" : "text-[0.7rem]"
            }`}
            aria-live="polite"
          >
            <span
              aria-hidden="true"
              className={`rounded-full ${
                isExpanded ? "h-2 w-2" : "h-1.5 w-1.5"
              } ${
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
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label={t(isExpanded ? "assistant.panel.collapse" : "assistant.panel.expand")}
            title={t(isExpanded ? "assistant.panel.collapse" : "assistant.panel.expand")}
            data-testid="ai-assistant-resize"
            data-expanded={isExpanded ? "true" : "false"}
            onPointerDown={onResizePointerDown}
            className="wesal-ai-panel-resize"
          >
            {isExpanded ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-3.5 w-3.5"
              >
                <path d="M21 15v6h-6" />
                <path d="M3 9V3h6" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-3.5 w-3.5"
              >
                <path d="M15 3h6v6" />
                <path d="M9 21H3v-6" />
              </svg>
            )}
          </button>
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
