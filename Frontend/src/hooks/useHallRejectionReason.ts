"use client";

import { useEffect, useState } from "react";
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
let inboxRequest: { promise: Promise<ConversationSummary[]>; at: number } | null = null;
const INBOX_SHARE_MS = 5000;

function sharedInbox(): Promise<ConversationSummary[]> {
  const now = Date.now();
  if (inboxRequest && now - inboxRequest.at < INBOX_SHARE_MS) return inboxRequest.promise;
  const promise = fetchInboxConversations();
  inboxRequest = { promise, at: now };
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
  const [state, setState] = useState<{ key: string; value: HallRejectionReasonState } | null>(
    null,
  );
  const key = enabled && hallId ? hallId : "";

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void (async () => {
      try {
        const items = await sharedInbox();
        const conversation = pickOwnerAdminConversation(items, key);
        if (!conversation) {
          if (!cancelled) setState({ key, value: { status: "missing", reason: "" } });
          return;
        }
        const thread = await fetchConversationThread(conversation.conversationId);
        const reason = latestHallRejectionReason(thread.messages);
        if (cancelled) return;
        setState({
          key,
          value:
            reason === null
              ? { status: "missing", reason: "" }
              : { status: "found", reason },
        });
      } catch {
        if (!cancelled) setState({ key, value: { status: "error", reason: "" } });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!key) return IDLE;
  if (!state || state.key !== key) return { status: "loading", reason: "" };
  return state.value;
}
