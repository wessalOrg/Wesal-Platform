"use client";

import { useCallback, useEffect, useState } from "react";
import type { ThreadMessage } from "@/types/messages";

function messageKey(message: ThreadMessage): string {
  return message.clientRequestId || message.id;
}

/** Local retrying overlay on Lilian's pending delivery — no API changes. */
export function useRetryingMessages(messages: ThreadMessage[]) {
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setIds((current) => {
      if (current.size === 0) return current;
      const next = new Set<string>();
      for (const id of current) {
        const match = messages.find((item) => item.id === id || item.clientRequestId === id);
        if (match?.delivery === "pending") next.add(id);
      }
      if (next.size === current.size && [...next].every((id) => current.has(id))) return current;
      return next;
    });
  }, [messages]);

  const markRetrying = useCallback((id: string) => {
    setIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const isRetrying = useCallback(
    (message: ThreadMessage) => ids.has(messageKey(message)) && message.delivery === "pending",
    [ids],
  );

  return { markRetrying, isRetrying };
}
