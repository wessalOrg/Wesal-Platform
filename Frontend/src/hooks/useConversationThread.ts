"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  conversationErrorMessage,
  fetchConversationThread,
  sendConversationMessage,
} from "@/services/conversations";
import {
  localsStillOpen,
  mergeServerMessages,
  upsertThreadMessage,
} from "@/lib/thread-messages";
import type { MessageThread, ThreadMessage, ThreadStatus } from "@/types/messages";

function newClientRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useConversationThread(
  conversationId: string | null,
  ownerKey: string | null,
  refreshEpoch = 0,
) {
  const [retryTick, setRetryTick] = useState(0);
  const requestKey = ownerKey && conversationId ? `${ownerKey}:${conversationId}:${retryTick}` : null;
  const [seenKey, setSeenKey] = useState<string | null>(null);
  const [status, setStatus] = useState<ThreadStatus>("idle");
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const localsRef = useRef<Record<string, ThreadMessage[]>>({});
  const sendingRef = useRef<Set<string>>(new Set());

  if (requestKey !== seenKey) {
    setSeenKey(requestKey);
    setStatus(requestKey ? "loading" : "idle");
    setThread(null);
    setError(null);
  }

  useEffect(() => {
    localsRef.current = {};
    sendingRef.current = new Set();
  }, [ownerKey]);

  useEffect(() => {
    if (!conversationId || !ownerKey || requestKey === null) return;

    let cancelled = false;
    void fetchConversationThread(conversationId)
      .then((data) => {
        if (cancelled) return;
        const merged = mergeServerMessages(data.messages, localsRef.current[conversationId] ?? []);
        localsRef.current[conversationId] = localsStillOpen(merged);
        setThread({ ...data, messages: merged });
        setStatus(merged.length === 0 ? "empty" : "ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setThread(null);
        setError(conversationErrorMessage(err, "thread"));
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, ownerKey, requestKey, refreshEpoch]);

  const applyIncoming = useCallback(
    (incoming: ThreadMessage, forConversationId: string) => {
      if (!forConversationId) return;
      localsRef.current[forConversationId] = upsertThreadMessage(
        localsRef.current[forConversationId] ?? [],
        { ...incoming, delivery: incoming.delivery ?? "sent" },
      );
      setThread((current) => {
        if (!current || current.conversationId !== forConversationId) return current;
        const messages = upsertThreadMessage(current.messages, {
          ...incoming,
          delivery: incoming.delivery ?? "sent",
        });
        return { ...current, messages };
      });
      setStatus((current) => (current === "error" || current === "idle" ? current : "ready"));
    },
    [],
  );

  const send = useCallback(
    async (raw: string, currentUserId: string | null, senderName: string) => {
      if (!conversationId || !ownerKey) return false;
      const content = raw.trim();
      if (!content) return false;

      const clientRequestId = newClientRequestId();
      const pending: ThreadMessage = {
        id: `local:${clientRequestId}`,
        clientRequestId,
        senderUserId: currentUserId ?? "",
        senderName,
        content,
        sentAt: new Date().toISOString(),
        delivery: "pending",
      };
      localsRef.current[conversationId] = upsertThreadMessage(
        localsRef.current[conversationId] ?? [],
        pending,
      );
      setThread((current) => {
        if (!current || current.conversationId !== conversationId) {
          return {
            conversationId,
            hallId: "",
            hallName: "",
            messages: [pending],
          };
        }
        return { ...current, messages: upsertThreadMessage(current.messages, pending) };
      });
      setStatus("ready");

      sendingRef.current.add(clientRequestId);
      try {
        const saved = await sendConversationMessage(conversationId, content, clientRequestId);
        applyIncoming({ ...saved, clientRequestId }, conversationId);
        return true;
      } catch {
        const failed: ThreadMessage = { ...pending, delivery: "failed" };
        localsRef.current[conversationId] = upsertThreadMessage(
          localsRef.current[conversationId] ?? [],
          failed,
        );
        setThread((current) => {
          if (!current || current.conversationId !== conversationId) return current;
          return { ...current, messages: upsertThreadMessage(current.messages, failed) };
        });
        return false;
      } finally {
        sendingRef.current.delete(clientRequestId);
      }
    },
    [applyIncoming, conversationId, ownerKey],
  );

  const retrySend = useCallback(
    async (messageId: string) => {
      if (!conversationId || !ownerKey) return;
      const pool = [
        ...(thread?.messages ?? []),
        ...(conversationId ? localsRef.current[conversationId] ?? [] : []),
      ];
      const current = pool.find(
        (item) => item.id === messageId || item.clientRequestId === messageId,
      );
      if (!current?.clientRequestId || current.delivery !== "failed") return;
      if (sendingRef.current.has(current.clientRequestId)) return;

      const pending: ThreadMessage = { ...current, delivery: "pending" };
      localsRef.current[conversationId] = upsertThreadMessage(
        localsRef.current[conversationId] ?? [],
        pending,
      );
      setThread((live) => {
        if (!live || live.conversationId !== conversationId) return live;
        return { ...live, messages: upsertThreadMessage(live.messages, pending) };
      });

      sendingRef.current.add(current.clientRequestId);
      try {
        const saved = await sendConversationMessage(
          conversationId,
          current.content,
          current.clientRequestId,
        );
        applyIncoming({ ...saved, clientRequestId: current.clientRequestId }, conversationId);
      } catch {
        const failed: ThreadMessage = { ...pending, delivery: "failed" };
        localsRef.current[conversationId] = upsertThreadMessage(
          localsRef.current[conversationId] ?? [],
          failed,
        );
        setThread((live) => {
          if (!live || live.conversationId !== conversationId) return live;
          return { ...live, messages: upsertThreadMessage(live.messages, failed) };
        });
      } finally {
        sendingRef.current.delete(current.clientRequestId);
      }
    },
    [applyIncoming, conversationId, ownerKey, thread],
  );

  return {
    status,
    thread,
    error,
    retry: () => setRetryTick((n) => n + 1),
    applyIncoming,
    send,
    retrySend,
  };
}
