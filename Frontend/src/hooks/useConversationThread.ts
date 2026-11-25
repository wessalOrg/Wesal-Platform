"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  conversationErrorMessage,
  fetchConversationThread,
  markConversationAsRead,
  sendConversationAttachment,
  sendConversationMessage,
} from "@/services/conversations";
import { isForbiddenApiError } from "@/lib/api-error";
import { notifyHallOwnerHallsChanged } from "@/lib/hall-owner-halls-events";
import { isPaymentRequiredApiError } from "@/lib/payment-required-error";
import { isSystemLockedApiError } from "@/lib/system-locked-error";
import { chatAttachmentFailure } from "@/lib/chat-image-message";
import { localsStillOpen, mergeServerMessages, upsertThreadMessage } from "@/lib/thread-messages";
import { createRequestScope } from "@/lib/request-scope";
import {
  isCurrentAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount,
  subscribeAuthenticatedAccount, type AuthenticatedAccount,
} from "@/lib/authenticated-account";
import type { MessageThread, ThreadMessage, ThreadStatus } from "@/types/messages";

function newClientRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Files stay in memory only, for the lifetime of this continuous login and hook. */
function createThreadSession(account: AuthenticatedAccount | null, ownerKey: string | null) {
  const scope = createRequestScope();
  let controller = new AbortController();
  const locals: Record<string, ThreadMessage[]> = {};
  const attachments = new Map<string, { conversationId: string; file: File; content: string }>();
  const validOwner = account && (ownerKey === account.userId || ownerKey === account.token);
  let visible: { conversationId: string | null; enabled: boolean } | null = null;
  return {
    messages: (conversationId: string) => locals[conversationId] ?? [],
    replaceMessages(conversationId: string, messages: ThreadMessage[]) { locals[conversationId] = messages; },
    sending: new Set<string>(),
    attachments,
    current: () => Boolean(validOwner && scope.isActive() && isCurrentAuthenticatedAccount(account)),
    showing: (conversationId: string) => Boolean(visible?.enabled && visible.conversationId === conversationId),
    show(conversationId: string | null, enabled: boolean) {
      const view = { conversationId, enabled };
      visible = view;
      return () => { if (visible === view) visible = null; };
    },
    get signal() { return controller.signal; },
    activate() {
      if (controller.signal.aborted) controller = new AbortController();
      scope.activate();
    },
    invalidate() { scope.dispose(); controller.abort(); attachments.clear(); visible = null; },
  };
}

export function useConversationThread(
  conversationId: string | null,
  ownerKey: string | null,
  refreshEpoch = 0,
  enabled = true,
) {
  const account = useSyncExternalStore(subscribeAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount);
  const session = useMemo(() => createThreadSession(account, ownerKey), [account, ownerKey]);
  const conversationScope = useMemo(() => ({ conversationId, session, enabled, ...createRequestScope() }), [conversationId, session, enabled]);
  useLayoutEffect(() => {
    session.activate();
    const unsubscribe = subscribeAuthenticatedAccount(() => {
      if (!isCurrentAuthenticatedAccount(account)) session.invalidate();
    });
    return () => { unsubscribe(); session.invalidate(); };
  }, [account, session]);
  useLayoutEffect(() => {
    conversationScope.activate();
    const leave = session.show(conversationId, enabled);
    return () => { conversationScope.dispose(); leave(); };
  }, [conversationId, conversationScope, enabled, session]);

  const currentConversation = useCallback(() =>
    Boolean(enabled && conversationId && conversationScope.isActive() && session.current()),
  [conversationId, conversationScope, enabled, session]);
  const [retryTick, setRetryTick] = useState(0);
  const requestKey = enabled && ownerKey && conversationId ? `${ownerKey}:${conversationId}:${retryTick}` : null;
  const [seenKey, setSeenKey] = useState<string | null>(null);
  const [seenSession, setSeenSession] = useState(session);
  const [status, setStatus] = useState<ThreadStatus>("idle");
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (requestKey !== seenKey || session !== seenSession) {
    setSeenKey(requestKey);
    setSeenSession(session);
    setStatus(requestKey ? "loading" : "idle");
    setThread(null);
    setError(null);
  }

  useEffect(() => {
    if (!conversationId || !currentConversation()) return;
    let cancelled = false;
    void fetchConversationThread(conversationId).then((data) => {
      if (cancelled || !currentConversation()) return;
      const merged = mergeServerMessages(data?.messages ?? [], session.messages(conversationId));
      session.replaceMessages(conversationId, localsStillOpen(merged));
      setThread({ ...data, messages: merged });
      setStatus(merged.length === 0 ? "empty" : "ready");
      void markConversationAsRead(conversationId).catch(() => undefined);
    }).catch((err) => {
      if (cancelled || !currentConversation()) return;
      setThread(null);
      setError(conversationErrorMessage(err, "thread"));
      setStatus("error");
      if (isPaymentRequiredApiError(err) || isSystemLockedApiError(err) || isForbiddenApiError(err)) notifyHallOwnerHallsChanged();
    });
    return () => { cancelled = true; };
  }, [conversationId, currentConversation, requestKey, refreshEpoch, session]);

  const applyIncoming = useCallback((incoming: ThreadMessage, forConversationId: string, createIfMissing = false) => {
    if (!forConversationId || !session.current()) return;
    const message = { ...incoming, delivery: incoming.delivery ?? "sent" };
    session.replaceMessages(forConversationId, upsertThreadMessage(session.messages(forConversationId), message));
    // An upload can finish for a parked conversation, but must not change the visible one.
    if (!session.showing(forConversationId)) return;
    setThread((current) => {
      if (!session.current() || !session.showing(forConversationId)) return current;
      if (!current || current.conversationId !== forConversationId) {
        return createIfMissing ? { conversationId: forConversationId, hallId: "", hallName: "", messages: [message] } : current;
      }
      return { ...current, messages: upsertThreadMessage(current.messages, message) };
    });
    setStatus((current) => {
      if (!session.current() || !session.showing(forConversationId)) return current;
      if (createIfMissing) return "ready";
      return current === "error" || current === "idle" ? current : "ready";
    });
  }, [session]);

  /** Initial sends and retries share the same lock, transport selection and reconciliation. */
  const transmit = useCallback(async (message: ThreadMessage, file?: File): Promise<boolean> => {
    const clientRequestId = message.clientRequestId;
    if (!conversationId || !clientRequestId || !currentConversation() || session.sending.has(clientRequestId)) return false;
    if (message.hasAttachment && !file) {
      applyIncoming({ ...message, delivery: "failed", retryError: "attachment-unavailable" }, conversationId);
      return false;
    }
    const pending: ThreadMessage = { ...message, delivery: "pending", retryError: undefined };
    session.sending.add(clientRequestId);
    applyIncoming(pending, conversationId, true);
    try {
      const saved = pending.hasAttachment && file
        ? await sendConversationAttachment(conversationId, file, pending.content, clientRequestId, session.signal)
        : await sendConversationMessage(conversationId, pending.content, clientRequestId, session.signal);
      if (!session.current()) return false;
      session.attachments.delete(clientRequestId);
      applyIncoming({ ...saved, clientRequestId, localPreviewFile: pending.localPreviewFile, retryError: undefined }, conversationId);
      return currentConversation();
    } catch (error) {
      applyIncoming({ ...pending, delivery: "failed", retryError: pending.hasAttachment ? chatAttachmentFailure(error) : undefined }, conversationId);
      return false;
    } finally {
      session.sending.delete(clientRequestId);
    }
  }, [applyIncoming, conversationId, currentConversation, session]);

  const send = useCallback(async (raw: string, currentUserId: string | null, senderName: string) => {
    const content = (raw ?? "").trim();
    if (!content || !currentConversation()) return false;
    const clientRequestId = newClientRequestId();
    return transmit({ id: `local:${clientRequestId}`, clientRequestId, senderUserId: currentUserId ?? "", senderName,
      content, sentAt: new Date().toISOString(), delivery: "pending" });
  }, [currentConversation, transmit]);

  const sendAttachment = useCallback(async (file: File, raw: string, currentUserId: string | null, senderName: string) => {
    if (!conversationId || !currentConversation()) return false;
    const content = (raw ?? "").trim(), clientRequestId = newClientRequestId();
    session.attachments.set(clientRequestId, { conversationId, file, content });
    return transmit({ id: `local:${clientRequestId}`, clientRequestId, senderUserId: currentUserId ?? "", senderName,
      content, sentAt: new Date().toISOString(), delivery: "pending", hasAttachment: true, attachmentFileName: file.name, localPreviewFile: file }, file);
  }, [conversationId, currentConversation, session, transmit]);

  const retrySend = useCallback(async (messageId: string) => {
    if (!conversationId || !currentConversation()) return;
    // Prefer the synchronous local state over a render's older failed-message snapshot.
    const current = [...session.messages(conversationId), ...(thread?.messages ?? [])]
      .find((item) => item.id === messageId || item.clientRequestId === messageId);
    if (!current || current.delivery !== "failed") return;
    if (!current.clientRequestId) {
      if (current.hasAttachment) applyIncoming({ ...current, retryError: "attachment-unavailable" }, conversationId);
      return;
    }
    const retained = session.attachments.get(current.clientRequestId);
    const attachment = retained?.conversationId === conversationId ? retained : undefined;
    await transmit(current.hasAttachment && attachment ? { ...current, content: attachment.content } : current, attachment?.file);
  }, [applyIncoming, conversationId, currentConversation, session, thread, transmit]);

  const retry = useCallback(() => {
    if (currentConversation()) setRetryTick((tick) => tick + 1);
  }, [currentConversation]);
  return { status, thread, error, retry, applyIncoming, send, sendAttachment, retrySend };
}
