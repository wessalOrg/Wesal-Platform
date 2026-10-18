"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import { isSameUserId } from "@/lib/current-user";
import { refreshUnreadCount } from "@/hooks/useUnreadCount";
import { subscribeIncomingMessages } from "@/services/conversation-realtime";

function onMessagesPath(pathname: string): boolean {
  return (
    pathname === "/profile/messages" ||
    pathname.startsWith("/profile/messages/") ||
    pathname === "/owner/messages" ||
    pathname.startsWith("/owner/messages/") ||
    pathname === "/messages" ||
    pathname.startsWith("/messages/")
  );
}

/** Opens the floating inbox and refreshes the red unread count on a new message. */
export default function IncomingMessageAlert() {
  const inbox = useMessagesInbox();
  const pathname = usePathname();
  const surfaceRef = useRef({
    isOpen: inbox.isOpen,
    selectedId: inbox.selectedId,
    onMessagesPage: onMessagesPath(pathname),
  });
  surfaceRef.current = {
    isOpen: inbox.isOpen,
    selectedId: inbox.selectedId,
    onMessagesPage: onMessagesPath(pathname),
  };

  const { canUseMessaging, currentUserId, openInbox, selectConversation } = inbox;

  useEffect(() => {
    if (!canUseMessaging) return;
    return subscribeIncomingMessages((payload) => {
      const message = payload?.message;
      const conversationId = payload?.conversationId;
      if (!message || !conversationId) return;
      if (isSameUserId(message.senderUserId, currentUserId)) return;

      void refreshUnreadCount();

      const current = surfaceRef.current;
      const viewingThis =
        current.selectedId === conversationId && (current.isOpen || current.onMessagesPage);
      if (viewingThis || current.onMessagesPage) return;

      if (!current.isOpen) selectConversation(null);
      openInbox();
    });
  }, [canUseMessaging, currentUserId, openInbox, selectConversation]);

  return null;
}
