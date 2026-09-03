"use client";

import { useEffect, useRef } from "react";
import { subscribeConversationMessages } from "@/services/conversation-realtime";
import type { IncomingRealtimeMessage } from "@/types/messages";

export function useConversationRealtime(
  conversationId: string | null,
  ownerKey: string | null,
  onMessage: (payload: IncomingRealtimeMessage) => void,
) {
  const handlerRef = useRef(onMessage);

  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!conversationId || !ownerKey) return;
    return subscribeConversationMessages(conversationId, (payload) => {
      handlerRef.current(payload);
    });
  }, [conversationId, ownerKey]);
}
