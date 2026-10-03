"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUiLang } from "@/components/layout/LanguageProvider";
import {
  describeAiAssistantError,
  initializeAiSession,
  isBrowserOffline,
} from "@/services/ai-assistant";
import type { UiLang } from "@/lib/language";
import type {
  AiAssistantPhase,
  AiSession,
  AiUnavailableReason,
} from "@/types/ai-assistant";

/** Repeat open/toggle bursts inside this window never reach the API. */
const REQUEST_THROTTLE_MS = 800;
/** Re-initialize this long before the backend TTL so a stale id is never reused. */
const EXPIRY_MARGIN_MS = 30 * 1000;

type EnsureSessionOptions = {
  /** Skip the burst throttle — for deliberate actions like Retry. */
  bypassThrottle?: boolean;
  /** Keep the current failure visible and show a "retrying" affordance. */
  isRetry?: boolean;
};

export type AiAssistantControls = {
  isOpen: boolean;
  phase: AiAssistantPhase;
  session: AiSession | null;
  /** i18n key describing the last failure, `null` while healthy. */
  errorKey: string | null;
  unavailableReason: AiUnavailableReason | null;
  /** True while a retry is in flight, so the panel can keep the failure on screen. */
  isRetrying: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  retry: () => void;
  /**
   * Creates ONE fresh backend session without touching the visible conversation and
   * resolves with its id (null when it could not be created). Used to recover from an
   * expired/lost session (404) so the user's turn can be retried once.
   */
  renewSession: () => Promise<string | null>;
  /** Re-adopts a previously stored session id (UI continuity after a reload). */
  restoreSession: (sessionId: string, savedAt: number) => void;
  /** Slides the client-side expiry after a successful turn (the backend slides its TTL). */
  touchSession: () => void;
};

/**
 * Owns the assistant session lifecycle: `idle → loading → active | error | unavailable`.
 * Mount this once (see `AiAssistantProvider`) so the session, panel state and any
 * failure survive client-side navigation instead of resetting per route.
 */
export function useAiAssistant(): AiAssistantControls {
  const lang = useUiLang();

  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<AiAssistantPhase>("idle");
  const [session, setSession] = useState<AiSession | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [unavailableReason, setUnavailableReason] =
    useState<AiUnavailableReason | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastRequestAtRef = useRef(0);
  const sessionRef = useRef<AiSession | null>(null);
  /** The language we asked for, which is what session reuse must be keyed on. */
  const requestedLangRef = useRef<UiLang | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Drop any in-flight initialization so an unmount cannot leak a pending request.
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const hasUsableSession = useCallback((uiLang: UiLang) => {
    if (!sessionRef.current) return false;
    // Compare the language we requested rather than the one echoed back, so a
    // backend that coerces the value can never cause an endless re-init loop.
    if (requestedLangRef.current !== uiLang) return false;

    const expiresAt = Date.parse(sessionRef.current.expiresAt);
    if (Number.isNaN(expiresAt)) return false;
    return expiresAt - EXPIRY_MARGIN_MS > Date.now();
  }, []);

  const markUnreachable = useCallback(
    (messageKey: string, reason: AiUnavailableReason) => {
      sessionRef.current = null;
      requestedLangRef.current = null;
      setSession(null);
      setErrorKey(messageKey);
      setUnavailableReason(reason);
      setPhase("unavailable");
    },
    [],
  );

  const ensureSession = useCallback(
    async (options: EnsureSessionOptions = {}) => {
      const { bypassThrottle = false, isRetry = false } = options;

      // A request is already running: join it instead of firing a second one.
      if (inFlightRef.current) {
        await inFlightRef.current;
        return;
      }

      const now = Date.now();
      if (!bypassThrottle && now - lastRequestAtRef.current < REQUEST_THROTTLE_MS) {
        return;
      }
      lastRequestAtRef.current = now;

      // No connection at all — fail fast rather than waiting out the HTTP timeout.
      if (isBrowserOffline()) {
        markUnreachable("errors.assistant.network", "network");
        setIsRetrying(false);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      const requestedLang = lang;

      const request = (async () => {
        setPhase("loading");
        if (isRetry) {
          setIsRetrying(true);
        } else {
          setErrorKey(null);
          setUnavailableReason(null);
        }

        try {
          const next = await initializeAiSession(requestedLang, controller.signal);
          if (controller.signal.aborted || !mountedRef.current) return;

          sessionRef.current = next;
          requestedLangRef.current = requestedLang;
          setSession(next);
          setErrorKey(null);
          setUnavailableReason(null);
          setPhase("active");
        } catch (err) {
          if (controller.signal.aborted || !mountedRef.current) return;

          const failure = describeAiAssistantError(err);
          sessionRef.current = null;
          requestedLangRef.current = null;
          setSession(null);
          setErrorKey(failure.messageKey);
          setUnavailableReason(failure.reason);
          setPhase(failure.kind);
        } finally {
          if (mountedRef.current) setIsRetrying(false);
          if (abortRef.current === controller) abortRef.current = null;
        }
      })();

      inFlightRef.current = request;
      try {
        await request;
      } finally {
        inFlightRef.current = null;
      }
    },
    [lang, markUnreachable],
  );

  const touchSession = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    const next: AiSession = {
      ...current,
      expiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
    };
    sessionRef.current = next;
    setSession(next);
  }, []);

  const renewSession = useCallback(async (): Promise<string | null> => {
    // A request is already running: join it instead of firing a second one.
    if (inFlightRef.current) {
      await inFlightRef.current;
      return sessionRef.current?.sessionId ?? null;
    }

    if (isBrowserOffline()) return null;

    const controller = new AbortController();
    abortRef.current = controller;
    const requestedLang = lang;

    const request = (async () => {
      try {
        const next = await initializeAiSession(requestedLang, controller.signal);
        if (controller.signal.aborted || !mountedRef.current) return;
        sessionRef.current = next;
        requestedLangRef.current = requestedLang;
        setSession(next);
        setErrorKey(null);
        setUnavailableReason(null);
        setPhase("active");
      } catch {
        /* the caller falls back to the normal retryable error */
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    })();

    inFlightRef.current = request;
    try {
      await request;
    } finally {
      inFlightRef.current = null;
    }

    return sessionRef.current?.sessionId ?? null;
  }, [lang]);

  const restoreSession = useCallback(
    (sessionId: string, savedAt: number) => {
      if (sessionRef.current) return;
      const restored: AiSession = {
        sessionId,
        language: lang,
        createdAt: new Date(savedAt).toISOString(),
        // Mirrors the stored-snapshot max age; the backend slides its own TTL, and a
        // 404 simply triggers renewSession.
        expiresAt: new Date(savedAt + 25 * 60 * 1000).toISOString(),
      };
      sessionRef.current = restored;
      requestedLangRef.current = lang;
      setSession(restored);
      setPhase("active");
    },
    [lang],
  );

  const openAssistant = useCallback(() => {
    setIsOpen(true);

    if (hasUsableSession(lang)) {
      setPhase("active");
      return;
    }
    void ensureSession();
  }, [ensureSession, hasUsableSession, lang]);

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleAssistant = useCallback(() => {
    if (isOpen) {
      closeAssistant();
      return;
    }
    openAssistant();
  }, [isOpen, closeAssistant, openAssistant]);

  /** Explicit user action, so it skips the burst throttle but not the in-flight guard. */
  const retry = useCallback(() => {
    void ensureSession({ bypassThrottle: true, isRetry: true });
  }, [ensureSession]);

  // Keep the live session on the language the user is currently reading.
  useEffect(() => {
    if (!isOpen || phase !== "active") return;
    if (requestedLangRef.current === lang) return;

    void ensureSession({ bypassThrottle: true });
  }, [isOpen, phase, lang, ensureSession]);

  // Recover from a dropped connection without the user reloading the page.
  useEffect(() => {
    const handleOnline = () => {
      if (!isOpen || phase !== "unavailable") return;
      void ensureSession({ bypassThrottle: true, isRetry: true });
    };

    const handleOffline = () => {
      // Only correct a session the user believes is live; a closed panel
      // re-initializes on its next open anyway.
      if (phase !== "active") return;
      markUnreachable("errors.assistant.network", "network");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isOpen, phase, ensureSession, markUnreachable]);

  return useMemo(
    () => ({
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
      renewSession,
      restoreSession,
      touchSession,
    }),
    [
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
      renewSession,
      restoreSession,
      touchSession,
    ],
  );
}
