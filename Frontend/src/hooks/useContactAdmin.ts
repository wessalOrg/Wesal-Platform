"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { isCurrentAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount,
  subscribeAuthenticatedAccount, type AuthenticatedAccount } from "@/lib/authenticated-account";
import { usePathname } from "next/navigation";
import { useOptionalMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { parseOwnerHallIdFromPathname, ownerAdminMessagesPath } from "@/lib/hall-owner-query-keys";
import { pickOwnerAdminConversation } from "@/lib/owner-admin-conversation";
import { fetchInboxConversations } from "@/services/conversations";
import type { ConversationSummary } from "@/types/messages";

let inboxCache: { account: AuthenticatedAccount; at: number; promise: Promise<ConversationSummary[]> } | null = null;
const INBOX_CACHE_MS = 15_000;

function loadOwnerInbox(account: AuthenticatedAccount): Promise<ConversationSummary[]> {
  if (inboxCache?.account === account && Date.now() - inboxCache.at < INBOX_CACHE_MS) {
    return inboxCache.promise;
  }
  const promise = fetchInboxConversations().then((items) => {
    if (!isCurrentAuthenticatedAccount(account)) throw new Error("Obsolete inbox session");
    return items;
  });
  // Store the promise now: a late response cannot replace a newer account's cache.
  inboxCache = { account, at: Date.now(), promise };
  void promise.catch(() => { if (inboxCache?.promise === promise) inboxCache = null; });
  return promise;
}

function pickHallId(
  halls: Array<{ id: string; paymentStatus?: string }>,
  pathname: string,
): string | null {
  const routeId = parseOwnerHallIdFromPathname(pathname);
  if (routeId && halls.some((hall) => hall.id === routeId)) return routeId;
  const subscriptionHall = halls.find(
    (hall) => hall.paymentStatus === "Unpaid" || hall.paymentStatus === "ReceiptUploaded",
  );
  return subscriptionHall?.id ?? halls[0]?.id ?? null;
}

/**
 * Resolves the owner ↔ Admin inbox thread (Edit 4) for the Contact Admin link.
 * Does not create a conversation — no owner-side admin-create API exists.
 */
export function useContactAdmin() {
  const pathname = usePathname();
  const { isHallOwner } = useAccountAccess();
  const { halls } = useHallOwnerHalls();
  const inbox = useOptionalMessagesInbox();
  const account = useSyncExternalStore(
    subscribeAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount,
  );
  const [fetched, setFetched] = useState<{ account: AuthenticatedAccount; items: ConversationSummary[] } | null>(null);

  const preferredHallId = useMemo(
    () => pickHallId(halls, pathname),
    [halls, pathname],
  );

  useEffect(() => {
    if (!isHallOwner || !account) return;
    let cancelled = false;
    void loadOwnerInbox(account)
      .then((items) => {
        if (!cancelled && isCurrentAuthenticatedAccount(account)) setFetched({ account, items });
      })
      .catch(() => {
        if (!cancelled && isCurrentAuthenticatedAccount(account)) setFetched({ account, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [account, isHallOwner]);

  const inboxConversations = inbox?.conversations;
  const inboxOwnerId = inbox?.currentUserId;
  const conversations = useMemo<ConversationSummary[]>(() => {
    if (account && inboxOwnerId === account.userId && inboxConversations?.length) return inboxConversations;
    // Fetched inbox only applies to owners; ignore stale data after a role change.
    return isHallOwner && fetched?.account === account ? fetched.items : [];
  }, [account, fetched, inboxConversations, inboxOwnerId, isHallOwner]);

  const adminConversation = useMemo(
    () => pickOwnerAdminConversation(conversations, preferredHallId),
    [conversations, preferredHallId],
  );

  const href = useMemo(
    () => ownerAdminMessagesPath(preferredHallId, adminConversation?.conversationId ?? null),
    [adminConversation?.conversationId, preferredHallId],
  );

  return {
    href,
    unread: Boolean(adminConversation?.isUnread),
    preferredHallId,
    conversationId: adminConversation?.conversationId ?? null,
  };
}
