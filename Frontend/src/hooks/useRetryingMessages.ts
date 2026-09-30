"use client";

import { useCallback, useMemo, useState } from "react";
import type { ThreadMessage } from "@/types/messages";

function messageKey(message: ThreadMessage): string {
  return message.clientRequestId || message.id;
}

function retrySignature(messages: ThreadMessage[]): string {
  return messages
    .map((item) => `${item.id}\0${item.clientRequestId ?? ""}\0${item.delivery ?? ""}`)
    .join("\n");
}

function pruneRetryingIds(current: Set<string>, messages: ThreadMessage[]): Set<string> {
  if (current.size === 0) return current;
  const next = new Set<string>();
  for (const id of current) {
    const match = messages.find((item) => item.id === id || item.clientRequestId === id);
    if (match?.delivery === "pending") next.add(id);
  }
  if (next.size === current.size && [...next].every((id) => current.has(id))) return current;
  return next;
}

/** Local retrying overlay on pending delivery — no API changes. */
export function useRetryingMessages(messages: ThreadMessage[]) {
  const signature = retrySignature(messages);
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const pendingKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const message of messages) {
      if (message.delivery === "pending") keys.add(messageKey(message));
    }
    return keys;
  }, [messages]);
  const [prevSignature, setPrevSignature] = useState(signature);
  if (prevSignature !== signature) {
    setPrevSignature(signature);
    setIds((current) => pruneRetryingIds(current, messages));
  }

  const markRetrying = useCallback((id: string) => {
    setIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const isRetrying = useCallback(
    (message: ThreadMessage) =>
      ids.has(messageKey(message)) && pendingKeys.has(messageKey(message)),
    [ids, pendingKeys],
  );

  return { markRetrying, isRetrying };
}
