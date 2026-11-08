"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversationRealtime } from "@/hooks/useConversationRealtime";
import { useThreadDeliverySync } from "@/hooks/useThreadDeliverySync";
import { toAdminOwnerMessageError } from "@/lib/admin-owner-message-errors";
import { localsStillOpen, mergeServerMessages, upsertThreadMessage } from "@/lib/thread-messages";
import { sendAdminHallMessage } from "@/services/admin-halls";
import {
  fetchConversationThread,
  fetchInboxConversations,
  sendConversationMessage,
} from "@/services/conversations";
import type { AdminOwnerMessageTarget } from "@/types/admin-halls";
import type { MessageThread, ThreadMessage, ThreadStatus } from "@/types/messages";

function newClientRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyThread(target: AdminOwnerMessageTarget, conversationId = ""): MessageThread {
  return {
    conversationId,
    hallId: target.hallId,
    hallName: target.hallName,
    messages: [],
  };
}

export function useAdminOwnerThread(
  target: AdminOwnerMessageTarget | null,
  sessionKey: string | null,
) {
  const hallId = target?.hallId?.trim() || null;
  const focusConversationId = target?.conversationId?.trim() || null;
  const [retryTick, setRetryTick] = useState(0);
  const requestKey =
    sessionKey && (hallId || focusConversationId)
      ? `${sessionKey}:${hallId ?? ""}:${focusConversationId ?? ""}:${retryTick}`
      : null;
  const [seenKey, setSeenKey] = useState<string | null>(null);
  const [status, setStatus] = useState<ThreadStatus>("idle");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [deliveryPending, setDeliveryPending] = useState(false);
  const [sending, setSending] = useState(false);
  const localsRef = useRef<Record<string, ThreadMessage[]>>({});
  const sendingRef = useRef<Set<string>>(new Set());
  const hallIdRef = useRef(hallId);
  const conversationIdRef = useRef(conversationId);
  useEffect(() => {
    hallIdRef.current = hallId;
  });
  useEffect(() => {
    conversationIdRef.current = conversationId;
  });

  if (requestKey !== seenKey) {
    setSeenKey(requestKey);
    setStatus(requestKey ? "loading" : "idle");
    setConversationId(focusConversationId);
    setThread(null);
    setErrorKey(null);
    setDeliveryPending(false);
    setSending(false);
  }

  useEffect(() => {
    localsRef.current = {};
    sendingRef.current = new Set();
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionKey || !target || requestKey === null) return;
    const scoped = target;

    let cancelled = false;
    void (async () => {
      try {
        if (focusConversationId && !hallId) {
          setConversationId(focusConversationId);
          const data = await fetchConversationThread(focusConversationId);
          if (cancelled) return;
          const merged = mergeServerMessages(
            data.messages,
            localsRef.current[focusConversationId] ?? [],
          );
          localsRef.current[focusConversationId] = localsStillOpen(merged);
          setThread({
            ...data,
            hallId: data.hallId || scoped.hallId,
            hallName: data.hallName || scoped.hallName || scoped.ownerName || "",
            messages: merged,
          });
          setStatus(merged.length === 0 ? "empty" : "ready");
          return;
        }

        if (!hallId) {
          setConversationId(null);
          setThread(emptyThread(scoped));
          setStatus("empty");
          return;
        }

        const inbox = await fetchInboxConversations();
        if (cancelled) return;
        const match =
          inbox.find((item) => item.hallId.toLowerCase() === hallId.toLowerCase()) ?? null;
        if (!match) {
          setConversationId(null);
          setThread(emptyThread(scoped));
          setStatus("empty");
          return;
        }

        setConversationId(match.conversationId);
        const data = await fetchConversationThread(match.conversationId);
        if (cancelled) return;
        const merged = mergeServerMessages(
          data.messages,
          localsRef.current[match.conversationId] ?? [],
        );
        localsRef.current[match.conversationId] = localsStillOpen(merged);
        setThread({
          ...data,
          hallId: data.hallId || scoped.hallId,
          hallName: data.hallName || scoped.hallName,
          messages: merged,
        });
        setStatus(merged.length === 0 ? "empty" : "ready");
      } catch {
        if (cancelled) return;
        setConversationId(focusConversationId);
        setThread(emptyThread(scoped, focusConversationId ?? ""));
        setStatus("empty");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [focusConversationId, hallId, requestKey, sessionKey, target]);

  const applyIncoming = useCallback((incoming: ThreadMessage, forConversationId: string) => {
    if (!forConversationId) return;
    localsRef.current[forConversationId] = upsertThreadMessage(
      localsRef.current[forConversationId] ?? [],
      { ...incoming, delivery: incoming.delivery ?? "sent" },
    );
    setThread((current) => {
      if (!current) return current;
      const messages = upsertThreadMessage(current.messages, {
        ...incoming,
        delivery: incoming.delivery ?? "sent",
      });
      return { ...current, conversationId: forConversationId, messages };
    });
    setConversationId((current) => current || forConversationId);
    setStatus((current) => (current === "error" || current === "idle" ? current : "ready"));
  }, []);

  useConversationRealtime(conversationId, sessionKey, (payload) => {
    applyIncoming(payload.message, payload.conversationId);
  });

  useThreadDeliverySync(
    conversationId,
    sessionKey,
    status === "ready" || status === "empty",
    (message, id) => {
      applyIncoming(message, id);
    },
  );

  const send = useCallback(
    async (raw: string, currentUserId: string | null, senderName: string) => {
      const scopedHallId = hallIdRef.current;
      const scopedConversationId = conversationIdRef.current;
      if ((!scopedHallId && !scopedConversationId) || !sessionKey || !target) return false;
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
      const localKey = scopedConversationId || scopedHallId || "thread";
      localsRef.current[localKey] = upsertThreadMessage(localsRef.current[localKey] ?? [], pending);
      setThread((current) => {
        if (!current) {
          return {
            ...emptyThread(target, scopedConversationId ?? ""),
            messages: [pending],
          };
        }
        return { ...current, messages: upsertThreadMessage(current.messages, pending) };
      });
      setStatus("ready");
      setErrorKey(null);

      sendingRef.current.add(clientRequestId);
      setSending(true);
      try {
        if (scopedHallId) {
          const saved = await sendAdminHallMessage(scopedHallId, content);
          if (saved.deliveryPending || saved.ownerBlocked) {
            setDeliveryPending(true);
          }
          setConversationId(saved.conversationId);
          applyIncoming(
            {
              id: saved.messageId,
              clientRequestId,
              senderUserId: currentUserId ?? "",
              senderName,
              content: saved.content,
              sentAt: saved.sentAt,
              delivery: "sent",
            },
            saved.conversationId,
          );
          return true;
        }

        const saved = await sendConversationMessage(
          scopedConversationId!,
          content,
          clientRequestId,
        );
        applyIncoming(
          {
            ...saved,
            clientRequestId,
            senderUserId: saved.senderUserId || currentUserId || "",
            senderName: saved.senderName || senderName,
            delivery: "sent",
          },
          scopedConversationId!,
        );
        return true;
      } catch (err) {
        const mapped = toAdminOwnerMessageError(err);
        setErrorKey(mapped.message);
        const failed: ThreadMessage = { ...pending, delivery: "failed" };
        localsRef.current[localKey] = upsertThreadMessage(localsRef.current[localKey] ?? [], failed);
        setThread((current) => {
          if (!current) return current;
          return { ...current, messages: upsertThreadMessage(current.messages, failed) };
        });
        return false;
      } finally {
        sendingRef.current.delete(clientRequestId);
        setSending(sendingRef.current.size > 0);
      }
    },
    [applyIncoming, conversationId, sessionKey, target],
  );

  const retrySend = useCallback(
    async (messageId: string, currentUserId: string | null, senderName: string) => {
      if (!hallId || !sessionKey || !target) return;
      const pool = [
        ...(thread?.messages ?? []),
        ...(conversationId ? localsRef.current[conversationId] ?? [] : []),
        ...((localsRef.current[hallId] ?? []) as ThreadMessage[]),
      ];
      const current = pool.find(
        (item) => item.id === messageId || item.clientRequestId === messageId,
      );
      if (!current?.clientRequestId || current.delivery !== "failed") return;
      if (sendingRef.current.has(current.clientRequestId)) return;

      sendingRef.current.add(current.clientRequestId);
      setSending(true);
      const pending: ThreadMessage = { ...current, delivery: "pending" };
      const localKey = conversationId || hallId;
      localsRef.current[localKey] = upsertThreadMessage(localsRef.current[localKey] ?? [], pending);
      setThread((live) => {
        if (!live) return live;
        return { ...live, messages: upsertThreadMessage(live.messages, pending) };
      });
      setErrorKey(null);

      try {
        const saved = await sendAdminHallMessage(hallId, current.content);
        if (saved.deliveryPending || saved.ownerBlocked) {
          setDeliveryPending(true);
        }
        setConversationId(saved.conversationId);
        applyIncoming(
          {
            id: saved.messageId,
            clientRequestId: current.clientRequestId,
            senderUserId: currentUserId ?? current.senderUserId,
            senderName: senderName || current.senderName,
            content: saved.content,
            sentAt: saved.sentAt,
            delivery: "sent",
          },
          saved.conversationId,
        );
      } catch (err) {
        const mapped = toAdminOwnerMessageError(err);
        setErrorKey(mapped.message);
        const failed: ThreadMessage = { ...pending, delivery: "failed" };
        localsRef.current[localKey] = upsertThreadMessage(localsRef.current[localKey] ?? [], failed);
        setThread((live) => {
          if (!live) return live;
          return { ...live, messages: upsertThreadMessage(live.messages, failed) };
        });
      } finally {
        sendingRef.current.delete(current.clientRequestId);
        setSending(sendingRef.current.size > 0);
      }
    },
    [applyIncoming, conversationId, hallId, sessionKey, target, thread],
  );

  return {
    status,
    thread,
    conversationId,
    errorKey,
    deliveryPending,
    sending,
    retry: () => setRetryTick((n) => n + 1),
    send,
    retrySend,
  };
}
