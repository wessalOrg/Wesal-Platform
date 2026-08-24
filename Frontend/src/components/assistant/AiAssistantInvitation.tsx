"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import AiAssistantSparkIcon from "@/components/assistant/AiAssistantSparkIcon";
import { useT } from "@/i18n";
import { INVITATION_POLICY } from "@/lib/ai-invitation";
import { placeBubble, type Rect } from "@/lib/bubble-placement";

/**
 * Screen chrome the bubble must never cover. The navigation bar is the platform's
 * only viewport-fixed control surface; the attribute is an opt-in for anything
 * added later, so this stays a one-way dependency on other components.
 */
const CRITICAL_UI_SELECTOR = "header.wesal-navbar, [data-wesal-critical]";

type AiAssistantInvitationProps = {
  /** The floating button the bubble points at, wherever the user left it. */
  anchorRef: RefObject<HTMLElement | null>;
  /** i18n key of the invitation copy for this appearance. */
  messageKey: string;
  onOpen: () => void;
  onDismiss: () => void;
  /** Fired once the bubble is actually placed and visible. */
  onShown: () => void;
  /** Fired when it withdraws itself, placed or not. */
  onExpired: () => void;
};

function readCriticalUiRects(): Rect[] {
  return Array.from(document.querySelectorAll(CRITICAL_UI_SELECTOR))
    .map((element) => {
      const { left, top, width, height } = element.getBoundingClientRect();
      return { left, top, width, height };
    })
    .filter((rect) => rect.width > 0 && rect.height > 0);
}

/**
 * The passive chat invitation (US-AI-03).
 *
 * Placement is written straight to the DOM rather than held in React state: the
 * position is derived from measurements, so re-rendering on every resize would
 * buy nothing. The bubble starts hidden and reveals itself only once a safe spot
 * is found — if none exists it keeps retrying quietly and finally withdraws,
 * which is how "does not block critical UI" is honoured on small screens.
 */
export default function AiAssistantInvitation({
  anchorRef,
  messageKey,
  onOpen,
  onDismiss,
  onShown,
  onExpired,
}: AiAssistantInvitationProps) {
  const t = useT();
  const bubbleRef = useRef<HTMLDivElement>(null);
  const placedRef = useRef(false);
  const retryRef = useRef(0);
  const frameRef = useRef(0);

  const place = useCallback(() => {
    const bubble = bubbleRef.current;
    const anchor = anchorRef.current;
    if (!bubble || !anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    // `offsetWidth`/`offsetHeight` rather than a client rect: the entry animation
    // scales the bubble, and a rect measured mid-animation reports the scaled size,
    // which would place the bubble a few pixels into the button it points at.
    const bubbleSize = { width: bubble.offsetWidth, height: bubble.offsetHeight };

    const placement = placeBubble({
      anchor: {
        left: anchorRect.left,
        top: anchorRect.top,
        width: anchorRect.width,
        height: anchorRect.height,
      },
      bubble: bubbleSize,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      avoid: readCriticalUiRects(),
    });

    // Either nowhere polite to sit, or nothing measurable yet on a page that is
    // still settling. Both are worth another look rather than a silent no-show.
    if (!placement || bubbleSize.width === 0 || bubbleSize.height === 0) {
      bubble.dataset.state = "blocked";
      window.clearTimeout(retryRef.current);
      retryRef.current = window.setTimeout(place, INVITATION_POLICY.retryDelayMs);
      return;
    }

    bubble.style.left = `${placement.left}px`;
    bubble.style.top = `${placement.top}px`;
    bubble.style.setProperty("--wesal-invite-tail", `${placement.tailOffset}px`);
    bubble.dataset.placement = placement.side;
    bubble.dataset.state = "shown";

    if (!placedRef.current) {
      placedRef.current = true;
      onShown();
    }
  }, [anchorRef, onShown]);

  /** Coalesced to one placement per frame; the anchor may still be moving. */
  const reposition = useCallback(() => {
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(place);
  }, [place]);

  // Measured and positioned before the browser paints, so it never appears twice.
  useLayoutEffect(() => {
    place();
    return () => {
      window.clearTimeout(retryRef.current);
      window.cancelAnimationFrame(frameRef.current);
    };
  }, [place]);

  /**
   * The first measurement is not the final one: a web font swapping in, or copy of
   * a different length, resizes the bubble after it has been placed. Coordinates
   * derived from the old size would push it over the button or off screen, so any
   * change to its own box is re-placed. Writing `left`/`top` cannot change the
   * size, so this settles rather than loops.
   */
  useEffect(() => {
    const bubble = bubbleRef.current;
    if (!bubble || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(reposition);
    observer.observe(bubble);
    return () => observer.disconnect();
  }, [reposition]);

  useEffect(() => {
    window.addEventListener("resize", reposition);
    window.addEventListener("orientationchange", reposition);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("orientationchange", reposition);
    };
  }, [reposition]);

  /**
   * The button can move without the window resizing — a restored drag, a late
   * layout, a viewport chrome change. Watching its box keeps the tail on it.
   */
  useEffect(() => {
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
  }, [anchorRef, reposition]);

  useEffect(() => {
    // Withdraw after its welcome, or once it is clear no safe spot is coming.
    const shown = window.setTimeout(onExpired, INVITATION_POLICY.autoHideMs);
    const blocked = window.setTimeout(() => {
      if (!placedRef.current) onExpired();
    }, INVITATION_POLICY.giveUpMs);

    return () => {
      window.clearTimeout(shown);
      window.clearTimeout(blocked);
    };
  }, [onExpired]);

  return (
    <div
      ref={bubbleRef}
      role="status"
      aria-live="polite"
      data-state="pending"
      data-testid="ai-assistant-invitation"
      className="wesal-ai-invite fixed z-[104] flex items-start gap-2 rounded-2xl border border-[var(--wesal-border)] bg-white px-3 py-2.5 shadow-[0_16px_40px_rgba(60,35,30,0.18)]"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-2 text-start text-[0.78rem] leading-5 font-semibold text-[var(--wesal-text)] outline-none focus-visible:underline"
        data-testid="ai-assistant-invitation-open"
      >
        <span className="wesal-ai-avatar flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white">
          <AiAssistantSparkIcon className="h-4 w-4" />
        </span>
        {t(messageKey)}
      </button>

      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("assistant.invite.dismiss")}
        title={t("assistant.invite.dismiss")}
        className="-me-1 -mt-0.5 shrink-0 rounded-full p-1 text-[var(--wesal-muted)] outline-none transition-colors hover:bg-[var(--wesal-pink-soft)] hover:text-[var(--wesal-text)] focus-visible:bg-[var(--wesal-pink-soft)]"
        data-testid="ai-assistant-invitation-dismiss"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
          className="h-3.5 w-3.5"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <span className="wesal-ai-invite-tail" aria-hidden="true" />
    </div>
  );
}
