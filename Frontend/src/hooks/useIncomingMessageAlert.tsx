"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { useAuthenticatedRequestScope } from "@/hooks/useAuthenticatedRequestScope";
import type { AuthenticatedAccount } from "@/lib/authenticated-account";

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
  const { account, scope, isCurrent } = useAuthenticatedRequestScope(inbox.canUseMessaging, inbox.currentUserId ?? "");
  const [notification, setNotification] = useState<{
    account: AuthenticatedAccount; item: MessageNotificationPayload;
  } | null>(null);
  const banner = notification?.account === account && inbox.canUseMessaging ? notification?.item ?? null : null;
  const surfaceRef = useRef({
    isOpen: inbox.isOpen,
    selectedId: inbox.selectedId,
    pathConversationId: conversationIdFromPath(pathname),
    onMessagesPage: onMessagesSurface(pathname),
  });
  const groupRef = useRef<{ conversationId: string; at: number } | null>(null);
  useLayoutEffect(() => { groupRef.current = null; }, [scope]);

  useLayoutEffect(() => {
    surfaceRef.current = {
      isOpen: inbox.isOpen,
      selectedId: inbox.selectedId,
      pathConversationId: conversationIdFromPath(pathname),
      onMessagesPage: onMessagesSurface(pathname),
    };
  }, [inbox.isOpen, inbox.selectedId, pathname]);

  const { canUseMessaging, currentUserId, openInbox, selectConversation, conversations } =
    inbox;
  const conversationsRef = useRef(conversations);
  useLayoutEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    if (!canUseMessaging || !account || !isCurrent() || !isSameUserId(account.userId, currentUserId)) return;
    const captured = scope.capture();
    return subscribeIncomingMessages((payload) => {
      if (!captured() || !isCurrent()) return;
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
      // §13.6 — MessageSentEvent has no avatar; reuse inbox peer avatar when known.
      const peerAvatar =
        conversationsRef.current
          .find((item) => item.conversationId === conversationId)
          ?.otherParticipantAvatarUrl?.trim() || null;
      const now = Date.now();
      const grouping =
        groupRef.current?.conversationId === conversationId &&
        now - groupRef.current.at < GROUP_WINDOW_MS;

      setNotification((previousNotification) => {
        const previous = previousNotification?.account === account ? previousNotification.item : null;
        if (grouping && previous?.conversationId === conversationId) {
          return { account, item: {
            ...previous,
            preview: preview || previous.preview,
            sentAt: message.sentAt,
            messageCount: previous.messageCount + 1,
            senderName: message.senderName || previous.senderName,
            senderAvatarUrl: peerAvatar || previous.senderAvatarUrl,
          } };
        }
        return { account, item: {
          conversationId,
          senderName: message.senderName,
          senderAvatarUrl: peerAvatar,
          preview,
          sentAt: message.sentAt,
          messageCount: 1,
        } };
      });
      groupRef.current = { conversationId, at: now };
    });
  }, [canUseMessaging, currentUserId, account, scope, isCurrent]);

  const closeBanner = useCallback(() => {
    if (isCurrent()) setNotification(null);
  }, [isCurrent]);

  const openBanner = useCallback(
    (item: MessageNotificationPayload) => {
      if (!isCurrent() || notification?.account !== account || notification.item !== item) return;
      selectConversation(item.conversationId);
      openInbox(item.conversationId);
      router.push(
        conversationMessagesPath(role, { conversationId: item.conversationId }),
      );
      setNotification(null);
    },
    [openInbox, role, router, selectConversation, isCurrent, account, notification],
  );

  return (
    <MessageNotificationBanner item={banner} onOpen={openBanner} onClose={closeBanner} />
  );
}
