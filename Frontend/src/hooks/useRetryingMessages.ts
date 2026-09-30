"use client";

import { useCallback, useMemo, useState } from "react";
import type { ThreadMessage } from "@/types/messages";

function messageKey(message: ThreadMessage): string {
  return message.clientRequestId || message.id;
}

/** Local retrying overlay on Lilian's pending delivery — no API changes. */
export function useRetryingMessages(messages: ThreadMessage[]) {
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  // Only pending messages still count as retrying; the rest stay in `ids`
  // until remount (tiny set) so we never prune during render or in an effect.
  const pendingKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const message of messages) {
      if (message.delivery === "pending") keys.add(messageKey(message));
    }
    return keys;
  }, [messages]);

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
