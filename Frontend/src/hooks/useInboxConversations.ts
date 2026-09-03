"use client";

import { useCallback, useEffect, useState } from "react";
import { conversationErrorMessage, fetchInboxConversations } from "@/services/conversations";
import type { ConversationSummary, InboxStatus } from "@/types/messages";

/**
 * Inbox list for a single auth session. Closing the panel (`active=false`)
 * parks the data; logout (`ownerKey=null`) wipes it.
 */
export function useInboxConversations(ownerKey: string | null, active: boolean) {
  const [retryTick, setRetryTick] = useState(0);
  const resetKey = ownerKey ? `${ownerKey}:${retryTick}` : null;
  const [seenKey, setSeenKey] = useState<string | null>(null);
  const [status, setStatus] = useState<InboxStatus>("idle");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (resetKey !== seenKey) {
    setSeenKey(resetKey);
    setStatus(resetKey ? "loading" : "idle");
    setConversations([]);
    setError(null);
  }

  useEffect(() => {
    if (!ownerKey || !active) return;

    let cancelled = false;
    void fetchInboxConversations()
      .then((items) => {
        if (cancelled) return;
        setConversations(items);
        setStatus(items.length === 0 ? "empty" : "ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setConversations([]);
        setError(conversationErrorMessage(err, "inbox"));
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [ownerKey, active, retryTick]);

  const applyPreview = useCallback((conversationId: string, preview: string, at: string) => {
    setConversations((current) => {
      const next = current.map((item) =>
        item.conversationId === conversationId
          ? {
              ...item,
              lastMessagePreview: preview,
              lastMessageAt: at,
            }
          : item,
      );
      return [...next].sort(
        (left, right) =>
          Date.parse(right.lastMessageAt ?? right.createdAt) -
          Date.parse(left.lastMessageAt ?? left.createdAt),
      );
    });
    setStatus((current) => (current === "empty" ? "ready" : current));
  }, []);

  return {
    status,
    conversations,
    error,
    retry: () => setRetryTick((n) => n + 1),
    applyPreview,
  };
}
