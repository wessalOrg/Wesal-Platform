"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useConversationRealtime } from "@/hooks/useConversationRealtime";
import { useConversationThread } from "@/hooks/useConversationThread";
import { useInboxConversations } from "@/hooks/useInboxConversations";
import { useOwnedHallAccess } from "@/hooks/useOwnedHallAccess";
import { canAccessMessaging } from "@/lib/hall-access";
import { useMessageDrafts } from "@/hooks/useMessageDrafts";
import { useThreadDeliverySync } from "@/hooks/useThreadDeliverySync";
import { getCurrentUserId } from "@/lib/current-user";
import { refreshUnreadCount } from "@/hooks/useUnreadCount";
import { applyBookingAcceptanceFromMessage } from "@/lib/apply-booking-acceptance-from-message";
import { applyBookingRejectionFromMessage } from "@/lib/apply-booking-rejection-from-message";
import { markConversationAsRead } from "@/services/conversations";
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
  sendAttachment: (file: File, text: string) => Promise<boolean>;
  retrySend: (messageId: string) => void;
  openInbox: (conversationId?: string, draft?: string) => void;
  closeInbox: () => void;
  toggleInbox: () => void;
  selectConversation: (conversationId: string | null) => void;
};

const MessagesInboxContext = createContext<MessagesInboxContextValue | null>(null);

export function MessagesInboxProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready, authenticated, sessionKey, userId, displayName, isHallOwner } = useAccountAccess();
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
  const isEmbeddedInbox =
    pathname === "/profile/messages" ||
    pathname.startsWith("/profile/messages/") ||
    pathname === "/owner/messages" ||
    pathname.startsWith("/owner/messages/");
  const isMessagesRoute = pathname === "/messages" || pathname.startsWith("/messages/");
  const inboxActive = Boolean(sessionReady && ownerKey && (isOpen || isEmbeddedInbox || isMessagesRoute));
  const inbox = useInboxConversations(ownerKey, inboxActive);
  const selectedConversation =
    inbox.conversations.find((item) => item.conversationId === selectedId) ?? null;
  const { access: selectedHallAccess, flagsReady: selectedHallFlagsReady } = useOwnedHallAccess(
    selectedConversation?.hallId ?? null,
  );
  const threadFetchEnabled =
    !isHallOwner ||
    (selectedHallFlagsReady && canAccessMessaging(selectedHallAccess));
  const threadState = useConversationThread(
    sessionReady && ownerKey ? selectedId : null,
    ownerKey,
    refreshEpoch,
    threadFetchEnabled,
  );
  const applyIncoming = threadState.applyIncoming;
  const sendThreadMessage = threadState.send;
  const sendThreadAttachment = threadState.sendAttachment;
  const retryThreadSend = threadState.retrySend;
  const applyPreview = inbox.applyPreview;
  const markLocalRead = inbox.markLocalRead;
  const refreshInbox = inbox.refresh;

  useConversationRealtime(
    sessionReady && ownerKey && threadFetchEnabled ? selectedId : null,
    ownerKey,
    (payload) => {
      if (!payload?.conversationId || !payload.message) return;
      applyIncoming(payload.message, payload.conversationId);
      applyPreview(
        payload.conversationId,
        payload.message.content,
        payload.message.sentAt,
        false,
        Boolean(payload.message.hasAttachment),
      );
      applyBookingRejectionFromMessage(payload.message.content);
      applyBookingAcceptanceFromMessage(
        payload.message.content,
        "",
        payload.conversationId,
      );
      void markConversationAsRead(payload.conversationId).catch(() => undefined);
    },
  );

  useThreadDeliverySync(
    sessionReady && ownerKey && threadFetchEnabled ? selectedId : null,
    ownerKey,
    threadState.status === "ready" || threadState.status === "empty",
    (message, conversationId) => {
      if (!conversationId || !message) return;
      applyIncoming(message, conversationId);
      applyPreview(
        conversationId,
        message.content,
        message.sentAt,
        false,
        Boolean(message.hasAttachment),
      );
      applyBookingRejectionFromMessage(message.content);
      applyBookingAcceptanceFromMessage(message.content, "", conversationId);
      void markConversationAsRead(conversationId).catch(() => undefined);
    },
  );

  // Mark the open conversation as read, then revalidate the shared unread badge.
  useEffect(() => {
    if (!ownerKey || !selectedId || !threadFetchEnabled) return;
    if (threadState.status !== "ready" && threadState.status !== "empty") return;

    let cancelled = false;
    void markConversationAsRead(selectedId)
      .then(() => {
        if (!cancelled) return refreshUnreadCount();
      })
      .catch(() => {
        // Non-critical — navigation/thread stay usable if mark-read fails.
      });

    return () => {
      cancelled = true;
    };
  }, [ownerKey, selectedId, threadFetchEnabled, threadState.status]);

  useEffect(() => {
    const thread = threadState.thread;
    const hallName = thread?.hallName ?? "";
    for (const message of thread?.messages ?? []) {
      applyBookingRejectionFromMessage(message.content, hallName);
      applyBookingAcceptanceFromMessage(message.content, hallName, thread?.conversationId);
    }
  }, [threadState.thread]);

  const closeInbox = useCallback(() => {
    setIsOpen(false);
  }, []);

  const selectConversation = useCallback((conversationId: string | null) => {
    setSelectedId(conversationId);
    if (conversationId) markLocalRead(conversationId);
  }, [markLocalRead]);

  const openInbox = useCallback(
    (conversationId?: string, draft?: string) => {
      if (!canUseMessaging) return;
      if (conversationId) {
        setSelectedId(conversationId);
        markLocalRead(conversationId);
        if (draft?.trim()) persistDraft(conversationId, draft.trim());
      }
      setIsOpen(true);
      setRefreshEpoch((n) => n + 1);
      refreshInbox();
    },
    [canUseMessaging, markLocalRead, persistDraft, refreshInbox],
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
      if (isHallOwner && !canAccessMessaging(selectedHallAccess)) return false;
      persistDraft(selectedId, "");
      const sent = await sendThreadMessage(text, currentUserId, displayName || "");
      if (sent) {
        applyPreview(selectedId, text.trim(), new Date().toISOString(), false);
      } else {
        restoreDraft(selectedId, text);
      }
      return sent;
    },
    [
      applyPreview,
      currentUserId,
      displayName,
      isHallOwner,
      persistDraft,
      restoreDraft,
      selectedHallAccess,
      selectedId,
      sendThreadMessage,
    ],
  );

  const sendAttachment = useCallback(
    async (file: File, text: string) => {
      if (!selectedId) return false;
      if (isHallOwner && !canAccessMessaging(selectedHallAccess)) return false;
      persistDraft(selectedId, "");
      const sent = await sendThreadAttachment(file, text, currentUserId, displayName || "");
      if (sent) {
        applyPreview(
          selectedId,
          text.trim(),
          new Date().toISOString(),
          false,
          true,
        );
      } else {
        restoreDraft(selectedId, text);
      }
      return sent;
    },
    [
      applyPreview,
      currentUserId,
      displayName,
      isHallOwner,
      persistDraft,
      restoreDraft,
      selectedHallAccess,
      selectedId,
      sendThreadAttachment,
    ],
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
      sendAttachment,
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
      sendAttachment,
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
