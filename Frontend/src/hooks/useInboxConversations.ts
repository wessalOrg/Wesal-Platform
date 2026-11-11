"use client";

import { useCallback, useEffect, useState } from "react";
import { conversationTimeValue } from "@/lib/conversation-mapper";
import {
  conversationErrorMessage,
  fetchInboxConversations,
  fetchMyAdminAccountConversation,
} from "@/services/conversations";
import type { ConversationSummary, InboxStatus } from "@/types/messages";

function mergeAdminAccountRow(
  items: ConversationSummary[],
  adminRow: ConversationSummary | null,
): ConversationSummary[] {
  if (!adminRow) return items;
  const withoutDup = items.filter(
    (item) => item.conversationId !== adminRow.conversationId && item.kind !== "AdminAccount",
  );
  const existing = items.find((item) => item.conversationId === adminRow.conversationId);
  const merged: ConversationSummary = existing
    ? {
        ...existing,
        kind: "AdminAccount",
        hallId: "",
        hallName: "",
        otherParticipantId: existing.otherParticipantId || "admin",
        otherParticipantName: adminRow.otherParticipantName,
      }
    : adminRow;
  return [merged, ...withoutDup].sort(
    (left, right) =>
      conversationTimeValue(right.lastMessageAt ?? right.createdAt) -
      conversationTimeValue(left.lastMessageAt ?? left.createdAt),
  );
}

async function loadInbox(includeAdminAccount: boolean): Promise<ConversationSummary[]> {
  const items = await fetchInboxConversations();
  if (!includeAdminAccount) return items;
  try {
    const adminRow = await fetchMyAdminAccountConversation();
    return mergeAdminAccountRow(items, adminRow);
  } catch {
    return items;
  }
}

/**
 * Inbox list for a single auth session. Closing the panel (`active=false`)
 * parks the data; logout (`ownerKey=null`) wipes it.
 */
export function useInboxConversations(
  ownerKey: string | null,
  active: boolean,
  includeAdminAccount = false,
) {
  const [retryTick, setRetryTick] = useState(0);
  const resetKey = ownerKey
    ? `${ownerKey}:${includeAdminAccount ? "admin" : "plain"}:${retryTick}`
    : null;
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
    void loadInbox(includeAdminAccount)
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
  }, [ownerKey, active, retryTick, includeAdminAccount]);

  const refresh = useCallback(() => {
    if (!ownerKey) return;
    void loadInbox(includeAdminAccount)
      .then((items) => {
        setConversations(items);
        setStatus(items.length === 0 ? "empty" : "ready");
        setError(null);
      })
      .catch(() => undefined);
  }, [ownerKey, includeAdminAccount]);

  const markLocalRead = useCallback((conversationId: string) => {
    setConversations((current) =>
      current.map((item) =>
        item.conversationId === conversationId
          ? { ...item, isUnread: false, unreadMessageCount: 0 }
          : item,
      ),
    );
  }, []);

  const applyUnreadCount = useCallback(
    (conversationId: string | null | undefined, unreadMessageCount: number) => {
      if (!conversationId) return;
      const count = Math.max(0, unreadMessageCount);
      setConversations((current) =>
        current.map((item) =>
          item.conversationId === conversationId
            ? { ...item, unreadMessageCount: count, isUnread: count > 0 }
            : item,
        ),
      );
    },
    [],
  );

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
              unreadMessageCount: unread
                ? Math.max(1, (item.unreadMessageCount || 0) + 1)
                : 0,
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
    applyUnreadCount,
    markLocalRead,
  };
}
