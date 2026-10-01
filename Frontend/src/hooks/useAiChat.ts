"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createChatMessageId,
  describeChatError,
  isHallSearchQuestion,
  sendTurnWithRecovery,
  validateChatQuestion,
} from "@/services/ai-chat";
import type { AssistantPageContext } from "@/lib/wesal-routes";
import type { AiPinnedHall } from "@/types/ai-assistant";
import type { AiChatMessage, AiChatSendState, AiChatSurface } from "@/types/ai-chat";

/** What is attached to each turn. Read when the user SENDS, so it is never stale. */
export type AiTurnContextSnapshot = {
  page: AssistantPageContext | null;
  pinned: AiPinnedHall | null;
};

type UseAiChatInput = {
  sessionId: string | null;
  greeting: string;
  /** Latest validated page + pinned hall, evaluated at send time. */
  getContext?: () => AiTurnContextSnapshot;
  /**
   * Creates a fresh backend session after an expired/lost one (404). The visible
   * thread is untouched; the failed turn is retried exactly once with the new id.
   */
  renewSession?: () => Promise<string | null>;
  /** Called after a successful turn (slides the client-side session expiry). */
  onTurnSuccess?: () => void;
};

export type AiChatControls = {
  messages: AiChatMessage[];
  sendState: AiChatSendState;
  surface: AiChatSurface;
  isSending: boolean;
  isRecommending: boolean;
  canRetry: boolean;
  send: (text: string) => Promise<boolean>;
  /** Replays the last retryable turn in place — no page reload, no extra user bubble. */
  retry: () => Promise<boolean>;
  validate: (text: string) => string | null;
  /** Replaces the thread with a stored one (UI continuity); ignored once the user has chatted. */
  hydrate: (messages: AiChatMessage[]) => void;
};

const EMPTY_RECOMMENDATION = {
  halls: [] as AiChatMessage["halls"],
  recommendationStatus: null,
  criteria: null,
  lang: null,
  category: null,
  availability: null as AiChatMessage["availability"],
  actions: [] as AiChatMessage["actions"],
};

function greetingMessage(text: string): AiChatMessage {
  return {
    id: "greeting",
    role: "assistant",
    text,
    createdAt: new Date().toISOString(),
    variant: "default",
    ...EMPTY_RECOMMENDATION,
  };
}

function dropTrailingErrors(messages: AiChatMessage[]): AiChatMessage[] {
  const next = [...messages];
  while (
    next.length > 0 &&
    next[next.length - 1]?.role === "assistant" &&
    next[next.length - 1]?.variant === "error"
  ) {
    next.pop();
  }
  return next;
}

/** Reuse the open user turn after a failed send so a resubmit does not duplicate the bubble. */
function upsertUserTurn(messages: AiChatMessage[], text: string): AiChatMessage[] {
  const base = dropTrailingErrors(messages);
  const last = base[base.length - 1];
  if (last?.role === "user") {
    return [
      ...base.slice(0, -1),
      { ...last, text, createdAt: new Date().toISOString() },
    ];
  }
  return [
    ...base,
    {
      id: createChatMessageId(),
      role: "user",
      text,
      createdAt: new Date().toISOString(),
      variant: "default",
      ...EMPTY_RECOMMENDATION,
    },
  ];
}

/**
 * Owns the in-panel thread: send, loading, retry, and error bubbles. Mounted at the
 * provider level (not inside the panel), so closing the panel or navigating between
 * pages never erases the conversation. Session lifecycle stays in `useAiAssistant`;
 * this hook only talks once a session id exists, and recovers once from an expired
 * session.
 */
export function useAiChat({
  sessionId,
  greeting,
  getContext,
  renewSession,
  onTurnSuccess,
}: UseAiChatInput): AiChatControls {
  const [messages, setMessages] = useState<AiChatMessage[]>(() =>
    greeting ? [greetingMessage(greeting)] : [],
  );
  const [sendState, setSendState] = useState<AiChatSendState>("idle");
  const [canRetry, setCanRetry] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef(sessionId);
  const greetingRef = useRef(greeting);
  const lastPromptRef = useRef<string | null>(null);
  const getContextRef = useRef(getContext);
  const renewRef = useRef(renewSession);
  const successRef = useRef(onTurnSuccess);

  useEffect(() => {
    getContextRef.current = getContext;
    renewRef.current = renewSession;
    successRef.current = onTurnSuccess;
  });

  useEffect(() => {
    sessionRef.current = sessionId ?? sessionRef.current;
  }, [sessionId]);

  // Only a language change (new greeting) starts a fresh thread. A new session id on
  // its own — including one created by expired-session recovery — keeps the thread.
  useEffect(() => {
    const greetingChanged = greetingRef.current !== greeting;
    greetingRef.current = greeting;
    if (!greetingChanged) return;

    abortRef.current?.abort();
    abortRef.current = null;
    inFlightRef.current = false;
    lastPromptRef.current = null;
    setCanRetry(false);
    setIsRecommending(false);
    setSendState("idle");
    setMessages(greeting ? [greetingMessage(greeting)] : []);
  }, [greeting]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const hydrate = useCallback((restored: AiChatMessage[]) => {
    if (restored.length === 0) return;
    setMessages((current) => {
      // Never overwrite a conversation the user already started in this page load.
      if (current.some((message) => message.role === "user")) return current;
      const greetingOnly = current.filter((message) => message.id === "greeting");
      return [...greetingOnly, ...restored];
    });
  }, []);

  const dispatch = useCallback(
    async (raw: string, appendUser: boolean): Promise<boolean> => {
      if (inFlightRef.current) return false;
      if (!sessionRef.current) return false;

      const invalid = validateChatQuestion(raw);
      if (invalid) {
        setSendState("error");
        setCanRetry(false);
        lastPromptRef.current = null;
        setMessages((current) => [
          ...current,
          {
            id: createChatMessageId(),
            role: "assistant",
            text: invalid,
            createdAt: new Date().toISOString(),
            variant: "error",
            ...EMPTY_RECOMMENDATION,
          },
        ]);
        return false;
      }

      const text = raw.trim();
      inFlightRef.current = true;
      setCanRetry(false);
      setIsRecommending(isHallSearchQuestion(text));
      setSendState("sending");
      lastPromptRef.current = text;

      if (appendUser) {
        setMessages((current) => upsertUserTurn(current, text));
      } else {
        setMessages((current) => dropTrailingErrors(current));
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const context = getContextRef.current?.() ?? { page: null, pinned: null };
        const options = { signal: controller.signal, page: context.page, pinned: context.pinned };

        // Expired / lost session (404): ONE new session, same visible conversation, this
        // turn replayed once. A second failure surfaces as a normal retryable error.
        const { turn, sessionId: usedSession } = await sendTurnWithRecovery(
          sessionRef.current as string,
          text,
          options,
          renewRef.current,
        );
        if (controller.signal.aborted) return false;
        sessionRef.current = usedSession;

        if (turn.variant === "error") {
          setCanRetry(true);
          setMessages((current) => [
            ...current,
            {
              id: createChatMessageId(),
              role: "assistant",
              text: turn.text,
              createdAt: turn.timestamp,
              variant: "error",
              ...EMPTY_RECOMMENDATION,
            },
          ]);
          setSendState("error");
          return false;
        }

        lastPromptRef.current = null;
        successRef.current?.();
        setMessages((current) => [
          ...current,
          {
            id: createChatMessageId(),
            role: "assistant",
            text: turn.text,
            createdAt: turn.timestamp,
            variant: turn.variant,
            halls: turn.halls,
            recommendationStatus: turn.recommendationStatus,
            criteria: turn.criteria,
            lang: turn.lang,
            category: turn.category,
            availability: turn.availability,
            actions: turn.actions,
          },
        ]);
        setSendState("success");
        return true;
      } catch (err) {
        if (controller.signal.aborted) return false;
        const failure = describeChatError(err);
        setCanRetry(failure.retryable);
        setMessages((current) => [
          ...current,
          {
            id: createChatMessageId(),
            role: "assistant",
            text: failure.text,
            createdAt: new Date().toISOString(),
            variant: "error",
            ...EMPTY_RECOMMENDATION,
          },
        ]);
        setSendState("error");
        return false;
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        inFlightRef.current = false;
        setIsRecommending(false);
        setSendState((current) => (current === "sending" ? "idle" : current));
      }
    },
    [],
  );

  const send = useCallback((raw: string) => dispatch(raw, true), [dispatch]);

  const retry = useCallback(async () => {
    const prompt = lastPromptRef.current;
    if (!prompt || inFlightRef.current || !canRetry) return false;
    return dispatch(prompt, false);
  }, [canRetry, dispatch]);

  const surface = useMemo<AiChatSurface>(() => {
    if (sendState === "sending") return "loading";
    if (sendState === "error" && canRetry) return "failure";
    const hasUserTurn = messages.some((message) => message.role === "user");
    const hasInlineError = messages.some((message) => message.variant === "error");
    if (!hasUserTurn && !hasInlineError) return "empty";
    return "idle";
  }, [canRetry, messages, sendState]);

  return {
    messages,
    sendState,
    surface,
    isSending: sendState === "sending",
    isRecommending,
    canRetry,
    send,
    retry,
    validate: validateChatQuestion,
    hydrate,
  };
}
