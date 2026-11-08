"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useAdminOwnerThread } from "@/hooks/useAdminOwnerThread";
import { refreshUnreadCount } from "@/hooks/useUnreadCount";
import { useT } from "@/i18n";
import {
  buildAdminMessageItems,
  countAdminMessageFilters,
  filterAdminMessages,
} from "@/lib/admin-messages-adapter";
import { getCurrentUserId } from "@/lib/current-user";
import { fetchAdminSubscriptionOverview } from "@/services/admin-halls";
import {
  conversationErrorMessage,
  fetchInboxConversations,
  markConversationAsRead,
} from "@/services/conversations";
import type {
  AdminMessageFilter,
  AdminMessageItem,
} from "@/types/admin-messages";
import type { AdminSubscriptionOwnerGroup } from "@/types/admin-halls";
import type { ConversationSummary, InboxStatus } from "@/types/messages";

function readFocusConversation(searchParams: URLSearchParams): {
  conversationId: string | null;
  peerName: string | null;
} {
  return {
    conversationId: searchParams.get("conversation_id")?.trim() || null,
    peerName: searchParams.get("peer")?.trim() || null,
  };
}

export function useAdminMessages() {
  const t = useT();
  const searchParams = useSearchParams();
  const focus = readFocusConversation(searchParams);
  const { ready, authenticated, sessionKey, displayName, userId } = useAccountAccess();
  const ownerKey = ready && authenticated ? sessionKey : null;
  const currentUserId = userId || getCurrentUserId();
  const senderName = displayName?.trim() || t("admin.role");

  const [retryTick, setRetryTick] = useState(0);
  const [inboxStatus, setInboxStatus] = useState<InboxStatus>("idle");
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [subscriptionGroups, setSubscriptionGroups] = useState<AdminSubscriptionOwnerGroup[]>([]);
  const [filter, setFilter] = useState<AdminMessageFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [manualSelectedId, setManualSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [seenOwnerKey, setSeenOwnerKey] = useState<string | null>(ownerKey);
  const [seenFocusId, setSeenFocusId] = useState<string | null>(focus.conversationId);

  if (ownerKey !== seenOwnerKey) {
    setSeenOwnerKey(ownerKey);
    setInboxStatus(ownerKey ? "loading" : "idle");
    setInboxError(null);
    setConversations([]);
    setSubscriptionGroups([]);
    setManualSelectedId(null);
    setSearchQuery("");
    setFilter("all");
    setDraft("");
  }

  if (focus.conversationId !== seenFocusId) {
    setSeenFocusId(focus.conversationId);
    setManualSelectedId(null);
  }

  useEffect(() => {
    if (!ownerKey) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const [inboxResult, groupsResult] = await Promise.allSettled([
          fetchInboxConversations(),
          fetchAdminSubscriptionOverview(),
        ]);
        if (cancelled) return;

        if (inboxResult.status === "fulfilled") {
          setConversations(inboxResult.value);
        } else {
          setConversations([]);
        }

        if (groupsResult.status === "fulfilled") {
          setSubscriptionGroups(groupsResult.value);
        } else {
          setSubscriptionGroups([]);
        }

        if (inboxResult.status === "rejected" && groupsResult.status === "rejected") {
          setInboxError(conversationErrorMessage(inboxResult.reason, "inbox"));
          setInboxStatus("error");
          return;
        }

        setInboxError(
          inboxResult.status === "rejected"
            ? conversationErrorMessage(inboxResult.reason, "inbox")
            : null,
        );
        setInboxStatus("ready");
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ownerKey, retryTick]);

  const items = useMemo(
    () =>
      buildAdminMessageItems(
        conversations,
        subscriptionGroups,
        t("admin.messages.paymentNotice.defaultPreview"),
      ),
    [conversations, subscriptionGroups, t],
  );

  const counts = useMemo(() => countAdminMessageFilters(items), [items]);

  const visibleItems = useMemo(
    () => filterAdminMessages(items, filter, searchQuery),
    [items, filter, searchQuery],
  );

  // Deep-link from Contact Coordinator (or similar): prefer inbox match, else keep the focus id.
  const focusedSelectedId = useMemo(() => {
    if (!focus.conversationId) return null;
    if (inboxStatus !== "ready") return focus.conversationId;
    const match = items.find(
      (item) =>
        item.conversationId === focus.conversationId ||
        item.id === focus.conversationId,
    );
    return match?.id ?? focus.conversationId;
  }, [focus.conversationId, inboxStatus, items]);

  const selectedId = manualSelectedId ?? focusedSelectedId;

  const selectedItem = useMemo(() => {
    const found = items.find((item) => item.id === selectedId) ?? null;
    if (found) return found;
    if (
      selectedId &&
      focus.conversationId &&
      selectedId === focus.conversationId
    ) {
      const peer =
        focus.peerName || t("admin.coordinators.contact.threadFallback");
      return {
        id: focus.conversationId,
        category: "conversation" as const,
        hallId: "",
        hallName: peer,
        ownerName: peer,
        conversationId: focus.conversationId,
        preview: "",
        lastMessageAt: null,
        createdAt: new Date(0).toISOString(),
        isUnread: false,
      } satisfies AdminMessageItem;
    }
    return null;
  }, [focus.conversationId, focus.peerName, items, selectedId, t]);

  const threadTarget = useMemo(() => {
    if (!selectedItem) return null;
    return {
      hallId: selectedItem.hallId,
      hallName: selectedItem.hallName,
      ownerName: selectedItem.ownerName || null,
      conversationId: selectedItem.conversationId,
    };
  }, [selectedItem]);

  const threadState = useAdminOwnerThread(threadTarget, ownerKey);

  useEffect(() => {
    const conversationId = threadState.conversationId ?? selectedItem?.conversationId;
    if (!conversationId || !ownerKey) return;

    let cancelled = false;
    void (async () => {
      try {
        await markConversationAsRead(conversationId);
        if (cancelled) return;
        await refreshUnreadCount();
      } catch {
        /* mark-as-read is best-effort; unread poller remains source of truth */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [threadState.conversationId, selectedItem?.conversationId, ownerKey, selectedId]);

  const selectItem = useCallback((item: AdminMessageItem | null) => {
    setManualSelectedId(item?.id ?? null);
    setDraft("");
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const ok = await threadState.send(text, currentUserId, senderName);
      if (ok) {
        setDraft("");
        const preview = text.trim();
        const at = new Date().toISOString();
        const conversationId = threadState.conversationId;
        if (conversationId) {
          setConversations((current) => {
            const existing = current.find((row) => row.conversationId === conversationId);
            if (!existing) {
              if (!selectedItem) return current;
              return [
                {
                  conversationId,
                  kind: selectedItem.hallId ? "HallBooking" : "AdminAccount",
                  hallId: selectedItem.hallId,
                  hallName: selectedItem.hallName,
                  otherParticipantId: "",
                  otherParticipantName: selectedItem.ownerName,
                  lastMessagePreview: preview,
                  lastMessageAt: at,
                  messageCount: 1,
                  createdAt: at,
                  isUnread: false,
                },
                ...current,
              ];
            }
            return current
              .map((row) =>
                row.conversationId === conversationId
                  ? { ...row, lastMessagePreview: preview, lastMessageAt: at }
                  : row,
              )
              .sort(
                (left, right) =>
                  Date.parse(right.lastMessageAt ?? right.createdAt) -
                  Date.parse(left.lastMessageAt ?? left.createdAt),
              );
          });
        }
        void refreshUnreadCount();
      }
      return ok;
    },
    [threadState, currentUserId, senderName, selectedItem],
  );

  const listStatus: InboxStatus =
    inboxStatus === "ready" && visibleItems.length === 0 ? "empty" : inboxStatus;

  const emptyReason =
    listStatus === "empty"
      ? searchQuery.trim()
        ? ("search" as const)
        : filter === "conversation"
          ? ("conversation" as const)
          : filter === "payment_notice"
            ? ("payment_notice" as const)
            : ("all" as const)
      : null;

  return {
    currentUserId,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    counts,
    items: visibleItems,
    listStatus,
    inboxError,
    emptyReason,
    retryInbox: () => {
      setInboxStatus("loading");
      setInboxError(null);
      setRetryTick((n) => n + 1);
    },
    selectedId,
    selectedItem,
    selectItem,
    threadStatus: threadState.status,
    thread: threadState.thread,
    threadError: threadState.errorKey ? t(threadState.errorKey) : null,
    deliveryPending: threadState.deliveryPending,
    retryThread: threadState.retry,
    retrySend: (messageId: string) => {
      void threadState.retrySend(messageId, currentUserId, senderName);
    },
    draft,
    setDraft,
    sendMessage,
  };
}
