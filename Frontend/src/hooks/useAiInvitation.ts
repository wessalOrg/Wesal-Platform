"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  INVITATION_POLICY,
  canShowInvitation,
  invitationDayKey,
  invitationMessageKey,
  readInvitationRecord,
  recordInvitationShown,
  silenceInvitations,
} from "@/lib/ai-invitation";

/** How often a visible bubble re-checks that it is still welcome. */
const WATCHDOG_MS = 500;

type UseAiInvitationInput = {
  isOpen: boolean;
  isDragging: boolean;
  /** The button the invitation speaks for. */
  anchorRef: RefObject<HTMLElement | null>;
};

export type AiInvitation = {
  isVisible: boolean;
  /** i18n key of the message chosen for this appearance. */
  messageKey: string;
  /** Reported by the bubble once it has a safe spot and is genuinely on screen. */
  handleShown: () => void;
  /** Its welcome expired, or no safe spot ever appeared. */
  handleExpired: () => void;
  dismiss: () => void;
  /** The user took the invitation up, so it has served its purpose. */
  accept: () => void;
};

/** Why the assistant itself makes this a bad moment; `null` means it is fine. */
type BlockedBy = "open" | "drag" | null;

/** A bubble can only point at a button that exists and has been laid out. */
function isAnchorReady(anchor: HTMLElement | null): boolean {
  if (!anchor) return false;
  const rect = anchor.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Moments when a bubble would interrupt rather than invite. All of them are
 * transient, so they postpone the invitation instead of using one up.
 *
 * Deliberately no hit-test of the button: anything that legitimately covers it —
 * the booking sheet and the photo lightbox — is a dialog and is caught below,
 * while `elementFromPoint` also reports overlays the user never sees, such as the
 * framework's development tooling, which would postpone every invitation forever.
 */
function isPageQuiet(anchor: HTMLElement | null): boolean {
  if (typeof document === "undefined") return false;
  // A background tab would show the bubble to nobody and spend the allowance.
  if (document.visibilityState !== "visible") return false;
  // A dialog owns the user's attention, and both of ours also sit above the button.
  if (document.querySelector('[aria-modal="true"]')) return false;
  return isAnchorReady(anchor);
}

/**
 * Decides *whether and when* a passive invitation may appear; the bubble decides
 * *where*. An invitation is counted only once it is really visible, so a blocked
 * moment costs nothing and is simply retried.
 *
 * Timers are started once and read the current assistant state through a ref, so
 * client-side navigation — which keeps this hook mounted — never restarts the
 * delay, duplicates a schedule or leaves a timer behind.
 */
export function useAiInvitation({
  isOpen,
  isDragging,
  anchorRef,
}: UseAiInvitationInput): AiInvitation {
  const [isVisible, setIsVisible] = useState(false);
  const [messageKey, setMessageKey] = useState(() => invitationMessageKey(0));
  /**
   * Bumped only after a hide that did not spend the visit allowance, so a drag or
   * a dialog can postpone the bubble without killing the schedule. The first
   * delay still runs once; later bumps use the shorter retry gap.
   */
  const [resumeKey, setResumeKey] = useState(0);
  const shownThisVisitRef = useRef(0);
  const blockedByRef = useRef<BlockedBy>(null);

  useEffect(() => {
    blockedByRef.current = isOpen ? "open" : isDragging ? "drag" : null;
  }, [isOpen, isDragging]);

  const hide = useCallback((cooldownMs: number) => {
    if (cooldownMs > 0) silenceInvitations(Date.now(), cooldownMs);
    setIsVisible(false);
    if (
      cooldownMs === 0 &&
      shownThisVisitRef.current < INVITATION_POLICY.maxPerVisit
    ) {
      setResumeKey((key) => key + 1);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const attempt = () => {
      if (cancelled) return;

      const now = Date.now();
      const record = readInvitationRecord();
      // The allowance is used up for this visit, so there is nothing to wait for.
      if (!canShowInvitation(record, shownThisVisitRef.current, now)) {
        return;
      }

      if (blockedByRef.current !== null || !isPageQuiet(anchorRef.current)) {
        timer = window.setTimeout(attempt, INVITATION_POLICY.retryDelayMs);
        return;
      }

      // Rotate through the copy pool deterministically. Newer records carry a
      // cumulative `messageCursor`; older ones fall back to today's count so the
      // first two slots still don't repeat each other immediately.
      const cursor = record.messageCursor ?? (record.day === invitationDayKey(now) ? record.shownToday : 0);
      setMessageKey(invitationMessageKey(cursor));
      setIsVisible(true);
    };

    timer = window.setTimeout(
      attempt,
      resumeKey === 0 ? INVITATION_POLICY.firstDelayMs : INVITATION_POLICY.retryDelayMs,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // `anchorRef` is stable; `resumeKey` re-arms after a postpone, never after navigation.
  }, [anchorRef, resumeKey]);

  /**
   * Conditions can turn hostile *after* the bubble appears — the user opens the
   * assistant, starts dragging the button, or a lightbox takes over the screen.
   * Watching while visible keeps the bubble from ever sitting on top of them.
   */
  useEffect(() => {
    if (!isVisible) return;

    const check = () => {
      const blockedBy = blockedByRef.current;
      if (blockedBy === "open") {
        // The assistant is in use: it no longer needs advertising.
        hide(INVITATION_POLICY.engagedCooldownMs);
        return;
      }
      if (blockedBy !== null || !isPageQuiet(anchorRef.current)) hide(0);
    };

    const watchdog = window.setInterval(check, WATCHDOG_MS);
    return () => window.clearInterval(watchdog);
  }, [isVisible, hide, anchorRef]);

  const handleShown = useCallback(() => {
    // The bubble can be re-mounted (a drag interrupts it, say) without that
    // counting as a second invitation against the daily allowance.
    if (shownThisVisitRef.current >= INVITATION_POLICY.maxPerVisit) return;
    shownThisVisitRef.current += 1;
    recordInvitationShown(Date.now());
  }, []);

  const handleExpired = useCallback(() => hide(0), [hide]);

  const dismiss = useCallback(() => hide(INVITATION_POLICY.dismissCooldownMs), [hide]);

  const accept = useCallback(() => hide(INVITATION_POLICY.engagedCooldownMs), [hide]);

  return { isVisible, messageKey, handleShown, handleExpired, dismiss, accept };
}
