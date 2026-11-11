"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import MessageNotificationBanner, {
  type MessageNotificationPayload,
} from "@/components/messages/MessageNotificationBanner";
import { useMessagesInbox } from "@/components/messages/MessagesInboxProvider";
import { conversationListPreview } from "@/lib/conversation-display";
import { isSameUserId } from "@/lib/current-user";
import { refreshUnreadCount } from "@/hooks/useUnreadCount";
import { conversationMessagesPath } from "@/constants/seekerDashboardNav";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { subscribeIncomingMessages } from "@/services/conversation-realtime";

const GROUP_WINDOW_MS = 4500;

function conversationIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/messages\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function onMessagesSurface(pathname: string): boolean {
  return (
    pathname === "/profile/messages" ||
    pathname.startsWith("/profile/messages/") ||
    pathname === "/owner/messages" ||
    pathname.startsWith("/owner/messages/") ||
    pathname === "/messages" ||
    pathname.startsWith("/messages/") ||
    pathname === "/admin/messages" ||
    pathname.startsWith("/admin/messages/")
  );
}

/** Opens the floating inbox / rich toast on a new message (self + active-view suppressed). */
export default function IncomingMessageAlert() {
  const inbox = useMessagesInbox();
  const pathname = usePathname();
  const router = useRouter();
  const { role } = useAccountAccess();
  const [banner, setBanner] = useState<MessageNotificationPayload | null>(null);
  const surfaceRef = useRef({
    isOpen: inbox.isOpen,
    selectedId: inbox.selectedId,
    pathConversationId: conversationIdFromPath(pathname),
    onMessagesPage: onMessagesSurface(pathname),
  });
  const groupRef = useRef<{ conversationId: string; at: number } | null>(null);

  surfaceRef.current = {
    isOpen: inbox.isOpen,
    selectedId: inbox.selectedId,
    pathConversationId: conversationIdFromPath(pathname),
    onMessagesPage: onMessagesSurface(pathname),
  };

  const { canUseMessaging, currentUserId, openInbox, selectConversation } = inbox;

  useEffect(() => {
    if (!canUseMessaging) return;
    return subscribeIncomingMessages((payload) => {
      const message = payload?.message;
      const conversationId = payload?.conversationId;
      if (!message || !conversationId) return;
      // 13.5 — never alert the sender about their own outgoing message.
      if (isSameUserId(message.senderUserId, currentUserId)) return;

      void refreshUnreadCount();

      const current = surfaceRef.current;
      // 13.5 — suppress popup only while actively reading this conversation.
      const viewingThis =
        current.selectedId === conversationId &&
        (current.isOpen || current.onMessagesPage || current.pathConversationId === conversationId);
      if (viewingThis) return;

      const preview = conversationListPreview(
        message.content,
        Boolean(message.hasAttachment),
      );
      const now = Date.now();
      const grouping =
        groupRef.current?.conversationId === conversationId &&
        now - groupRef.current.at < GROUP_WINDOW_MS;

      setBanner((previous) => {
        if (grouping && previous?.conversationId === conversationId) {
          return {
            ...previous,
            preview: preview || previous.preview,
            sentAt: message.sentAt,
            messageCount: previous.messageCount + 1,
            senderName: message.senderName || previous.senderName,
          };
        }
        return {
          conversationId,
          senderName: message.senderName,
          senderAvatarUrl: null,
          preview,
          sentAt: message.sentAt,
          messageCount: 1,
        };
      });
      groupRef.current = { conversationId, at: now };
    });
  }, [canUseMessaging, currentUserId]);

  const closeBanner = useCallback(() => setBanner(null), []);

  const openBanner = useCallback(
    (item: MessageNotificationPayload) => {
      selectConversation(item.conversationId);
      openInbox(item.conversationId);
      router.push(
        conversationMessagesPath(role, { conversationId: item.conversationId }),
      );
      setBanner(null);
    },
    [openInbox, role, router, selectConversation],
  );

  return (
    <MessageNotificationBanner item={banner} onOpen={openBanner} onClose={closeBanner} />
  );
}
