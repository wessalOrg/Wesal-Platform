"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  readAuthenticatedAccount, serverAuthenticatedAccount, subscribeAuthenticatedAccount,
} from "@/lib/authenticated-account";
import { subscribeConversationMessages } from "@/services/conversation-realtime";
import type { IncomingRealtimeMessage } from "@/types/messages";

export function useConversationRealtime(
  conversationId: string | null,
  ownerKey: string | null,
  onMessage: (payload: IncomingRealtimeMessage) => void,
) {
  const account = useSyncExternalStore(subscribeAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount);
  const handlerRef = useRef(onMessage);

  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!conversationId || !account || (ownerKey !== account.userId && ownerKey !== account.token)) return;
    return subscribeConversationMessages(conversationId, (payload) => {
      handlerRef.current(payload);
    });
  }, [account, conversationId, ownerKey]);
}
