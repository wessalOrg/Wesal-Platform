"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { isCurrentAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount,
  subscribeAuthenticatedAccount, type AuthenticatedAccount } from "@/lib/authenticated-account";
import { latestHallRejectionReason } from "@/lib/hall-rejection-reason";
import { pickOwnerAdminConversation } from "@/lib/owner-admin-conversation";
import { fetchConversationThread, fetchInboxConversations } from "@/services/conversations";
import type { ConversationSummary } from "@/types/messages";

export type HallRejectionReasonState = {
  status: "idle" | "loading" | "found" | "missing" | "error";
  /** Empty string when the admin rejected without writing a reason. */
  reason: string;
};

const IDLE: HallRejectionReasonState = { status: "idle", reason: "" };

// Several rejected halls on one page share a single inbox request.
let inboxRequest: { account: AuthenticatedAccount; promise: Promise<ConversationSummary[]>; at: number } | null = null;
const INBOX_SHARE_MS = 5000;

function sharedInbox(account: AuthenticatedAccount): Promise<ConversationSummary[]> {
  const now = Date.now();
  if (inboxRequest?.account === account && now - inboxRequest.at < INBOX_SHARE_MS) return inboxRequest.promise;
  const promise = fetchInboxConversations().then((items) => {
    if (!isCurrentAuthenticatedAccount(account)) throw new Error("Obsolete inbox session");
    return items;
  });
  inboxRequest = { account, promise, at: now };
  promise.catch(() => {
    if (inboxRequest?.promise === promise) inboxRequest = null;
  });
  return promise;
}

/**
 * Recovers why an Admin rejected a hall: the reason only exists as the rejection message in the
 * owner ↔ Admin thread of that hall, so read it from there. Read-only.
 */
export function useHallRejectionReason(
  hallId: string | null | undefined,
  enabled: boolean,
): HallRejectionReasonState {
  const account = useSyncExternalStore(
    subscribeAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount,
  );
  const [state, setState] = useState<{ account: AuthenticatedAccount; key: string; value: HallRejectionReasonState } | null>(
    null,
  );
  const key = account && enabled && hallId ? hallId : "";

  useEffect(() => {
    if (!key || !account) return;
    let cancelled = false;
    const current = () => !cancelled && isCurrentAuthenticatedAccount(account);
    void (async () => {
      try {
        const items = await sharedInbox(account);
        if (!current()) return;
        const conversation = pickOwnerAdminConversation(items, key);
        if (!conversation) {
          if (current()) setState({ account, key, value: { status: "missing", reason: "" } });
          return;
        }
        const thread = await fetchConversationThread(conversation.conversationId);
        const reason = latestHallRejectionReason(thread.messages);
        if (!current()) return;
        setState({
          account,
          key,
          value:
            reason === null
              ? { status: "missing", reason: "" }
              : { status: "found", reason },
        });
      } catch {
        if (current()) setState({ account, key, value: { status: "error", reason: "" } });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account, key]);

  if (!key) return IDLE;
  if (!state || state.account !== account || state.key !== key) return { status: "loading", reason: "" };
  return state.value;
}
