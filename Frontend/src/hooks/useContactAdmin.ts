"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useOptionalMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import { HALL_OWNER_MESSAGES_PATH } from "@/lib/account-profile-path";
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

export type ContactAdminTarget = {
  hallId: string | null;
  conversationId: string | null;
  href: string;
};

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
 * Opens the existing owner ↔ admin inbox thread (Edit 4).
 * Does not create a conversation — no owner-side admin-create API exists.
 */
export function useContactAdmin() {
  const router = useRouter();
  const pathname = usePathname();
  const { isHallOwner } = useAccountAccess();
  const { halls, isLoading: hallsLoading } = useHallOwnerHalls();
  const inbox = useOptionalMessagesInbox();
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [fetched, setFetched] = useState<ConversationSummary[] | null>(null);

  const preferredHallId = useMemo(
    () => pickHallId(halls, pathname),
    [halls, pathname],
  );

  useEffect(() => {
    if (!isHallOwner) {
      setFetched(null);
      return;
    }
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

  const conversations = inbox?.conversations?.length ? inbox.conversations : fetched ?? [];

  const unread = useMemo(() => {
    if (!preferredHallId) return conversations.some((item) => item.isUnread);
    const needle = preferredHallId.toLowerCase();
    return conversations.some(
      (item) => item.isUnread && (item.hallId ?? "").toLowerCase() === needle,
    );
  }, [conversations, preferredHallId]);

  const resolveTarget = useCallback(async (): Promise<ContactAdminTarget> => {
    const hallId = preferredHallId;
    const conversationId =
      pickOwnerAdminConversation(conversations, hallId)?.conversationId ?? null;
    return {
      hallId,
      conversationId,
      href: hallId
        ? ownerAdminMessagesPath(hallId, conversationId)
        : HALL_OWNER_MESSAGES_PATH,
    };
  }, [conversations, preferredHallId]);

  const open = useCallback(async () => {
    if (!isHallOwner || busy) return null;
    setBusy(true);
    setErrorKey(null);
    try {
      const target = await resolveTarget();
      if (pathname.startsWith("/owner/messages")) {
        router.replace(target.href);
      } else {
        router.push(target.href);
      }
      return target;
    } catch {
      setErrorKey("owner.contactAdmin.error");
      router.push(HALL_OWNER_MESSAGES_PATH);
      return null;
    } finally {
      setBusy(false);
    }
  }, [busy, isHallOwner, pathname, resolveTarget, router]);

  return {
    open,
    busy: busy || hallsLoading,
    errorKey,
    unread,
    preferredHallId,
  };
}
