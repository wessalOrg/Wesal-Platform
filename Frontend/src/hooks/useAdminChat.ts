"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { isAcceptedChatImage } from "@/lib/chat-image-message";
import {
  isOwnerAdminConversation,
  pickOwnerAdminConversation,
} from "@/lib/owner-admin-conversation";
import type { ConversationSummary, InboxStatus } from "@/types/messages";

type UseAdminChatOptions = {
  conversations: ConversationSummary[];
  selectedId: string | null;
  inboxStatus: InboxStatus;
  selectConversation: (conversationId: string | null) => void;
  sendMessage: (text: string) => Promise<boolean>;
  sendAttachment?: (file: File, text: string) => Promise<boolean>;
  focusHallId?: string | null;
  focusConversationId?: string | null;
  focusAdmin?: boolean;
};

function readWindowFocus(pathname: string): {
  hallId: string | null;
  conversationId: string | null;
  contactAdmin: boolean;
} {
  if (typeof window === "undefined" || !pathname.startsWith("/owner/messages")) {
    return { hallId: null, conversationId: null, contactAdmin: false };
  }
  const query = new URLSearchParams(window.location.search);
  return {
    hallId: query.get("hallId")?.trim() || null,
    conversationId: query.get("conversation_id")?.trim() || null,
    contactAdmin: query.get("contact") === "admin",
  };
}

/**
 * Owner ↔ Admin thread: deep-link by hallId and send a payment screenshot
 * via POST /conversations/{id}/messages/attachment.
 */
export function useAdminChat({
  conversations,
  selectedId,
  inboxStatus,
  selectConversation,
  sendMessage,
  sendAttachment,
  focusHallId: focusHallIdProp,
  focusConversationId: focusConversationIdProp,
  focusAdmin: focusAdminProp,
}: UseAdminChatOptions) {
  const pathname = usePathname();
  const { isHallOwner } = useAccountAccess();
  const fromWindow = readWindowFocus(pathname);
  const focusHallId = focusHallIdProp !== undefined ? focusHallIdProp : fromWindow.hallId;
  const focusConversationId =
    focusConversationIdProp !== undefined ? focusConversationIdProp : fromWindow.conversationId;
  const focusAdmin = focusAdminProp !== undefined ? focusAdminProp : fromWindow.contactAdmin;
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const matchedConversation = useMemo(() => {
    if (focusAdmin) {
      const admin = pickOwnerAdminConversation(conversations, focusHallId);
      if (admin) return admin;
      if (!focusConversationId) return null;
      const byId =
        conversations.find((item) => item.conversationId === focusConversationId) ?? null;
      if (byId && isOwnerAdminConversation(byId, conversations)) return byId;
      return null;
    }
    if (focusConversationId) {
      return (
        conversations.find((item) => item.conversationId === focusConversationId) ?? null
      );
    }
    if (!focusHallId) return null;
    return pickOwnerAdminConversation(conversations, focusHallId);
  }, [conversations, focusAdmin, focusConversationId, focusHallId]);

  useEffect(() => {
    if (focusAdmin) {
      if (!isHallOwner) return;
      if (inboxStatus !== "ready" && inboxStatus !== "empty") return;
      if (!matchedConversation) return;
      if (selectedId === matchedConversation.conversationId) return;
      selectConversation(matchedConversation.conversationId);
      return;
    }
    if (focusConversationId) {
      if (selectedId !== focusConversationId) selectConversation(focusConversationId);
      return;
    }
    if (!isHallOwner || !focusHallId) return;
    if (inboxStatus !== "ready" && inboxStatus !== "empty") return;
    if (!matchedConversation) return;
    if (selectedId === matchedConversation.conversationId) return;
    selectConversation(matchedConversation.conversationId);
  }, [
    focusAdmin,
    focusConversationId,
    focusHallId,
    inboxStatus,
    isHallOwner,
    matchedConversation,
    selectConversation,
    selectedId,
  ]);

  const canAttach =
    isHallOwner && Boolean(selectedId) && Boolean(sendAttachment);

  const missingConversation =
    isHallOwner &&
    Boolean(focusAdmin || focusHallId || focusConversationId) &&
    !selectedId &&
    (inboxStatus === "ready" || inboxStatus === "empty") &&
    !matchedConversation;

  const clearAttachment = useCallback(() => {
    setFile(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  // Attachment draft + error belong to one conversation: reset when the
  // selection changes (reconciled during render; the [previewUrl] cleanup
  // below revokes the previous object URL).
  const [boundSelectedId, setBoundSelectedId] = useState(selectedId);
  if (boundSelectedId !== selectedId) {
    setBoundSelectedId(selectedId);
    setFile(null);
    setPreviewUrl(null);
    setErrorKey(null);
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pickAttachment = useCallback(
    (next: File) => {
      if (!canAttach) return;
      if (!isAcceptedChatImage(next)) {
        setErrorKey("messages.attachInvalid");
        return;
      }
      setErrorKey(null);
      setFile(next);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(next);
      });
    },
    [canAttach],
  );

  const sendWithAttachment = useCallback(
    async (text: string) => {
      if (file && sendAttachment) {
        setAttachmentBusy(true);
        setErrorKey(null);
        try {
          const sent = await sendAttachment(file, text);
          if (sent) {
            clearAttachment();
          } else {
            setErrorKey("errors.send.failed");
          }
        } catch {
          setErrorKey("errors.send.failed");
        } finally {
          setAttachmentBusy(false);
        }
        return;
      }
      await sendMessage(text);
    },
    [clearAttachment, file, sendAttachment, sendMessage],
  );

  return {
    focusHallId,
    canAttach,
    missingConversation,
    attachmentPreviewUrl: previewUrl,
    attachmentName: file?.name ?? null,
    attachmentBusy,
    errorKey,
    pickAttachment: canAttach ? pickAttachment : undefined,
    clearAttachment,
    sendWithAttachment,
  };
}
