"use client";

import { useEffect, useRef } from "react";
import { fetchConversationThread } from "@/services/conversations";
import type { ThreadMessage } from "@/types/messages";

const PULL_MS = 12000;

/**
 * Picks up deferred booking-rejection messages that land on the next thread
 * fetch (backend delivers pending notifications on GET) without a socket event.
 */
export function useThreadDeliverySync(
  conversationId: string | null,
  ownerKey: string | null,
  enabled: boolean,
  onNewMessage: (message: ThreadMessage, conversationId: string) => void,
) {
  const knownRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  const handlerRef = useRef(onNewMessage);

  useEffect(() => {
    handlerRef.current = onNewMessage;
  }, [onNewMessage]);

  useEffect(() => {
    knownRef.current = new Set();
    primedRef.current = false;
  }, [conversationId, ownerKey]);

  useEffect(() => {
    if (!conversationId || !ownerKey || !enabled) return;

    let cancelled = false;

    const pull = () => {
      void fetchConversationThread(conversationId)
        .then((data) => {
          if (cancelled) return;
          if (!primedRef.current) {
            knownRef.current = new Set(data.messages.map((item) => item.id));
            primedRef.current = true;
            return;
          }
          for (const message of data.messages) {
            if (knownRef.current.has(message.id)) continue;
            knownRef.current.add(message.id);
            handlerRef.current(message, conversationId);
          }
        })
        .catch(() => undefined);
    };

    pull();
    const first = window.setTimeout(pull, 2500);
    const timer = window.setInterval(pull, PULL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") pull();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", pull);

    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", pull);
    };
  }, [conversationId, enabled, ownerKey]);
}
