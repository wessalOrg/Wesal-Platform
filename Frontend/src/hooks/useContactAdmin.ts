"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useOptionalMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { parseOwnerHallIdFromPathname, ownerAdminMessagesPath } from "@/lib/hall-owner-query-keys";
import { pickOwnerAdminConversation } from "@/lib/owner-admin-conversation";
import { fetchInboxConversations } from "@/services/conversations";
import type { ConversationSummary } from "@/types/messages";

let inboxCache: { at: number; items: ConversationSummary[] } | null = null;
const INBOX_CACHE_MS = 15_000;

async function loadOwnerInbox(): Promise<ConversationSummary[]> {
  if (inboxCache && Date.now() - inboxCache.at < INBOX_CACHE_MS) {
    return inboxCache.items;
  }
  const items = await fetchInboxConversations();
  inboxCache = { at: Date.now(), items };
  return items;
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
  const [fetched, setFetched] = useState<ConversationSummary[] | null>(null);

  const preferredHallId = useMemo(
    () => pickHallId(halls, pathname),
    [halls, pathname],
  );

  useEffect(() => {
    if (!isHallOwner) return;
    let cancelled = false;
    void loadOwnerInbox()
      .then((items) => {
        if (!cancelled) setFetched(items);
      })
      .catch(() => {
        if (!cancelled) setFetched([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isHallOwner]);

  const inboxConversations = inbox?.conversations;
  const conversations = useMemo<ConversationSummary[]>(() => {
    if (inboxConversations?.length) return inboxConversations;
    // Fetched inbox only applies to owners; ignore stale data after a role change.
    return isHallOwner ? fetched ?? [] : [];
  }, [fetched, inboxConversations, isHallOwner]);

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
