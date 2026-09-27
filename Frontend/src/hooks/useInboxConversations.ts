"use client";

import { useCallback, useEffect, useState } from "react";
import { conversationTimeValue } from "@/lib/conversation-mapper";
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

  const refresh = useCallback(() => {
    if (!ownerKey) return;
    void fetchInboxConversations()
      .then((items) => {
        setConversations(items);
        setStatus(items.length === 0 ? "empty" : "ready");
        setError(null);
      })
      .catch(() => undefined);
  }, [ownerKey]);

  const markLocalRead = useCallback((conversationId: string) => {
    setConversations((current) =>
      current.map((item) =>
        item.conversationId === conversationId ? { ...item, isUnread: false } : item,
      ),
    );
  }, []);

  const applyPreview = useCallback((
    conversationId: string,
    preview: string,
    at: string,
    unread = true,
    hasAttachment = false,
  ) => {
    setConversations((current) => {
      const next = current.map((item) =>
        item.conversationId === conversationId
          ? {
              ...item,
              lastMessagePreview: preview,
              lastMessageHasAttachment: hasAttachment,
              lastMessageAt: at,
              isUnread: unread,
            }
          : item,
      );
      return [...next].sort(
        (left, right) =>
          conversationTimeValue(right.lastMessageAt ?? right.createdAt) -
          conversationTimeValue(left.lastMessageAt ?? left.createdAt),
      );
    });
    setStatus((current) => (current === "empty" ? "ready" : current));
  }, []);

  return {
    status,
    conversations,
    error,
    retry: () => setRetryTick((n) => n + 1),
    refresh,
    applyPreview,
    markLocalRead,
  };
}
