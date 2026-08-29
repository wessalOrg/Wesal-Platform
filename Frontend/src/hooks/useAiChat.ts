"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createChatMessageId,
  describeChatError,
  isHallSearchQuestion,
  sendAiChatTurn,
  validateChatQuestion,
} from "@/services/ai-chat";
import type { AiChatMessage, AiChatSendState, AiChatSurface } from "@/types/ai-chat";

type UseAiChatInput = {
  sessionId: string | null;
  greeting: string;
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
};

const EMPTY_RECOMMENDATION = {
  halls: [] as AiChatMessage["halls"],
  recommendationStatus: null,
  criteria: null,
  lang: null,
  category: null,
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
 * Owns the in-panel thread: send, loading, retry, and error bubbles. Session
 * lifecycle stays in `useAiAssistant`; this hook only talks once a session id exists.
 */
export function useAiChat({ sessionId, greeting }: UseAiChatInput): AiChatControls {
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

  useEffect(() => {
    const sessionChanged = sessionRef.current !== sessionId;
    const greetingChanged = greetingRef.current !== greeting;
    sessionRef.current = sessionId;
    greetingRef.current = greeting;

    if (!sessionChanged && !greetingChanged) return;

    abortRef.current?.abort();
    abortRef.current = null;
    inFlightRef.current = false;
    lastPromptRef.current = null;
    setCanRetry(false);
    setIsRecommending(false);
    setSendState("idle");
    setMessages(greeting ? [greetingMessage(greeting)] : []);
  }, [sessionId, greeting]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const dispatch = useCallback(
    async (raw: string, appendUser: boolean): Promise<boolean> => {
      if (inFlightRef.current) return false;
      if (!sessionId) return false;

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
        const turn = await sendAiChatTurn(sessionId, text, controller.signal);
        if (controller.signal.aborted) return false;

        if (turn.variant === "error") {
          setCanRetry(!turn.sessionExpired);
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
    [sessionId],
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
  };
}
