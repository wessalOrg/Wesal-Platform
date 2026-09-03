"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useConversationRealtime } from "@/hooks/useConversationRealtime";
import { useConversationThread } from "@/hooks/useConversationThread";
import { useInboxConversations } from "@/hooks/useInboxConversations";
import { useMessageDrafts } from "@/hooks/useMessageDrafts";
import { useThreadDeliverySync } from "@/hooks/useThreadDeliverySync";
import { getCurrentUserId } from "@/lib/current-user";
import type { ConversationSummary, InboxStatus, MessageThread, ThreadStatus } from "@/types/messages";

type MessagesInboxContextValue = {
  isOpen: boolean;
  selectedId: string | null;
  canUseMessaging: boolean;
  currentUserId: string | null;
  inboxStatus: InboxStatus;
  conversations: ConversationSummary[];
  inboxError: string | null;
  retryInbox: () => void;
  threadStatus: ThreadStatus;
  thread: MessageThread | null;
  threadError: string | null;
  retryThread: () => void;
  draft: string;
  setDraft: (value: string) => void;
  sendMessage: (text: string) => Promise<boolean>;
  retrySend: (messageId: string) => void;
  openInbox: (conversationId?: string) => void;
  closeInbox: () => void;
  toggleInbox: () => void;
  selectConversation: (conversationId: string | null) => void;
};

const MessagesInboxContext = createContext<MessagesInboxContextValue | null>(null);

export function MessagesInboxProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready, authenticated, sessionKey, userId, displayName } = useAccountAccess();
  const ownerKey = ready && authenticated ? sessionKey : null;
  const canUseMessaging = Boolean(ownerKey);
  const currentUserId = userId || getCurrentUserId();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshEpoch, setRefreshEpoch] = useState(0);
  const [seenPathname, setSeenPathname] = useState(pathname);
  const [seenOwnerKey, setSeenOwnerKey] = useState<string | null>(ownerKey);
  const { draftFor, setDraft: persistDraft, restoreDraft } = useMessageDrafts(ownerKey);

  if (ownerKey !== seenOwnerKey) {
    setSeenOwnerKey(ownerKey);
    setIsOpen(false);
    setSelectedId(null);
    setRefreshEpoch(0);
  }

  if (pathname !== seenPathname) {
    setSeenPathname(pathname);
    if (isOpen) setIsOpen(false);
  }

  const sessionReady = ownerKey === seenOwnerKey;
  const inbox = useInboxConversations(ownerKey, Boolean(sessionReady && ownerKey && isOpen));
  const threadState = useConversationThread(
    sessionReady && ownerKey ? selectedId : null,
    ownerKey,
    refreshEpoch,
  );
  const applyIncoming = threadState.applyIncoming;
  const sendThreadMessage = threadState.send;
  const retryThreadSend = threadState.retrySend;
  const applyPreview = inbox.applyPreview;

  useConversationRealtime(sessionReady && ownerKey ? selectedId : null, ownerKey, (payload) => {
    applyIncoming(payload.message, payload.conversationId);
    applyPreview(payload.conversationId, payload.message.content, payload.message.sentAt);
  });

  useThreadDeliverySync(
    sessionReady && ownerKey ? selectedId : null,
    ownerKey,
    threadState.status === "ready" || threadState.status === "empty",
    (message, conversationId) => {
      applyIncoming(message, conversationId);
      applyPreview(conversationId, message.content, message.sentAt);
    },
  );

  const closeInbox = useCallback(() => {
    setIsOpen(false);
  }, []);

  const selectConversation = useCallback((conversationId: string | null) => {
    setSelectedId(conversationId);
  }, []);

  const openInbox = useCallback(
    (conversationId?: string) => {
      if (!canUseMessaging) return;
      if (conversationId) setSelectedId(conversationId);
      setIsOpen(true);
      setRefreshEpoch((n) => n + 1);
    },
    [canUseMessaging],
  );

  const toggleInbox = useCallback(() => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    if (!canUseMessaging) return;
    setIsOpen(true);
    setRefreshEpoch((n) => n + 1);
  }, [canUseMessaging, isOpen]);

  const setDraft = useCallback(
    (value: string) => {
      if (!selectedId) return;
      persistDraft(selectedId, value);
    },
    [persistDraft, selectedId],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!selectedId) return false;
      persistDraft(selectedId, "");
      const sent = await sendThreadMessage(text, currentUserId, displayName || "");
      if (sent) {
        applyPreview(selectedId, text.trim(), new Date().toISOString());
      } else {
        restoreDraft(selectedId, text);
      }
      return sent;
    },
    [applyPreview, currentUserId, displayName, persistDraft, restoreDraft, selectedId, sendThreadMessage],
  );

  const retrySend = useCallback(
    (messageId: string) => {
      void retryThreadSend(messageId);
    },
    [retryThreadSend],
  );

  const value = useMemo<MessagesInboxContextValue>(
    () => ({
      isOpen,
      selectedId,
      canUseMessaging,
      currentUserId,
      inboxStatus: inbox.status,
      conversations: inbox.conversations,
      inboxError: inbox.error,
      retryInbox: inbox.retry,
      threadStatus: threadState.status,
      thread: threadState.thread,
      threadError: threadState.error,
      retryThread: threadState.retry,
      draft: draftFor(selectedId),
      setDraft,
      sendMessage,
      retrySend,
      openInbox,
      closeInbox,
      toggleInbox,
      selectConversation,
    }),
    [
      isOpen,
      selectedId,
      canUseMessaging,
      currentUserId,
      inbox.status,
      inbox.conversations,
      inbox.error,
      inbox.retry,
      threadState.status,
      threadState.thread,
      threadState.error,
      threadState.retry,
      draftFor,
      setDraft,
      sendMessage,
      retrySend,
      openInbox,
      closeInbox,
      toggleInbox,
      selectConversation,
    ],
  );

  return <MessagesInboxContext.Provider value={value}>{children}</MessagesInboxContext.Provider>;
}

export function useMessagesInbox() {
  const ctx = useContext(MessagesInboxContext);
  if (!ctx) {
    throw new Error("useMessagesInbox must be used within MessagesInboxProvider");
  }
  return ctx;
}

export function useOptionalMessagesInbox() {
  return useContext(MessagesInboxContext);
}
